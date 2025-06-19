import { Grammar } from "../types";
import { EOF_SYMBOL, EPSILON } from "../../lexer/constants";
import { GrammarParser as Parser } from "../parser";

describe('GrammarParser', () => {
    let parser: Parser;

    beforeEach(() => {
        parser = new Parser();
    });

    test('should parse a simple grammar', () => {
        const grammarLines = [
            '<S> -> <A> <B>',
            '<A> -> id',
            '<B> -> num'
        ];
        const grammar = parser.parse(grammarLines);

        expect(grammar.rules.length).toBe(3);
        expect(grammar.startSymbol).toBe('<S>');
        expect(grammar.rules[0].nonTerminal).toBe('<S>');
        expect(grammar.rules[0].production).toEqual(['<A>', '<B>']);
        expect(grammar.rules[1].nonTerminal).toBe('<A>');
        expect(grammar.rules[1].production).toEqual(['id']);
        expect(grammar.rules[2].nonTerminal).toBe('<B>');
        expect(grammar.rules[2].production).toEqual(['num']);
        expect(grammar.nonTerminals).toEqual(new Set(['<S>', '<A>', '<B>']));
        expect(grammar.terminals).toEqual(new Set(['id', 'num', EOF_SYMBOL]));
    });

    test('should parse grammar with epsilon rules (empty string)', () => {
        const grammarLines = [
            '<S> -> <A>',
            '<A> -> id <A>',
            '<A> -> ε' // Epsilon
        ];
        const grammar = parser.parse(grammarLines);
        expect(grammar.rules[2].production).toEqual(['ε']);
    });

    test('should parse grammar with epsilon rules (# symbol)', () => {
        const grammarLines = [
            '<S> -> <A> #action',
            '<A> -> a',
            '<A> -> #anotherAction',
        ];
        const grammar = parser.parse(grammarLines);
        expect(grammar.rules[2].production).toEqual(['#anotherAction']);
    });

    test('should extract action names', () => {
        const grammarLines = ['<S> -> id ~MyAction'];
        const grammar = parser.parse(grammarLines);
        expect(grammar.rules[0].actionName).toBe('MyAction');
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

        expect(grammar.rules.length).toBe(6); // 4 rules from alternatives + 2 from other rules
        expect(grammar.rules[0].nonTerminal).toBe('<S>');
        expect(grammar.rules[0].production).toEqual(['<A>']);
        expect(grammar.rules[1].nonTerminal).toBe('<S>');
        expect(grammar.rules[1].production).toEqual(['<B>']);
        expect(grammar.rules[2].nonTerminal).toBe('<S>');
        expect(grammar.rules[2].production).toEqual(['<C>']);
    });
});