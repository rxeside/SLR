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

describe("TS-like language (minimal)", () => {
    const grammar = [
        "<Program> -> <Statement>",
        "<Statement> -> let id = <Expression> ;",
        "<Expression> -> num"
    ];

    test("parses variable declaration", () => {
        // Пример: let x = 42;
        // Лексер должен разбить на: ["let", "id", "=", "num", ";"]
        const parser = new SLRParser(grammar);
        const input = ["let", "id", "=", "num", ";"];
        expect(parser.parse(input)).toBe(true);
    });

    test("rejects invalid statement", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse(["let", "=", "num", ";"])).toContain("ОШИБКА");
        expect(parser.parse(["let", "id", "num", ";"])).toContain("ОШИБКА");
    });
});

describe("TS-like language (expressions, multiple statements)", () => {
    const grammar = [
        "<Program> -> <Statement> <Program>",
        "<Program> -> <Statement>",
        "<Statement> -> let id = <Expression> ;",
        "<Expression> -> <Expression> + <Term>",
        "<Expression> -> <Term>",
        "<Term> -> <Term> * <Factor>",
        "<Term> -> <Factor>",
        "<Factor> -> ( <Expression> )",
        "<Factor> -> num",
        "<Factor> -> id"
    ];

    test("parses multiple variable declarations and expressions", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse(["let", "id", "=", "num", ";"])).toBe(true);
        expect(parser.parse(["let", "id", "=", "id", ";", "let", "id", "=", "num", ";"])).toBe(true);
        expect(parser.parse(["let", "id", "=", "num", "+", "num", ";"])).toBe(true);
        expect(parser.parse(["let", "id", "=", "num", "+", "id", "*", "num", ";"])).toBe(true);
        expect(parser.parse(["let", "id", "=", "(", "num", "+", "id", ")", "*", "num", ";"])).toBe(true);
    });

    test("rejects invalid expressions/statements", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse(["let", "id", "=", "+", "num", ";"])).toContain("ОШИБКА");
        expect(parser.parse(["let", "id", "=", "num", "*", ";"])).toContain("ОШИБКА");
        expect(parser.parse(["let", "id", "=", "(", "num", "+", ";"])).toContain("ОШИБКА");
        expect(parser.parse(["let", "id", "=", "num", ";", ";"])).toContain("ОШИБКА");
    });
});

describe("TS-like language (if statement)", () => {
    const grammar = [
        "<Program> -> <Statement> <Program>",
        "<Program> -> <Statement>",
        "<Statement> -> let id = <Expression> ;",
        "<Statement> -> if ( <Expression> ) <Statement>",
        "<Expression> -> <Expression> + <Term>",
        "<Expression> -> <Term>",
        "<Term> -> <Term> * <Factor>",
        "<Term> -> <Factor>",
        "<Factor> -> ( <Expression> )",
        "<Factor> -> num",
        "<Factor> -> id"
    ];

    test("parses if statements and variable declarations", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse(["let", "id", "=", "num", ";"])).toBe(true);
        expect(parser.parse(["if", "(", "id", ")", "let", "id", "=", "num", ";"])).toBe(true);
        expect(parser.parse([
            "let", "id", "=", "num", ";",
            "if", "(", "id", "+", "num", ")", "let", "id", "=", "num", ";"
        ])).toBe(true);
        expect(parser.parse([
            "if", "(", "id", ")", "if", "(", "id", ")", "let", "id", "=", "num", ";"
        ])).toBe(true);
    });

    test("rejects invalid if statements", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse(["if", "(", ")", "let", "id", "=", "num", ";"])).toContain("ОШИБКА");
        expect(parser.parse(["if", "id", ")", "let", "id", "=", "num", ";"])).toContain("ОШИБКА");
        expect(parser.parse(["if", "(", "id", ")", ";"])).toContain("ОШИБКА");
    });
});

describe("TS-like language (if-else, return, dangling else resolved)", () => {
    const grammar = [
        "<Program> -> <Statement> <Program>",
        "<Program> -> <Statement>",
        "<Statement> -> <Matched>",
        "<Statement> -> <Unmatched>",
        "<Matched> -> let id = <Expression> ;",
        "<Matched> -> return <Expression> ;",
        "<Matched> -> if ( <Expression> ) <Matched> else <Matched>",
        "<Unmatched> -> if ( <Expression> ) <Statement>",
        "<Unmatched> -> if ( <Expression> ) <Matched> else <Unmatched>",
        "<Expression> -> <Expression> + <Term>",
        "<Expression> -> <Term>",
        "<Term> -> <Term> * <Factor>",
        "<Term> -> <Factor>",
        "<Factor> -> ( <Expression> )",
        "<Factor> -> num",
        "<Factor> -> id"
    ];

    test("parses if-else, return, and variable declarations (dangling else resolved)", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse(["let", "id", "=", "num", ";"])).toBe(true);
        expect(parser.parse(["return", "id", ";"])).toBe(true);
        expect(parser.parse(["if", "(", "id", ")", "return", "num", ";"])).toBe(true);
        expect(parser.parse([
            "if", "(", "id", ")", "let", "id", "=", "num", ";", "else", "return", "id", ";"
        ])).toBe(true);
        expect(parser.parse([
            "let", "id", "=", "num", ";",
            "if", "(", "id", "+", "num", ")", "return", "num", ";", "else", "let", "id", "=", "id", ";"
        ])).toBe(true);
    });

    test("rejects invalid if-else and return statements", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse(["if", "(", "id", ")", "else", "return", "id", ";"])).toContain("ОШИБКА");
        expect(parser.parse(["return", ";"])).toContain("ОШИБКА");
        expect(parser.parse(["if", "(", "id", ")", "let", "id", "=", "num", ";", "else"])).toContain("ОШИБКА");
    });
});

describe("TS-like language (functions)", () => {
    const grammar = [
        "<Program> -> <Statement> <Program>",
        "<Program> -> <Statement>",
        "<Statement> -> let id = <Expression> ;",
        "<Statement> -> if ( <Expression> ) <Statement> else <Statement>",
        "<Statement> -> if ( <Expression> ) <Statement>",
        "<Statement> -> return <Expression> ;",
        "<Statement> -> function id ( <Params> ) : <Type> { <Program> }",
        "<Params> -> id : <Type> <ParamsTail>",
        "<Params> -> ε",
        "<ParamsTail> -> , id : <Type> <ParamsTail>",
        "<ParamsTail> -> ε",
        "<Type> -> id",
        "<Expression> -> <Expression> + <Term>",
        "<Expression> -> <Term>",
        "<Term> -> <Term> * <Factor>",
        "<Term> -> <Factor>",
        "<Factor> -> ( <Expression> )",
        "<Factor> -> num",
        "<Factor> -> id",
        "<Factor> -> id ( <Args> )",
        "<Args> -> <Expression> <ArgsTail>",
        "<Args> -> ε",
        "<ArgsTail> -> , <Expression> <ArgsTail>",
        "<ArgsTail> -> ε"
    ];

    test("parses function declarations and calls", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse([
            "function", "id", "(", ")", "{", "let", "id", "=", "num", ";", "}"
        ])).toBe(true);
        expect(parser.parse([
            "function", "id", "(", "id", ")", "{", "return", "id", ";", "}"
        ])).toBe(true);
        expect(parser.parse([
            "function", "id", "(", "id", ",", "id", ")", "{", "return", "id", ";", "}"
        ])).toBe(true);
        expect(parser.parse([
            "let", "id", "=", "id", "(", "num", ")", ";"
        ])).toBe(true);
        expect(parser.parse([
            "let", "id", "=", "id", "(", "num", ",", "id", ")", ";"
        ])).toBe(true);
        expect(parser.parse([
            "function", "id", "(", ")", "{",
            "let", "id", "=", "id", "(", "num", ")", ";",
            "}", "let", "id", "=", "num", ";"
        ])).toBe(true);
    });

    test("rejects invalid function declarations and calls", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse([
            "function", "id", "(", "id", ",", ")", "{", "return", "id", ";", "}"
        ])).toContain("ОШИБКА");
        expect(parser.parse([
            "let", "id", "=", "id", "(", ")", ";", ";"
        ])).toContain("ОШИБКА");
        expect(parser.parse([
            "function", "id", "(", "id", ")", "{", "return", ";", "}"
        ])).toContain("ОШИБКА");
    });
});

describe("TS-like language (types: only bool, num, string)", () => {
    const grammar = [
        "<Program> -> <Statement> <Program>",
        "<Program> -> <Statement>",
        "<Statement> -> let id : <Type> = <Expression> ;",
        "<Statement> -> if ( <Expression> ) <Statement> else <Statement>",
        "<Statement> -> if ( <Expression> ) <Statement>",
        "<Statement> -> return <Expression> ;",
        "<Statement> -> function id ( <Params> ) : <Type> { <Program> }",
        "<Params> -> id : <Type> <ParamsTail>",
        "<Params> -> ε",
        "<ParamsTail> -> , id : <Type> <ParamsTail>",
        "<ParamsTail> -> ε",
        "<Type> -> bool",
        "<Type> -> num",
        "<Type> -> string",
        "<Expression> -> <Expression> + <Term>",
        "<Expression> -> <Term>",
        "<Term> -> <Term> * <Factor>",
        "<Term> -> <Factor>",
        "<Factor> -> ( <Expression> )",
        "<Factor> -> num",
        "<Factor> -> id",
        "<Factor> -> id ( <Args> )",
        "<Args> -> <Expression> <ArgsTail>",
        "<Args> -> ε",
        "<ArgsTail> -> , <Expression> <ArgsTail>",
        "<ArgsTail> -> ε"
    ];

    test("parses type annotations in variables, params, and functions (only bool, num, string)", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse([
            "let", "id", ":", "num", "=", "num", ";"
        ])).toBe(true);
        expect(parser.parse([
            "let", "id", ":", "bool", "=", "id", ";"
        ])).toBe(true);
        expect(parser.parse([
            "function", "id", "(", "id", ":", "string", ")", ":", "num", "{", "return", "id", ";", "}"
        ])).toBe(true);
        expect(parser.parse([
            "function", "id", "(", "id", ":", "num", ",", "id", ":", "bool", ")", ":", "string", "{", "return", "id", ";", "}"
        ])).toBe(true);
        expect(parser.parse([
            "let", "id", ":", "string", "=", "id", "(", "num", ")", ";"
        ])).toBe(true);
    });

    test("rejects invalid type annotations (only bool, num, string allowed)", () => {
        const parser = new SLRParser(grammar);
        expect(parser.parse([
            "let", "id", ":", "id", "=", "num", ";"
        ])).toContain("ОШИБКА");
        expect(parser.parse([
            "function", "id", "(", "id", ":", "id", ")", ":", "num", "{", "return", "id", ";", "}"
        ])).toContain("ОШИБКА");
        expect(parser.parse([
            "function", "id", "(", "id", ":", "num", ",", "id", ":", "id", ")", ":", "string", "{", "return", "id", ";", "}"
        ])).toContain("ОШИБКА");
    });
});
