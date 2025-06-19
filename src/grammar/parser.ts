import { EOF_SYMBOL } from "@src/lexer/constants";
import { Grammar, GrammarRule } from "./types";

export function isTerminal(symbol: string, nonTerminals: Set<string>): boolean {
    return !nonTerminals.has(symbol);
}

export class GrammarParser {
    private nextRuleId = 0;

    public parse(grammarLines: string[]): Grammar {
        this.nextRuleId = 0;
        const rules: GrammarRule[] = [];
        const terminals = new Set<string>();
        const nonTerminals = new Set<string>();
        let firstNonTerminal: string | null = null;

        grammarLines.forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('//')) {
                return; // Пропускаем пустые строки и комментарии
            }

            const parts = line.split('->');
            if (parts.length !== 2) {
                throw new Error(`Invalid rule format: ${line}`);
            }

            const nonTerminal = parts[0].trim();
            if (!nonTerminal.startsWith('<') || !nonTerminal.endsWith('>')) {
                throw new Error(`Non-terminal must be enclosed in <>: ${nonTerminal}`);
            }
            nonTerminals.add(nonTerminal);
            if (!firstNonTerminal) {
                firstNonTerminal = nonTerminal;
            }

            let actionName
            
            const productionString = parts[1].trim().replace(/\s~([a-zA-Z0-9_]+)$/, (_match, name) => {
                actionName = name;
                return '';
            }).trim();

            // Разбиваем на альтернативы по символу |
            const alternatives = productionString.split('|').map(alt => alt.trim());
            
            // Для каждой альтернативы создаем отдельное правило
            alternatives.forEach(alternative => {
                const production = (alternative === '#')
                    ? []
                    : alternative.split(/\s+/).filter(s => s.length > 0);

                rules.push({
                    id: this.nextRuleId++,
                    nonTerminal,
                    production,
                    actionName
                });
            });
        });

        if (!firstNonTerminal) {
            throw new Error("Grammar does not contain any rules.");
        }

        // Определяем все терминалы
        rules.forEach(rule => {
            rule.production.forEach(symbol => {
                if (isTerminal(symbol, nonTerminals)) {
                    terminals.add(symbol);
                }
            });
        });
        terminals.add(EOF_SYMBOL); // EOF всегда терминал

        return {
            rules,
            terminals,
            nonTerminals,
            startSymbol: firstNonTerminal
        };
    }
}