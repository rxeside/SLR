import { Lexer } from "../src/lexer/lexer";
import { SLRParser } from "../src/slr/slr";
import { TT } from "../src/lexer/constants";

describe("SLR Integration Tests", () => {
    // Простая грамматика для арифметических выражений (терминалы соответствуют лексеру)
    const arithmeticGrammar = [
        "<E> -> <E> + <T>",
        "<E> -> <T>",
        "<T> -> <T> * <F>",
        "<T> -> <F>",
        "<F> -> ( <E> )",
        "<F> -> number",
        "<F> -> id"
    ];

    test("parses simple arithmetic expression", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(arithmeticGrammar);

        // Вход: "x + 42 * y"
        const input = "x + 42 * y";
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);

        // Проверяем, что лексер правильно разбил на токены
        expect(tokenTypes).toEqual([
            TT.IDENTIFIER,  // x
            TT.OPERATOR_PLUS,  // +
            TT.NUMBER,  // 42
            TT.OPERATOR_MULTIPLY,  // *
            TT.IDENTIFIER,  // y
            TT.EOF
        ]);

        // Проверяем, что парсер принимает эту последовательность
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses expression with parentheses", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(arithmeticGrammar);

        // Вход: "(x + 42) * y"
        const input = "(x + 42) * y";
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);

        // Проверяем токены
        expect(tokenTypes).toEqual([
            TT.PUNCT_LPAREN,  // (
            TT.IDENTIFIER,  // x
            TT.OPERATOR_PLUS,  // +
            TT.NUMBER,  // 42
            TT.PUNCT_RPAREN,  // )
            TT.OPERATOR_MULTIPLY,  // *
            TT.IDENTIFIER,  // y
            TT.EOF
        ]);

        // Проверяем парсинг
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("rejects invalid expression", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(arithmeticGrammar);

        // Вход: "x + * y" - некорректное выражение
        const input = "x + * y";
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);

        // Проверяем токены
        expect(tokenTypes).toEqual([
            TT.IDENTIFIER,  // x
            TT.OPERATOR_PLUS,  // +
            TT.OPERATOR_MULTIPLY,  // *
            TT.IDENTIFIER,  // y
            TT.EOF
        ]);

        // Проверяем, что парсер отвергает некорректное выражение
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    test("rejects unmatched parentheses", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(arithmeticGrammar);

        // Вход: "(x + 42" - незакрытая скобка
        const input = "(x + 42";
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);

        // Проверяем токены
        expect(tokenTypes).toEqual([
            TT.PUNCT_LPAREN,  // (
            TT.IDENTIFIER,  // x
            TT.OPERATOR_PLUS,  // +
            TT.NUMBER,  // 42
            TT.EOF
        ]);

        // Проверяем, что парсер отвергает выражение с незакрытой скобкой
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });
});

describe("SLR Integration Tests for Full Grammar", () => {
    const fullGrammar = [
        "<Program> -> <Statement> <Program>",
        "<Program> -> <Statement>",
        "<Statement> -> <Declaration>",
        "<Statement> -> <IfStatement>",
        "<Statement> -> <WhileStatement>",
        "<Statement> -> <FunctionDeclaration>",
        "<Statement> -> <FunctionCall>",
        "<Statement> -> <ReturnStatement>",
        "<Statement> -> <Assignment>",
        "<Declaration> -> <BaseDeclaration>",
        "<Declaration> -> <ArrayDeclaration>",
        "<BaseDeclaration> -> let id : <BaseType> = <Expression> ;",
        "<ArrayDeclaration> -> let id : <ArrayType> = <ArrayLiteral> ;",
        "<ReturnStatement> -> return <Expression> ;",
        "<Assignment> -> id = <Expression> ;",
        "<Assignment> -> <ArrayAccess> = <Expression> ;",
        "<ArrayAccess> -> id [ <ArrayIndex> ]",
        "<ArrayAccess> -> <ArrayAccess> [ <ArrayIndex> ]",
        "<ArrayIndex> -> <Expression>",
        "<IfStatement> -> if ( <Expression> ) { <Block> }",
        "<IfStatement> -> if ( <Expression> ) { <Block> } else { <Block> }",
        "<WhileStatement> -> while ( <Expression> ) { <Block> }",
        "<FunctionDeclaration> -> function id ( <Params> ) : <Type> { <Block> }",
        "<FunctionCall> -> id ( <Args> ) ;",
        "<Block> -> <Statement> <Block>",
        "<Block> -> <Statement>",
        "<Block> -> ",
        "<Params> -> id : <Type> <MoreParams>",
        "<Params> -> ",
        "<MoreParams> -> , id : <Type> <MoreParams>",
        "<MoreParams> -> ",
        "<Args> -> <Expression> <MoreArgs>",
        "<Args> -> ",
        "<MoreArgs> -> , <Expression> <MoreArgs>",
        "<MoreArgs> -> ",
        "<Type> -> <BaseType>",
        "<Type> -> <ArrayType>",
        "<BaseType> -> bool",
        "<BaseType> -> num",
        "<BaseType> -> string",
        "<ArrayType> -> <BaseType> [ ]",
        "<ArrayType> -> <ArrayType> [ ]",
        "<Expression> -> <LogicExpr>",
        "<LogicExpr> -> <EqualityExpr> && <LogicExpr>",
        "<LogicExpr> -> <EqualityExpr>",
        "<EqualityExpr> -> <RelExpr> == <EqualityExpr>",
        "<EqualityExpr> -> <RelExpr> != <EqualityExpr>",
        "<EqualityExpr> -> <RelExpr>",
        "<RelExpr> -> <AddExpr> < <RelExpr>",
        "<RelExpr> -> <AddExpr> > <RelExpr>",
        "<RelExpr> -> <AddExpr> <= <RelExpr>",
        "<RelExpr> -> <AddExpr> >= <RelExpr>",
        "<RelExpr> -> <AddExpr>",
        "<AddExpr> -> <MulExpr> + <AddExpr>",
        "<AddExpr> -> <MulExpr> - <AddExpr>",
        "<AddExpr> -> <MulExpr>",
        "<MulExpr> -> <Factor> * <MulExpr>",
        "<MulExpr> -> <Factor>",
        "<Factor> -> id",
        "<Factor> -> id ( <Args> )",
        "<Factor> -> <ArrayAccess>",
        "<Factor> -> ( <Expression> )",
        "<Factor> -> number",
        "<Factor> -> string",
        "<Factor> -> true",
        "<Factor> -> false",
        "<ArrayMember> -> <Expression>",
        "<ArrayMember> -> <ArrayLiteral>",
        "<ArrayLiteral> -> [ <ArrayElements> ]",
        "<ArrayElements> -> <ArrayMember> <MoreArrayElements>",
        "<ArrayElements> -> ",
        "<MoreArrayElements> -> , <ArrayMember> <MoreArrayElements>",
        "<MoreArrayElements> -> "
    ];

    test("parses variable declaration with type", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);

        // Вход: "let x : num = 42;"
        const input = "let x : num = 42;";
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);

        // Проверяем токены
        expect(tokenTypes).toEqual([
            TT.KEYWORD_LET,  // let
            TT.IDENTIFIER,  // x
            TT.PUNCT_COLON,  // :
            TT.KEYWORD_NUM,  // num
            TT.OPERATOR_ASSIGN,  // =
            TT.NUMBER,  // 42
            TT.PUNCT_SEMICOLON,  // ;
            TT.EOF
        ]);

        // Проверяем парсинг
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses if-else statement", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);

        // Вход: "if (x > 0) { return 1; } else { return 0; }"
        const input = "if (x > 0) { return 1; } else { return 0; }";
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);

        // Проверяем токены
        expect(tokenTypes).toEqual([
            TT.KEYWORD_IF,  // if
            TT.PUNCT_LPAREN,  // (
            TT.IDENTIFIER,  // x
            TT.OPERATOR_GREATER,  // >
            TT.NUMBER,  // 0
            TT.PUNCT_RPAREN,  // )
            TT.PUNCT_LBRACE,  // {
            TT.KEYWORD_RETURN,  // return
            TT.NUMBER,  // 1
            TT.PUNCT_SEMICOLON,  // ;
            TT.PUNCT_RBRACE,  // }
            TT.KEYWORD_ELSE,  // else
            TT.PUNCT_LBRACE,  // {
            TT.KEYWORD_RETURN,  // return
            TT.NUMBER,  // 0
            TT.PUNCT_SEMICOLON,  // ;
            TT.PUNCT_RBRACE,  // }
            TT.EOF
        ]);

        // Проверяем парсинг
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses function declaration", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);

        // Вход: "function add(a : num, b : num) : num { return a + b; }"
        const input = "function add(a : num, b : num) : num { return a + b; }";
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);

        // Проверяем токены
        expect(tokenTypes).toEqual([
            TT.KEYWORD_FUNCTION,  // function
            TT.IDENTIFIER,  // add
            TT.PUNCT_LPAREN,  // (
            TT.IDENTIFIER,  // a
            TT.PUNCT_COLON,  // :
            TT.KEYWORD_NUM,  // num
            TT.PUNCT_COMMA,  // ,
            TT.IDENTIFIER,  // b
            TT.PUNCT_COLON,  // :
            TT.KEYWORD_NUM,  // num
            TT.PUNCT_RPAREN,  // )
            TT.PUNCT_COLON,  // :
            TT.KEYWORD_NUM,  // num
            TT.PUNCT_LBRACE,  // {
            TT.KEYWORD_RETURN,  // return
            TT.IDENTIFIER,  // a
            TT.OPERATOR_PLUS,  // +
            TT.IDENTIFIER,  // b
            TT.PUNCT_SEMICOLON,  // ;
            TT.PUNCT_RBRACE,  // }
            TT.EOF
        ]);

        // Проверяем парсинг
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("rejects invalid syntax", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);

        // Вход: "let x = 42;" (отсутствует тип)
        const input = "let x = 42;";
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);

        // Проверяем токены
        expect(tokenTypes).toEqual([
            TT.KEYWORD_LET,  // let
            TT.IDENTIFIER,  // x
            TT.OPERATOR_ASSIGN,  // =
            TT.NUMBER,  // 42
            TT.PUNCT_SEMICOLON,  // ;
            TT.EOF
        ]);

        // Проверяем, что парсер отвергает некорректный синтаксис
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    test("parses multi-line program", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);

        // Вход: многострочная программа
        const input = `
            let x : num = 42;
            if (x > 0) {
                return 1;
            } else {
                return 0;
            }
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);

        // Проверяем парсинг
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("rejects multi-line program with syntax error", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);

        // Вход: многострочная программа с ошибкой
        const input = `
            let x : num = 42;
            if (x > 0) {
                return 1;
            } else {
                return 0;
            }
            let y = 10; // отсутствует тип
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);

        // Проверяем, что парсер отвергает некорректный синтаксис
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    test("parses while loop with block", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `while (x < 10) { let y : num = 1; }`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses function declaration with no parameters", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `function f() : bool { return true; }`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(tokenTypes).toEqual([
            TT.KEYWORD_FUNCTION,
            TT.IDENTIFIER,
            TT.PUNCT_LPAREN,
            TT.PUNCT_RPAREN,
            TT.PUNCT_COLON,
            TT.KEYWORD_BOOL,
            TT.PUNCT_LBRACE,
            TT.KEYWORD_RETURN,
            TT.KEYWORD_TRUE,
            TT.PUNCT_SEMICOLON,
            TT.PUNCT_RBRACE,
            TT.EOF
        ]);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses function declaration with multiple parameters and types", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `function sum(a : num, b : num, c : string) : num { return a + b; }`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses function call with arguments", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `foo(1, x, "a_string_arg");`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(tokenTypes).toEqual([
            TT.IDENTIFIER,
            TT.PUNCT_LPAREN,
            TT.NUMBER,
            TT.PUNCT_COMMA,
            TT.IDENTIFIER,
            TT.PUNCT_COMMA,
            TT.STRING,
            TT.PUNCT_RPAREN,
            TT.PUNCT_SEMICOLON,
            TT.EOF
        ]);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses function call with no arguments", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `foo();`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses variable declaration with string and bool", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        expect(parser.parse(lexer.tokenize(`let s : string = "test_string";`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`let b : bool = true;`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`let b2 : bool = false;`).map(t => t.type))).toBe(true);
    });

    test("parses return with different types", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        expect(parser.parse(lexer.tokenize(`return "a_string";`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`return true;`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`return false;`).map(t => t.type))).toBe(true);
    });

    test("parses complex expression with operators and parentheses", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `let x : num = (1 + 2) * (3 + 4) == 10;`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses nested if-else and while", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `if (x > 0) { while (y != 0) { return 42; } } else { return 0; }`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses function with empty parameter list and empty argument list", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        expect(parser.parse(lexer.tokenize(`function f() : num { return 42; }`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`f();`).map(t => t.type))).toBe(true);
    });

    // Негативные тесты
    test("rejects variable declaration with missing type", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `let x = 1;`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    test("rejects function declaration with missing return type", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `function f(a : num) { return num; }`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    test("rejects while loop with missing block", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `while (x < 10) return num;`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    test("rejects function call with missing semicolon", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `foo(1, 2)`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    test("parses nested function calls", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `let x : num = f(g(h(42)));`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses complex expressions with multiple operators", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `let x : bool = (a + b * c) == (d + e) && f > g;`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses empty blocks", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `if (x > 0) { } else { }`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses deeply nested if statements", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `
            if (x > 0) {
                if (y > 0) {
                    if (z > 0) {
                        return 42;
                    }
                }
            } else {
                if (a > 0) {
                    return 0;
                }
            }
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses function with expression parameters", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `let x : num = f(a + b, g(c * d), h(e > f));`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses code with various whitespace and newlines", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `
            let x : num = 42;
            
            if (x > 0) {
                return 1;
            } else {
                return 0;
            }
            
            function f() : num {
                return x;
            }
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses complex program with all features", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `
            function calculate(a : num, b : num) : num {
                if (a > b) {
                    while (a > 0) {
                        let x : num = f(g(a + b));
                        if (x == 42) {
                            return x;
                        }
                        a = a - 1;
                    }
                } else {
                    return b;
                }
            }

            let result : num = calculate(10, 20);
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    // Негативные тесты для сложных случаев
    test("rejects malformed nested function calls", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `let x : num = f(g(h(42);`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    test("rejects malformed complex expression", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `let x : bool = (a + b * c == (d + e) && f > g;`;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    test("rejects malformed nested if statements", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `
            if (x > 0) {
                if (y > 0) {
                    if (z > 0) {
                        return 42;
                    }
                }
            } else {
                if (a > 0) {
                    return 0;
                }
            }
            } // лишняя закрывающая скобка
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        const result = parser.parse(tokenTypes);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    // TODO: Добавить массивы
    test("parses bubble sort implementation", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `
            function bubbleSort(arr : num) : num {
                let n : num = 10;
                let i : num = 0;
                while (i < n) {
                    let j : num = 0;
                    while (j < n - 1) {
                        if (arr[j] > arr[j + 1]) {
                            let temp : num = arr[j];
                            arr[j] = arr[j + 1];
                            arr[j + 1] = temp;
                        }
                        j = j + 1;
                    }
                    i = i + 1;
                }
                return arr;
            }
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses iterative factorial calculation", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `
            function factorial(n : num) : num {
                let result : num = 1;
                let i : num = 1;
                while (i <= n) {
                    result = result * i;
                    i = i + 1;
                }
                return result;
            }
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses iterative fibonacci calculation", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `
            function fibonacci(n : num) : num {
                let a : num = 0;
                let b : num = 1;
                let i : num = 2;
                while (i <= n) {
                    let temp : num = a + b;
                    a = b;
                    b = temp;
                    i = i + 1;
                }
                return b;
            }
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses simple calculator with single level if-else", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `
            function calculate(a : num, b : num, op : string) : num {
                if (op == "add") {
                    return a + b;
                } else {
                    return a - b;
                }
            }
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses simple array operations", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `
            function findMax(arr : num) : num {
                let max : num = arr[0];
                let i : num = 1;
                while (i < 10) {
                    if (arr[i] > max) {
                        max = arr[i];
                    }
                    i = i + 1;
                }
                return max;
            }
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses simple string operations", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const input = `
            function isPalindrome(s : string) : bool {
                let left : num = 0;
                let right : num = 10;
                while (left < right) {
                    if (s[left] != s[right]) {
                        return false;
                    }
                    left = left + 1;
                    right = right - 1;
                }
                return true;
            }
        `;
        const tokens = lexer.tokenize(input);
        const tokenTypes = tokens.map(t => t.type);
        expect(parser.parse(tokenTypes)).toBe(true);
    });

    test("parses array declarations and operations", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);

        // Test array type declarations
        expect(parser.parse(lexer.tokenize(`let arr : num[] = [1, 2, 3];`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`let strs : string[] = ["s1", "s2"];`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`let bools : bool[] = [true, false];`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`let emptyArr : num[] = [];`).map(t => t.type))).toBe(true);

        // Test array access
        expect(parser.parse(lexer.tokenize(`let x : num = arr[0];`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`let y : num = arr[i + 1];`).map(t => t.type))).toBe(true);

        // Test array assignment
        expect(parser.parse(lexer.tokenize(`arr[0] = 42;`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`arr[i * 2] = arr[j];`).map(t => t.type))).toBe(true);

        // Test nested arrays
        expect(parser.parse(lexer.tokenize(`let matrix : num[][] = [[1, 2], [3, 4]];`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`let x : num = matrix[0][1];`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`let tensor : num[][][] = [[[1]], [[2],[3]]];`).map(t => t.type))).toBe(true);
        expect(parser.parse(lexer.tokenize(`let arrTest: num[] = [10, 20]; let val : num = arrTest[0] + arrTest[1];`).map(t => t.type))).toBe(true);
    });

    test("rejects invalid array operations", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);

        // Test invalid array declarations
        expect(parser.parse(lexer.tokenize(`let arr : num = [1, 2, 3];`).map(t => t.type))).toContain("ОШИБКА");
        expect(parser.parse(lexer.tokenize(`let arr : [] = [1, 2, 3];`).map(t => t.type))).toContain("ОШИБКА");
        expect(parser.parse(lexer.tokenize(`let arr : num[];`).map(t => t.type))).toContain("ОШИБКА");

        // Test invalid array access
        expect(parser.parse(lexer.tokenize(`let x : num = arr[];`).map(t => t.type))).toContain("ОШИБКА");
        expect(parser.parse(lexer.tokenize(`let x : num = arr[;`).map(t => t.type))).toContain("ОШИБКА");
        expect(parser.parse(lexer.tokenize(`let x : num = arr[1,2];`).map(t => t.type))).toContain("ОШИБКА");
        expect(parser.parse(lexer.tokenize(`let m : num[][]; let x : num = m[0][];`).map(t => t.type))).toContain("ОШИБКА");
        expect(parser.parse(lexer.tokenize(`let m : num[][]; let x : num = m[][0];`).map(t => t.type))).toContain("ОШИБКА");

        // Test invalid array literals
        expect(parser.parse(lexer.tokenize(`let arr : num[] = [1, ];`).map(t => t.type))).toContain("ОШИБКА");
        expect(parser.parse(lexer.tokenize(`let arr : num[] = [, 1];`).map(t => t.type))).toContain("ОШИБКА");
        expect(parser.parse(lexer.tokenize(`let arr : num[] = [1,,2];`).map(t => t.type))).toContain("ОШИБКА");
        expect(parser.parse(lexer.tokenize(`let arr : num[] = [1 2];`).map(t => t.type))).toContain("ОШИБКА");
        expect(parser.parse(lexer.tokenize(`let arr : num[] = [,];`).map(t => t.type))).toContain("ОШИБКА");

        // Test invalid array type definitions
        expect(parser.parse(lexer.tokenize(`let arr : num[[]] = [1];`).map(t => t.type))).toContain("ОШИБКА");
    });

    test("rejects array literals in function arguments if not expected as expression", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const result = parser.parse(lexer.tokenize(`myFunc([1,2,3]);`).map(t => t.type));
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });

    test("rejects array literals in return statements if not expected as expression", () => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const result = parser.parse(lexer.tokenize(`return [1,2,3];`).map(t => t.type));
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    });
});
