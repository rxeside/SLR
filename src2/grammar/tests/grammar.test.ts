import { GrammarParser } from "../parser";
import { EOF_SYMBOL, EPSILON } from "src2/lexer/constants";
import { printGrammar, processGrammar } from '../grammar';

describe('GrammarParser', () => {
    let parser: GrammarParser;

    beforeEach(() => {
        parser = new GrammarParser();
    });

    test('should parse a simple grammar', () => {
        const grammarLines = [
            '<S> -> <A> <B>',
            '<A> -> id',
            '<B> -> num'
        ];
        const grammar = parser.parse(grammarLines);

        expect(grammar.rules.length).toBe(4); // 3 + 1 (augmented)
        expect(grammar.startSymbol).toBe('<S>');
        expect(grammar.rules[0].nonTerminal).toBe('<S>\'');
        expect(grammar.rules[0].production).toEqual(['<S>', EOF_SYMBOL]);
        expect(grammar.rules[1].nonTerminal).toBe('<S>');
        expect(grammar.rules[1].production).toEqual(['<A>', '<B>']);
        expect(grammar.nonTerminals).toEqual(new Set(['<S>\'', '<S>', '<A>', '<B>']));
        expect(grammar.terminals).toEqual(new Set(['id', 'num', EOF_SYMBOL]));
    });

    test('should parse grammar with epsilon rules (empty string)', () => {
        const grammarLines = [
            '<S> -> <A>',
            '<A> -> id <A>',
            '<A> -> ε' // Epsilon
        ];
        const grammar = parser.parse(grammarLines);
        expect(grammar.rules[3].production).toEqual([EPSILON]); // Проверяем, что эпсилон правильно представлен
    });

    test('should parse grammar with epsilon rules (# symbol)', () => {
        const grammarLines = [
            '<S> -> <A>',
            '<A> -> id <A>',
            '<A> -> #' // Epsilon
        ];
        const grammar = parser.parse(grammarLines);
        expect(grammar.rules[3].production).toEqual([]);
    });

    test('should extract action names', () => {
        const grammarLines = ['<S> -> id ~MyAction'];
        const grammar = parser.parse(grammarLines);
        expect(grammar.rules[1].actionName).toBe('MyAction');
    });

    test('should throw error for invalid rule format', () => {
        expect(() => parser.parse(['<S> id'])).toThrowError(/Invalid rule format/);
        expect(() => parser.parse(['S -> id'])).toThrowError(/Non-terminal must be enclosed in <>/);
    });

    test('should handle multiple alternatives in a single rule', () => {
        const grammarLines = [
            '<S> -> <A> | <B> | <C>',
            '<A> -> id',
            '<B> -> num',
            '<C> -> str'
        ];
        const grammar = parser.parse(grammarLines);

        expect(grammar.rules.length).toBe(7); // 4 + 1 (augmented) + 2 (from first rule)
        expect(grammar.rules[1].nonTerminal).toBe('<S>');
        expect(grammar.rules[1].production).toEqual(['<A>']);
        expect(grammar.rules[2].nonTerminal).toBe('<S>');
        expect(grammar.rules[2].production).toEqual(['<B>']);
        expect(grammar.rules[3].nonTerminal).toBe('<S>');
        expect(grammar.rules[3].production).toEqual(['<C>']);
    });
});

describe('processGrammar', () => {
    // грамматика расщиренная
    test('slide example: removes epsilon and minimizes', () => {
        const lines = [
            '<S> -> <A> <B>',
            '<A> -> <A> <A> a',
            '<A> -> ε',
            '<B> -> b <B> <B>',
            '<B> -> ε',
        ];
        const grammar = processGrammar(lines);
        const ruleSet = new Set(grammar.rules.map(r => `${r.nonTerminal}->${r.production.join(' ')}`));
        expect(ruleSet).toEqual(new Set([
            '<S>-><A> <B>', '<S>-><A>', '<S>-><B>', '<S>->',
            '<A>-><A> <A> a', '<A>-><A> a', '<A>->a',
            '<B>->b <B> <B>', "<S>'-><S> $", '<B>->b <B>', '<B>->b'
        ]));
        // Проверяем, что нет бесполезных нетерминалов
        expect(grammar.nonTerminals).toEqual(new Set(['<S>', '<A>', '<B>', '<S>\'']));
    });

    test('removes unreachable and unproductive', () => {
        const lines = [
            '<S> -> <A>',
            '<A> -> a',
            '<B> -> b', // B недостижим
            '<C> -> <C>', // C непродуктивен
        ];
        const grammar = processGrammar(lines);
        const nts = Array.from(grammar.nonTerminals);
        expect(nts).toContain('<S>');
        expect(nts).toContain('<A>');
        expect(nts).not.toContain('<B>');
        expect(nts).not.toContain('<C>');
        expect(grammar.rules.every(r => nts.includes(r.nonTerminal))).toBe(true);
    });

    test('works with no epsilon rules', () => {
        const lines = [
            '<S> -> <A> <B>',
            '<A> -> a',
            '<B> -> b',
        ];
        const grammar = processGrammar(lines);
        expect(grammar.rules.length).toBe(4); // 3 + 1 (augmented)
        expect(grammar.nonTerminals).toEqual(new Set(['<S>', '<A>', '<B>', '<S>\'']));
    });
});