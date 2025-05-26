import { Grammar, GrammarRule } from "./types";
import { EPSILON } from "../lexer/constants";

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
                rule.production.length === 0 ||
                rule.production.includes(EPSILON) ||
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
    let nextId = 0;
    for (const rule of grammar.rules) {
        // Пропускаем явные ε-правила (добавим их позже, если нужно)
        if (rule.production.length === 0 || rule.production.includes(EPSILON)) continue;
        // Найти позиции ε-порождающих нетерминалов
        const positions: number[] = [];
        rule.production.forEach((sym, idx) => {
            if (epsilonGenerating.has(sym)) positions.push(idx);
        });
        // Сгенерировать все возможные комбинации опускания ε-порождающих нетерминалов
        const n = positions.length;
        const variants = new Set<string>();
        for (let mask = 0; mask < (1 << n); ++mask) {
            const prod = rule.production.slice();
            for (let i = 0; i < n; ++i) {
                if ((mask & (1 << i)) !== 0) {
                    prod[positions[i]] = null as any;
                }
            }
            const filtered = prod.filter(x => x !== null);
            if (filtered.length > 0) variants.add(filtered.join("\0"));
        }
        // Добавить все варианты
        for (const variant of variants) {
            newRules.push({
                id: nextId++,
                nonTerminal: rule.nonTerminal,
                production: variant.split("\0"),
            });
        }
    }

    // 3. Если стартовый символ ε-порождающий, добавить S → ε
    if (epsilonGenerating.has(grammar.startSymbol)) {
        newRules.push({
            id: nextId++,
            nonTerminal: grammar.startSymbol,
            production: [],
        });
    }

    // 4. Собрать новые терминалы и нетерминалы
    const nonTerminals = new Set(grammar.nonTerminals);
    const terminals = new Set(grammar.terminals);

    return {
        rules: newRules,
        terminals,
        nonTerminals,
        startSymbol: grammar.startSymbol,
    };
}
