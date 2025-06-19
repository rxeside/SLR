import { Lexer } from '../src/lexer/lexer';
import { SLRParser } from '../src/slr/slr';
import { fullGrammar } from './grammars';
import { CodeGenerator } from '../src/generator/generator';
import { SemanticAnalyzer } from '../src/analyzer/analyzer';
import { SymbolTable } from '../src/symbolTable/symbolTable';
import * as vm from 'vm';
import { ErrorHandler } from '../src/error/error';
import { ASTNode, AssignExpr, Identifier, VarDecl } from '../src/ast/entity';

// Helper function to compile and run code, similar to the main() in index.ts
function compileAndRun(sourceCode: string): any {
    const errorHandler = new ErrorHandler();
    errorHandler.setSourceCode(sourceCode);

    // 1. Lexer
    const lexer = new Lexer();
    const tokens = lexer.tokenize(sourceCode, errorHandler);

    // 2. Parser
    const parser = new SLRParser(fullGrammar, errorHandler);
    const ast = parser.parse(tokens);

    if (errorHandler.hasErrors() || !ast) {
        errorHandler.printErrors();
        throw new Error('Compilation failed during parsing.');
    }

    // 3. Semantic Analyzer
    const symbolTable = new SymbolTable();
    const analyzer = new SemanticAnalyzer(symbolTable, errorHandler);
    analyzer.analyze(ast);

    if (errorHandler.hasErrors()) {
        errorHandler.printErrors();
        throw new Error('Compilation failed during semantic analysis.');
    }

    // 4. Code Generator
    const generator = new CodeGenerator();
    let jsCode = generator.generate(ast);

    // Wrap the code to capture the last expression's value
    const lastStatement = ast.statements[ast.statements.length - 1];
    let resultVariableName: string | null = null;
    if (lastStatement) {
        if (lastStatement instanceof VarDecl) {
            resultVariableName = lastStatement.name;
        } else if (lastStatement instanceof AssignExpr && lastStatement.target instanceof Identifier) {
            resultVariableName = lastStatement.target.name;
        } else if (lastStatement instanceof Identifier) {
            resultVariableName = lastStatement.name;
        }
    }

    if (resultVariableName) {
        jsCode += `\n;${resultVariableName};`;
    }
    
    // 5. Run the generated code
    let capturedOutput: any = null;
    const customConsole = {
        log: (...args: any[]) => {
            capturedOutput = args[0];
        }
    };

    try {
        const script = new vm.Script(jsCode);
        const context = vm.createContext({ console: customConsole });
        script.runInContext(context);
        return capturedOutput;
    } catch (e) {
        console.error("Error during execution:", e);
        console.error("Generated JS Code:\n", jsCode);
        throw e;
    }
}


describe('Nested Functions Integration Test', () => {

    test('should allow a nested function to access variables from all scopes', () => {
        const input = `
            let x: num = 10;

            function outer(y: num): num {
                let z: num = 20;

                function inner(w: num): num {
                    return x + y + z + w; 
                }

                return inner(5);
            }

            print(outer(15));
        `;

        const finalResult = compileAndRun(input);
        expect(finalResult).toBe(50);
    });

    test('should handle multiple levels of nesting correctly', () => {
        const input = `
            let globalVar: num = 1;

            function f1(a: num): num {
                let var1: num = 10;

                function f2(b: num): num {
                    let var2: num = 100;

                    function f3(c: num): num {
                        return globalVar + a + var1 + b + var2 + c; // 1 + 2 + 10 + 3 + 100 + 4
                    }

                    return f3(4);
                }

                return f2(3);
            }

            print(f1(2));
        `;
        const finalResult = compileAndRun(input);
        expect(finalResult).toBe(120);
    });

    test('should handle sibling nested functions', () => {
        const input = `
            function outer(a: num): num {
                
                function inner1(b: num): num {
                    return a + b;
                }

                function inner2(c: num): num {
                    return a * c;
                }

                return inner1(5) + inner2(10); // (10 + 5) + (10 * 10) = 15 + 100
            }

            print(outer(10));
        `;
        const finalResult = compileAndRun(input);
        expect(finalResult).toBe(115);
    });

    test('should handle closures by mutating parent scope variables', () => {
        const validTestInput = `
            let result: num = 0;
            function outer(): void {
                let x: num = 10;
                
                function inner(): void {
                    x = x + 5;
                }

                inner();
                inner();
                result = x;
            }

            outer();
            print(result);
        `;
        
        const finalResult = compileAndRun(validTestInput);
        expect(finalResult).toBe(20);
    });

}); 