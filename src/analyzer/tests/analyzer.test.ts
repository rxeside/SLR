import { SemanticAnalyzer } from '../analyzer';
import { Lexer } from '../../lexer/lexer';
import { SLRParser } from '../../slr/slr';
import { fullGrammar } from '../../../integration-tests/grammars';
import { SymbolTable } from '../../symbolTable/symbolTable';
import { ErrorHandler, CompilerError } from '../../error/error';

describe('SemanticAnalyzer', () => {
    const analyzeWithErrors = (source: string): CompilerError[] => {
        const errorHandler = new ErrorHandler();
        const lexer = new Lexer();
        const tokens = lexer.tokenize(source, errorHandler);
        
        const parser = new SLRParser(fullGrammar, errorHandler);
        const ast = parser.parse(tokens);
        
        if (errorHandler.hasErrors() || !ast) {
            return errorHandler.errors;
        }

        const symbolTable = new SymbolTable();
        const analyzer = new SemanticAnalyzer(symbolTable, errorHandler);
        analyzer.analyze(ast);
        
        return errorHandler.errors;
    };

    test('should throw an error for using an undeclared variable', () => {
        const errors = analyzeWithErrors('let x: num = y;');
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Symbol 'y' not found");
    });

    test('should successfully analyze a correct variable declaration', () => {
        const errors = analyzeWithErrors('let x: num = 10;');
        expect(errors).toHaveLength(0);
    });

    test('should throw an error for a variable declared twice', () => {
        const source = `
            let x: num = 10;
            let x: string = "hello";
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Symbol 'x' already declared in the current scope");
    });

    // --- Scope Tests ---

    test('should allow variable shadowing in a nested scope', () => {
        const source = `
            let x: num = 10;
            function myFunc(): void {
                let x: string = "hello"; 
            }
        `;
        const errors = analyzeWithErrors(source);
        expect(errors).toHaveLength(0);
    });

    test('should allow accessing a variable from an outer scope', () => {
        const source = `
            let x: num = 10;
            function myFunc(): void {
                let y: num = x;
            }
        `;
        const errors = analyzeWithErrors(source);
        expect(errors).toHaveLength(0);
    });

    test('should throw an error when accessing a variable outside its scope', () => {
        const source = `
            function myFunc(): void {
                let x: num = 10;
            }
            let y: num = x;
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Symbol 'x' not found");
    });

    test('should handle function parameters correctly', () => {
        const source = `
            function myFunc(a: num): void {
                let b: num = a; // 'a' should be visible here
            }
        `;
        const errors = analyzeWithErrors(source);
        expect(errors).toHaveLength(0);
    });

    test('should throw error when accessing function parameter outside the function', () => {
        const source = `
            function myFunc(a: num): void {
                let b: num = 1;
            }
            let c: num = a; // 'a' should not be visible here
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Symbol 'a' not found");
    });

    // --- Type Checking Tests ---

    test('should throw an error for type mismatch in variable declaration', () => {
        const source = `let x: num = "hello";`;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Type mismatch: cannot assign 'string' to 'num'");
    });

    test('should throw an error for type mismatch in assignment', () => {
        const source = `
            let x: num = 10;
            x = "world";
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Type mismatch: cannot assign 'string' to 'num'");
    });

    test('should throw an error for invalid types in binary expression', () => {
        const source = `let x: num = 10 + "hello";`;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Type mismatch: cannot assign 'string' to 'num'");
    });

    test('should throw an error for incorrect return type', () => {
        const source = `
            function myFunc(): num {
                return "not-a-number";
            }
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Type mismatch: cannot return 'string' from a function expecting 'num'");
    });

    // --- Function Call Tests ---

    test('should throw an error for calling an undeclared function', () => {
        const source = `nonExistentFunc();`;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Function 'nonExistentFunc' not found or not a function");
    });

    test('should throw an error for calling a variable that is not a function', () => {
        const source = `
            let x: num = 10;
            x();
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Function 'x' not found or not a function");
    });

    test('should throw an error for calling a function with incorrect number of arguments', () => {
        const source = `
            function myFunc(a: num, b: string): void {}
            myFunc(1);
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Function 'myFunc' expects 2 arguments, but received 1");
    });

    test('should throw an error for calling a function with incorrect argument types', () => {
        const source = `
            function myFunc(a: num, b: string): void {}
            myFunc(1, 2);
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Type mismatch: Argument 2 for function 'myFunc' expects 'string', but received 'num'");
    });

    // --- Control Flow Tests ---

    test('should throw an error if condition in if-statement is not a boolean', () => {
        const source = `
            if (1) {}
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("If statement condition must be a boolean, but got 'num'");
    });

    test('should throw an error if condition in while-statement is not a boolean', () => {
        const source = `
            while ("hello") {}
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("While statement condition must be a boolean, but got 'string'");
    });

    // --- Array Tests ---

    test('should correctly analyze an array declaration', () => {
        const source = `let arr: num[] = [1, 2, 3];`;
        const errors = analyzeWithErrors(source);
        expect(errors).toHaveLength(0);
    });

    test('should throw an error when indexing a non-array variable', () => {
        const source = `
            let x: num = 10;
            let y: num = x[0];
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Cannot access index of non-array type 'num'");
    });

    test('should throw an error for non-numeric array index', () => {
        const source = `
            let arr: num[] = [1, 2];
            let y: num = arr["hello"];
        `;
        const errors = analyzeWithErrors(source);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain("Array index must be of type 'num', but got 'string'");
    });
}); 