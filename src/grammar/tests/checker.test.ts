import { Grammar } from "../types";
import { checkReachable, checkProductive, checkGrammar } from "../checker";
import { EOF_SYMBOL, EPSILON } from "../../lexer/constants";

describe('Grammar Checker', () => {
    test('should check reachability of non-terminals', () => {
        const grammar: Grammar = {
            rules: [
                { id: 0, nonTerminal: "<S>'", production: ["<S>", EOF_SYMBOL] },
                { id: 1, nonTerminal: "<S>", production: ["<A>", "<B>"] },
                { id: 2, nonTerminal: "<A>", production: ["id"] },
                { id: 3, nonTerminal: "<B>", production: ["num"] },
                { id: 4, nonTerminal: "<C>", production: ["str"] } // Недостижимый нетерминал
            ],
            terminals: new Set(["id", "num", "str", EOF_SYMBOL]),
            nonTerminals: new Set(["<S>'", "<S>", "<A>", "<B>", "<C>"]),
            startSymbol: "<S>"
        };

        const reachable = checkReachable(grammar);
        expect(reachable.has("<S>")).toBe(true);
        expect(reachable.has("<A>")).toBe(true);
        expect(reachable.has("<B>")).toBe(true);
        expect(reachable.has("<C>")).toBe(false);
    });

    test('should check productivity of non-terminals', () => {
        const grammar: Grammar = {
            rules: [
                { id: 0, nonTerminal: "<S>'", production: ["<S>", EOF_SYMBOL] },
                { id: 1, nonTerminal: "<S>", production: ["<A>"] },
                { id: 2, nonTerminal: "<A>", production: ["<B>"] },
                { id: 3, nonTerminal: "<B>", production: ["id"] },
                { id: 4, nonTerminal: "<C>", production: ["<C>"] } // Непродуктивный нетерминал (цикл)
            ],
            terminals: new Set(["id", EOF_SYMBOL]),
            nonTerminals: new Set(["<S>'", "<S>", "<A>", "<B>", "<C>"]),
            startSymbol: "<S>"
        };

        const productive = checkProductive(grammar);
        expect(productive.has("<B>")).toBe(true);
        expect(productive.has("<A>")).toBe(true);
        expect(productive.has("<S>")).toBe(true);
        expect(productive.has("<C>")).toBe(false);
    });

    test('should handle epsilon productions in productivity check', () => {
        const grammar: Grammar = {
            rules: [
                { id: 0, nonTerminal: "<S>'", production: ["<S>", EOF_SYMBOL] },
                { id: 1, nonTerminal: "<S>", production: ["<A>"] },
                { id: 2, nonTerminal: "<A>", production: [EPSILON] }
            ],
            terminals: new Set([EOF_SYMBOL]),
            nonTerminals: new Set(["<S>'", "<S>", "<A>"]),
            startSymbol: "<S>"
        };

        const productive = checkProductive(grammar);
        expect(productive.has("<A>")).toBe(true);
        expect(productive.has("<S>")).toBe(true);
    });

    test('should check both reachability and productivity', () => {
        const grammar: Grammar = {
            rules: [
                { id: 0, nonTerminal: "<S>'", production: ["<S>", EOF_SYMBOL] },
                { id: 1, nonTerminal: "<S>", production: ["<A>"] },
                { id: 2, nonTerminal: "<A>", production: ["id"] },
                { id: 3, nonTerminal: "<B>", production: ["<B>"] }, // Непродуктивный
                { id: 4, nonTerminal: "<C>", production: ["str"] }  // Недостижимый
            ],
            terminals: new Set(["id", "str", EOF_SYMBOL]),
            nonTerminals: new Set(["<S>'", "<S>", "<A>", "<B>", "<C>"]),
            startSymbol: "<S>"
        };

        const result = checkGrammar(grammar);
        expect(result.isReachable).toBe(false);
        expect(result.isProductive).toBe(false);
        expect(result.unreachable).toEqual(new Set(["<B>", "<C>", "<S>'"]));
        expect(result.unproductive).toEqual(new Set(["<B>"]));
    });
});
