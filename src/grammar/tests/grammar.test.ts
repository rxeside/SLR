import { processGrammar } from '../grammar';

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