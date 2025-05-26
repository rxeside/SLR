import { Grammar } from './types';
import { GrammarParser } from './parser';
import { removeEpsilonRules } from './preparer';
import { checkReachable, checkProductive } from './checker';
import { EOF_SYMBOL } from 'src2/lexer/constants';

/**
 * Полная обработка грамматики: парсинг, удаление ε-правил, минимизация.
 * @param grammarLines Массив строк с правилами грамматики
 * @returns Минимизированная грамматика без ε-правил
 */
export function processGrammar(grammarLines: string[]): Grammar {
    // 1. Парсинг
    const parser = new GrammarParser();
    let grammar = parser.parse(grammarLines);


    // 2. Удаление ε-правил
    grammar = removeEpsilonRules(grammar);

    // 3. Минимизация: удаление недостижимых и непродуктивных нетерминалов
    const reachable = checkReachable(grammar);
    const productive = checkProductive(grammar);
    const useful = new Set([...grammar.nonTerminals].filter(nt => reachable.has(nt) && productive.has(nt)));

    grammar = {
        ...grammar,
        rules: grammar.rules.filter(rule => useful.has(rule.nonTerminal) && rule.production.every(sym => !grammar.nonTerminals.has(sym) || useful.has(sym))),
        nonTerminals: useful,
    };

    // Дополняем грамматику
    const augmentedStartSymbol = `${grammar.startSymbol}'`;
    grammar.nonTerminals.add(augmentedStartSymbol);
    grammar.rules.unshift({
        id: -1, // Специальный ID для дополняющего правила, переназначим позже
        nonTerminal: augmentedStartSymbol,
        production: [grammar.startSymbol, EOF_SYMBOL],
    });

    // Перенумеруем правила после добавления дополняющего
    grammar.rules.forEach((rule, index) => rule.id = index);

    console.log(grammar.rules);

    return grammar;
}

export function printGrammar(grammar: Grammar) {
    console.log('rules', grammar.rules.map(rule => `${rule.nonTerminal} -> ${rule.production.join(' ')}`).join('\n'));
    console.log('nonTerminals', grammar.nonTerminals);
    console.log('terminals', grammar.terminals);
    console.log('startSymbol', grammar.startSymbol);
}