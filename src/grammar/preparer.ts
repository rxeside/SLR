import { Grammar, GrammarRule } from "./types";
import { EPSILON } from "../lexer/constants";

function isEpsilonProduction(production: string[]): boolean {
    return production.length === 0 || (production.length === 1 && (production[0] === EPSILON || production[0] === 'ε'));
}

/**
 * Удаляет ε-правила из КС-грамматики
 * @param grammar Исходная грамматика
 * @returns Новая грамматика без ε-правил
 */
export function removeEpsilonRules(grammar: Grammar): Grammar {
    // 1. Найти все ε-порождающие нетерминалы
    const epsilonGenerating = new Set<string>();
    let changed = true;
    while (changed) {
        changed = false;
        for (const rule of grammar.rules) {
            if (
                isEpsilonProduction(rule.production) ||
                rule.production.every(sym => epsilonGenerating.has(sym))
            ) {
                if (!epsilonGenerating.has(rule.nonTerminal)) {
                    epsilonGenerating.add(rule.nonTerminal);
                    changed = true;
                }
            }
        }
    }

    // 2. Для каждого правила, где встречается ε-порождающий нетерминал, добавить новые правила с опущенными такими нетерминалами
    const newRules: GrammarRule[] = [];
    const ruleStrings = new Set<string>();

    for (const rule of grammar.rules) {
        if (isEpsilonProduction(rule.production)) continue;

        const epsilonPositions = rule.production.map((s, i) => epsilonGenerating.has(s) ? i : -1).filter(i => i !== -1);
        const numEpsilon = epsilonPositions.length;

        for (let i = 0; i < (1 << numEpsilon); i++) {
            const newProduction = [...rule.production];
            for (let j = 0; j < numEpsilon; j++) {
                if ((i & (1 << j)) !== 0) {
                    newProduction[epsilonPositions[j]] = null as any;
                }
            }
            const finalProduction = newProduction.filter(s => s !== null);
            const key = `${rule.nonTerminal}->${finalProduction.join(' ')}`;
            if (!ruleStrings.has(key)) {
                newRules.push({ id: 0, nonTerminal: rule.nonTerminal, production: finalProduction });
                ruleStrings.add(key);
            }
        }
    }

    // 3. Если стартовый символ ε-порождающий, добавить S → ε
    if (epsilonGenerating.has(grammar.startSymbol)) {
        const key = `${grammar.startSymbol}->`;
        if (!ruleStrings.has(key)) {
            newRules.push({
                id: 0,
                nonTerminal: grammar.startSymbol,
                production: [],
            });
            ruleStrings.add(key);
        }
    }
    
    // 4. Собрать новые терминалы и нетерминалы
    const nonTerminals = new Set(grammar.nonTerminals);
    const terminals = new Set(grammar.terminals);

    return {
        rules: newRules.map((r, i) => ({...r, id: i})),
        terminals,
        nonTerminals,
        startSymbol: grammar.startSymbol,
    };
}

