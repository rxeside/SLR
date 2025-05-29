import { SLRParser } from "../slr";

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
        "<Factor> -> id",
        "<Factor> -> id ( <Args> )"
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
        "<Factor> -> id",
        "<Factor> -> id ( <Args> )"
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
        "<Statement> -> <Matched>",
        "<Statement> -> <Unmatched>",
        "<Matched> -> let id = <Expression> ;",
        "<Matched> -> return <Expression> ;",
        "<Matched> -> if ( <Expression> ) <Matched> else <Matched>",
        "<Matched> -> function id ( <Params> ) { <Block> }",
        "<Matched> -> id ( <Args> ) ;",
        "<Unmatched> -> if ( <Expression> ) <Statement>",
        "<Unmatched> -> if ( <Expression> ) <Matched> else <Unmatched>",
        "<Block> -> <Statement> <Block>",
        "<Block> -> <Statement>",
        "<Params> -> id <MoreParams>",
        "<Params> -> ",
        "<MoreParams> -> , id <MoreParams>",
        "<MoreParams> -> ",
        "<Args> -> <Expression> <MoreArgs>",
        "<Args> -> ",
        "<MoreArgs> -> , <Expression> <MoreArgs>",
        "<MoreArgs> -> ",
        "<Expression> -> <Expression> + <Term>",
        "<Expression> -> <Term>",
        "<Term> -> <Term> * <Factor>",
        "<Term> -> <Factor>",
        "<Factor> -> ( <Expression> )",
        "<Factor> -> num",
        "<Factor> -> id",
        "<Factor> -> id ( <Args> )"
    ];

    test("parses function declarations and calls", () => {
        const parser = new SLRParser(grammar);
        // Function declaration without parameters
        expect(parser.parse([
            "function", "id", "(", ")", "{",
            "return", "num", ";",
            "}"
        ])).toBe(true);

        // Function declaration with parameters
        expect(parser.parse([
            "function", "id", "(", "id", ",", "id", ")", "{",
            "let", "id", "=", "num", ";",
            "return", "id", "+", "num", ";",
            "}"
        ])).toBe(true);

        // Function call without arguments
        expect(parser.parse(["id", "(", ")", ";"])).toBe(true);

        // Function call with arguments
        expect(parser.parse(["id", "(", "num", ",", "id", ")", ";"])).toBe(true);

        // Complex program with functions
        expect(parser.parse([
            "function", "id", "(", "id", ")", "{",
            "if", "(", "id", ")", "return", "num", ";",
            "return", "id", "*", "num", ";",
            "}",
            "let", "id", "=", "id", "(", "num", ")", ";"
        ])).toBe(true);
    });

    test("rejects invalid function declarations and calls", () => {
        const parser = new SLRParser(grammar);
        // Missing function body
        expect(parser.parse(["function", "id", "(", ")", ";"])).toContain("ОШИБКА");
        // Missing closing brace
        expect(parser.parse(["function", "id", "(", ")", "{"])).toContain("ОШИБКА");
        // Invalid parameter list
        expect(parser.parse(["function", "id", "(", ",", ")", "{"])).toContain("ОШИБКА");
        // Invalid function call
        expect(parser.parse(["id", "(", ",", ")", ";"])).toContain("ОШИБКА");
        // Missing semicolon after function call
        expect(parser.parse(["id", "(", ")", "}"])).toContain("ОШИБКА");
    });
});

describe("TS-like language (typed variables and while loop)", () => {
    const grammar = [
        "<Program> -> <Statement> <Program>",
        "<Program> -> <Statement>",
        "<Statement> -> <Matched>",
        "<Statement> -> <Unmatched>",
        "<Matched> -> let id : <Type> = <Expression> ;",
        "<Matched> -> return <Expression> ;",
        "<Matched> -> if ( <Expression> ) <Matched> else <Matched>",
        "<Matched> -> while ( <Expression> ) { <Block> }",
        "<Matched> -> function id ( <Params> ) : <Type> { <Block> }",
        "<Matched> -> id ( <Args> ) ;",
        "<Unmatched> -> if ( <Expression> ) <Statement>",
        "<Unmatched> -> if ( <Expression> ) <Matched> else <Unmatched>",
        "<Block> -> <Statement> <Block>",
        "<Block> -> <Statement>",
        "<Params> -> id : <Type> <MoreParams>",
        "<Params> -> ",
        "<MoreParams> -> , id : <Type> <MoreParams>",
        "<MoreParams> -> ",
        "<Args> -> <Expression> <MoreArgs>",
        "<Args> -> ",
        "<MoreArgs> -> , <Expression> <MoreArgs>",
        "<MoreArgs> -> ",
        "<Type> -> bool",
        "<Type> -> num",
        "<Type> -> string",
        "<Expression> -> <Expression> + <Term>",
        "<Expression> -> <Expression> == <Term>",
        "<Expression> -> <Expression> != <Term>",
        "<Expression> -> <Expression> < <Term>",
        "<Expression> -> <Expression> > <Term>",
        "<Expression> -> <Expression> <= <Term>",
        "<Expression> -> <Expression> >= <Term>",
        "<Expression> -> <Term>",
        "<Term> -> <Term> * <Factor>",
        "<Term> -> <Factor>",
        "<Factor> -> ( <Expression> )",
        "<Factor> -> num",
        "<Factor> -> string",
        "<Factor> -> bool",
        "<Factor> -> id",
        "<Factor> -> id ( <Args> )"
    ];

    test("parses typed variable declarations and while loops", () => {
        const parser = new SLRParser(grammar);
        // Typed variable declarations
        expect(parser.parse([
            "let", "id", ":", "num", "=", "num", ";"
        ])).toBe(true);
        expect(parser.parse([
            "let", "id", ":", "string", "=", "string", ";"
        ])).toBe(true);
        expect(parser.parse([
            "let", "id", ":", "bool", "=", "bool", ";"
        ])).toBe(true);

        // While loop
        expect(parser.parse([
            "while", "(", "id", ")", "{", "let", "id", ":", "num", "=", "num", ";", "}"
        ])).toBe(true);

        // Complex program with types and while
        expect(parser.parse([
            "let", "id", ":", "num", "=", "num", ";",
            "while", "(", "id", ">", "num", ")", "{",
            "let", "id", ":", "string", "=", "string", ";",
            "if", "(", "id", "==", "string", ")", "return", "bool", ";",
            "}"
        ])).toBe(true);

        // Typed function with while
        expect(parser.parse([
            "function", "id", "(", "id", ":", "num", ")", ":", "bool", "{",
            "while", "(", "id", ">", "num", ")", "{",
            "let", "id", ":", "string", "=", "string", ";",
            "}",
            "return", "bool", ";",
            "}"
        ])).toBe(true);
    });

    test("rejects invalid typed declarations and while loops", () => {
        const parser = new SLRParser(grammar);
        // Missing type
        expect(parser.parse([
            "let", "id", "=", "num", ";"
        ])).toContain("ОШИБКА");
        // Invalid type
        expect(parser.parse([
            "let", "id", ":", "invalid", "=", "num", ";"
        ])).toContain("ОШИБКА");
        // Missing while body
        expect(parser.parse([
            "while", "(", "id", ")", ";"
        ])).toContain("ОШИБКА");
        // Missing while condition
        expect(parser.parse([
            "while", "(", ")", "{", "}"
        ])).toContain("ОШИБКА");
    });
});
