import { SLRParser } from "../slr";
import { Lexer } from "../../lexer/lexer";

describe("SLRParser", () => {
    test("parses simple arithmetic expression", () => {
        const grammar = [
            "<E> -> <E> + <T>",
            "<E> -> <T>",
            "<T> -> id"
        ];
        const parser = new SLRParser(grammar);
        expect(parser.parse(["id", "+", "id"])).toBe(true);
        expect(parser.parse(["id", "+", "id", "+", "id"])).toBe(true);
    });

    test("rejects invalid input", () => {
        const grammar = [
            "<E> -> <E> + <T>",
            "<E> -> <T>",
            "<T> -> id"
        ];
        const parser = new SLRParser(grammar);
        expect(parser.parse(["+", "id"])).toContain('ОШИБКА');
        expect(parser.parse(["id", "+"])).toContain('ОШИБКА');
        expect(parser.parse(["id", "+", "+", "id"])).toContain('ОШИБКА');
    });

    test("parses grammar with epsilon", () => {
        const grammar = [
            "<S> -> <A> b",
            "<A> -> a",
            "<A> -> ε"
        ];
        const parser = new SLRParser(grammar);
        expect(parser.parse(["a", "b"])).toBe(true);
        expect(parser.parse(["b"])).toBe(true);
        expect(parser.parse(["a"])).toContain('ОШИБКА');
    });

    test("parses nested parentheses", () => {
        const grammar = [
            "<S> -> ( <S> )",
            "<S> -> <S> <S>",
            "<S> -> id"
        ];
        const parser = new SLRParser(grammar);
        expect(parser.parse(["(", "id", ")"])).toBe(true);
        expect(parser.parse(["id", "id"])).toBe(true);
        expect(parser.parse(["(", "(", "id", ")", ")"])).toBe(true);
        expect(parser.parse(["(", "id", ")", "id"])).toBe(true);
        expect(parser.parse(["(", ")"])).toContain('ОШИБКА');
    });
});