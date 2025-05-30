import { removeEpsilonRules } from '../preparer';
import { Grammar } from '../types';
import { EPSILON } from '../../lexer/constants';

describe('removeEpsilonRules', () => {
    test('removes epsilon rules (slide example)', () => {
        const grammar: Grammar = {
            rules: [
                { id: 0, nonTerminal: 'S', production: ['A', 'B'] },
                { id: 1, nonTerminal: 'A', production: ['A', 'A', 'a'] },
                { id: 2, nonTerminal: 'A', production: [EPSILON] },
                { id: 3, nonTerminal: 'B', production: ['b', 'B', 'B'] },
                { id: 4, nonTerminal: 'B', production: [EPSILON] },
            ],
            terminals: new Set(['a', 'b']),
            nonTerminals: new Set(['S', 'A', 'B']),
            startSymbol: 'S',
        };
        const result = removeEpsilonRules(grammar);
        const ruleSet = new Set(result.rules.map(r => `${r.nonTerminal}->${r.production.join(' ')}`));
        // Проверяем, что правила соответствуют примеру на слайде
        expect(ruleSet).toEqual(new Set([
            'S->A B', 'S->A', 'S->B', 'S->',
            'A->A A a', 'A->A a', 'A->a',
            'B->b B B', 'B->b B', 'B->b'
        ]));
    });

    test('keeps S->epsilon if S is nullable', () => {
        const grammar: Grammar = {
            rules: [
                { id: 0, nonTerminal: 'S', production: [EPSILON] },
            ],
            terminals: new Set([]),
            nonTerminals: new Set(['S']),
            startSymbol: 'S',
        };
        const result = removeEpsilonRules(grammar);
        expect(result.rules.length).toBe(1);
        expect(result.rules[0].production).toEqual([]);
    });

    test('removes all epsilon rules if start is not nullable', () => {
        const grammar: Grammar = {
            rules: [
                { id: 0, nonTerminal: 'S', production: ['A'] },
                { id: 1, nonTerminal: 'A', production: [EPSILON] },
            ],
            terminals: new Set([]),
            nonTerminals: new Set(['S', 'A']),
            startSymbol: 'S',
        };
        const result = removeEpsilonRules(grammar);
        const ruleSet = new Set(result.rules.map(r => `${r.nonTerminal}->${r.production.join(' ')}`));
        expect(ruleSet).toEqual(new Set([
            'S->A',
            'S->'
        ]));
    });

    test('works with no epsilon rules', () => {
        const grammar: Grammar = {
            rules: [
                { id: 0, nonTerminal: 'S', production: ['A', 'B'] },
                { id: 1, nonTerminal: 'A', production: ['a'] },
                { id: 2, nonTerminal: 'B', production: ['b'] },
            ],
            terminals: new Set(['a', 'b']),
            nonTerminals: new Set(['S', 'A', 'B']),
            startSymbol: 'S',
        };
        const result = removeEpsilonRules(grammar);
        expect(result.rules.length).toBe(3);
    });
});
