import { Lexer } from "../src/lexer/lexer";
import { SLRParser } from "../src/slr/slr";
import { fullGrammar } from "./grammars";
import { Program } from "../src/ast/entity";

describe("SLR Integration Tests for Full Grammar", () => {

    // Helper function for positive tests
    const expectParses = (input: string) => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const tokens = lexer.tokenize(input);
        const result = parser.parse(tokens);
        if (typeof result === 'string') {
            console.error(result); // Print error for debugging
        }
        expect(result).toBeInstanceOf(Program);
    };

    // Helper function for negative tests
    const expectFails = (input: string) => {
        const lexer = new Lexer();
        const parser = new SLRParser(fullGrammar);
        const tokens = lexer.tokenize(input);
        const result = parser.parse(tokens);
        expect(typeof result).toBe("string");
        expect(result).toContain("ОШИБКА");
    };
    
    test("parses variable declaration with type", () => {
        expectParses("let x : num = 42;");
    });

    test("parses if-else statement", () => {
        expectParses("if (x > 0) { let a: num = 1; } else { let b: num = 0; }");
    });

    test("parses function declaration", () => {
        expectParses("function add(a : num, b : num) : num { return a + b; }");
    });

    test("rejects invalid syntax", () => {
        expectFails("let x = 42;");
    });

    test("parses multi-line program", () => {
        expectParses(`
            let x : num = 42;
            if (x > 0) {
                let a : num = 1;
            } else {
                let b : num = 0;
            }
        `);
    });

    test("rejects multi-line program with syntax error", () => {
        expectFails(`
            let x : num = 42;
            if (x > 0) {
                let a: num = 1;
            } else {
                let b: num = 0;
            }
            let y = 10; // отсутствует тип
        `);
    });

    test("parses while loop with block", () => {
        expectParses(`while (x < 10) { let y : num = 1; }`);
    });

    test("parses function declaration with no parameters", () => {
        expectParses(`function f() : bool { return true; }`);
    });

    test("parses function declaration with multiple parameters and types", () => {
        expectParses(`function sum(a : num, b : num, c : string) : num { return a + b; }`);
    });

    test("parses function call with arguments", () => {
        // To parse a function call, it must be part of a program with the function declared.
        // Let's assume `foo` is a predefined function or declared elsewhere.
        // For standalone parsing, let's wrap it in a context if needed, but for now, let's assume it's valid.
        // The AST builder might throw if the function is not in the symbol table.
        // Let's test the call inside a function body.
        expectParses(`function test() : void { foo(1, x, "a_string_arg"); }`);
    });

    test("parses function call with no arguments", () => {
        expectParses(`function test(): void { foo(); }`);
    });

    test("parses variable declaration with string and bool", () => {
        expectParses(`let s : string = "test_string";`);
        expectParses(`let b : bool = true;`);
        expectParses(`let b2 : bool = false;`);
    });

    test("parses return with different types", () => {
        expectParses(`function test():string { return "a_string"; }`);
        expectParses(`function test():bool { return true; }`);
        expectParses(`function test():bool { return false; }`);
    });

    test("parses complex expression with operators and parentheses", () => {
        // Note: The expression must be valid boolean, as it is assigned to a bool.
        // This will be caught by a type checker later. The parser should pass it.
        expectParses(`let x : bool = (1 + 2) * (3 + 4) == 10;`);
    });

    test("parses nested if-else and while", () => {
        expectParses(`function test():num { if (x > 0) { while (y != 0) { return 42; } } else { return 0; } }`);
    });

    test("parses function with empty parameter list and empty argument list", () => {
        expectParses(`function f() : num { return 42; }`);
        expectParses(`function test():void { f(); }`);
    });

    // Негативные тесты
    test("rejects variable declaration with missing type", () => {
        expectFails(`let x = 1;`);
    });

    test("rejects function declaration with missing return type", () => {
        expectFails(`function f(a : num) { return 1; }`);
    });

    test("rejects while loop with missing block", () => {
        expectFails(`while (x < 10) return 1;`);
    });

    test("rejects function call with missing semicolon", () => {
        expectFails(`function test():void{ foo(1, 2) }`);
    });

    test("parses nested function calls", () => {
        // Assuming f, g, h are declared
        expectParses(`function test(): void { let x : num = f(g(h(42))); }`);
    });

    test("parses complex expressions with multiple operators", () => {
        expectParses(`let x : bool = (a + b * c) == (d + e) && f > g;`);
    });

    test("parses empty blocks", () => {
        expectParses(`if (x > 0) { } else { }`);
    });

    test("parses deeply nested if statements", () => {
        expectParses(`
            function test():num {
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
            }
        `);
    });

    test("parses function with expression parameters", () => {
        // Assuming f, g, h are declared
        expectParses(`function test():void { let x : num = f(a + b, g(c * d), h(e > f)); }`);
    });

    test("parses code with various whitespace and newlines", () => {
        expectParses(`
            let x : num = 42;
            
            if (x > 0) {
                let a : num = 1;
            } else {
                let b : num = 0;
            }
            
            function f() : num {
                return x;
            }
        `);
    });

    test("parses complex program with all features", () => {
        expectParses(`
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
                return -1; // Added return for all paths
            }

            let result : num = calculate(10, 20);
        `);
    });

    // Негативные тесты для сложных случаев
    test("rejects malformed nested function calls", () => {
        expectFails(`function test():void { let x : num = f(g(h(42); }`);
    });

    test("rejects malformed complex expression", () => {
        expectFails(`let x : bool = (a + b * c == (d + e) && f > g;`);
    });

    test("rejects malformed nested if statements", () => {
        expectFails(`
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
        `);
    });

    // The following tests for array/string operations will fail parsing
    // because the grammar does not support array access like `arr[j]` inside expressions.
    // I will comment them out for now, as fixing the grammar is a separate task.
    test("parses bubble sort implementation", () => {
        expectParses(`
            function bubbleSort(arr : num[]) : void {
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
            }
        `);
    });

    test("parses iterative factorial calculation", () => {
        expectParses(`
            function factorial(n : num) : num {
                let result : num = 1;
                let i : num = 1;
                while (i <= n) {
                    result = result * i;
                    i = i + 1;
                }
                return result;
            }
        `);
    });

    test("parses iterative fibonacci calculation", () => {
        expectParses(`
            function fibonacci(n : num) : num {
                let a : num = 0;
                let b : num = 1;
                let i : num = 2;
                if (n == 0) { return a; }
                while (i <= n) {
                    let temp : num = a + b;
                    a = b;
                    b = temp;
                    i = i + 1;
                }
                return b;
            }
        `);
    });

    test("parses simple calculator with single level if-else", () => {
        expectParses(`
            function calculate(a : num, b : num, op : string) : num {
                if (op == "add") {
                    return a + b;
                } else {
                    return a - b;
                }
            }
        `);
    });

    test("parses simple array operations", () => {
        expectParses(`
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
        `);
    });

    test("parses simple string operations", () => {
        expectParses(`
            function isPalindrome(s : num[]) : bool {
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
        `);
    });

    test("parses array declarations and operations", () => {
        expectParses(`let arr : num[] = [1, 2, 3];`);
        expectParses(`let strs : string[] = ["s1", "s2"];`);
        expectParses(`let bools : bool[] = [true, false];`);
        expectParses(`let emptyArr : num[] = [];`);
        
        expectParses(`let x : num = arr[0];`);
        expectParses(`arr[0] = 42;`);
        
        expectParses(`let matrix : num[][] = [[1, 2], [3, 4]];`);
    });

    test("rejects invalid array operations", () => {
        expectFails(`let arr : num = [1, 2, 3];`);
        expectFails(`let arr : [] = [1, 2, 3];`);
        expectFails(`let arr : num[];`);
        expectFails(`let x : num = arr[];`);
        expectFails(`let x : num = arr[;`);
        expectFails(`let arr : num[] = [1, ];`);
        expectFails(`let arr : num[] = [, 1];`);
    });

});
