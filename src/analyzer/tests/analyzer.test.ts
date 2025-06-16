import { SemanticAnalyzer } from '../analyzer';
import { Program } from '../../ast/entity';
import { Lexer } from '../../lexer/lexer';
import { SLRParser } from '../../slr/slr';
import { fullGrammar } from '../../../integration-tests/grammars';
import { SemanticError } from '../error';
import { SymbolTable } from '../../symbolTable/symbolTable';

describe('SemanticAnalyzer', () => {
    let analyzer: SemanticAnalyzer;
    let symbolTable: SymbolTable;

    const createAst = (source: string): Program => {
        const lexer = new Lexer();
        const tokens = lexer.tokenize(source);
        const parser = new SLRParser(fullGrammar);
        const ast = parser.parse(tokens);
        if (!(ast instanceof Program)) {
            throw new Error(`Parser failed to produce a valid AST: ${ast}`);
        }
        return ast;
    };

    beforeEach(() => {
        symbolTable = new SymbolTable();
        analyzer = new SemanticAnalyzer(symbolTable);
    });

    test('should throw an error for using an undeclared variable', () => {
        const ast = createAst('let x: num = y;');
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Symbol 'y' not found"));
    });

    test('should successfully analyze a correct variable declaration', () => {
        const ast = createAst('let x: num = 10;');
        expect(() => analyzer.analyze(ast)).not.toThrow();
    });

    test('should throw an error for a variable declared twice', () => {
        const ast = createAst(`
            let x: num = 10;
            let x: string = "hello";
        `);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Symbol 'x' already declared in the current scope"));
    });

    // --- Scope Tests ---

    test('should allow variable shadowing in a nested scope', () => {
        const source = `
            let x: num = 10;
            function myFunc(): void {
                let x: string = "hello"; 
            }
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).not.toThrow();
    });

    test('should allow accessing a variable from an outer scope', () => {
        const source = `
            let x: num = 10;
            function myFunc(): void {
                let y: num = x;
            }
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).not.toThrow();
    });

    test('should throw an error when accessing a variable outside its scope', () => {
        const source = `
            function myFunc(): void {
                let x: num = 10;
            }
            let y: num = x;
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Symbol 'x' not found"));
    });

    test('should handle function parameters correctly', () => {
        const source = `
            function myFunc(a: num): void {
                let b: num = a; // 'a' should be visible here
            }
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).not.toThrow();
    });

    test('should throw error when accessing function parameter outside the function', () => {
        const source = `
            function myFunc(a: num): void {
                let b: num = 1;
            }
            let c: num = a; // 'a' should not be visible here
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Symbol 'a' not found"));
    });

    // --- Type Checking Tests ---

    test('should throw an error for type mismatch in variable declaration', () => {
        const source = `let x: num = "hello";`;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Type mismatch: cannot assign 'string' to 'num'"));
    });

    test('should throw an error for type mismatch in assignment', () => {
        const source = `
            let x: num = 10;
            x = "world";
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Type mismatch: cannot assign 'string' to 'num'"));
    });

    test('should throw an error for invalid types in binary expression', () => {
        const source = `let x: num = 10 + "hello";`;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Operator '+' cannot be applied to types 'num' and 'string'"));
    });

    test('should throw an error for incorrect return type', () => {
        const source = `
            function myFunc(): num {
                return "not-a-number";
            }
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Type mismatch: cannot return 'string' from a function expecting 'num'"));
    });

    // --- Function Call Tests ---

    test('should throw an error for calling an undeclared function', () => {
        const source = `nonExistentFunc();`;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Function 'nonExistentFunc' not found or not a function"));
    });

    test('should throw an error for calling a variable that is not a function', () => {
        const source = `
            let x: num = 10;
            x();
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Function 'x' not found or not a function"));
    });

    test('should throw an error for calling a function with incorrect number of arguments', () => {
        const source = `
            function myFunc(a: num, b: string): void {}
            myFunc(1);
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Function 'myFunc' expects 2 arguments, but received 1"));
    });

    test('should throw an error for calling a function with incorrect argument types', () => {
        const source = `
            function myFunc(a: num, b: string): void {}
            myFunc(1, 2);
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Type mismatch: Argument 2 for function 'myFunc' expects 'string', but received 'num'"));
    });

    // --- Control Flow Tests ---

    test('should throw an error if condition in if-statement is not a boolean', () => {
        const source = `
            if (1) {}
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("If statement condition must be a boolean, but got 'num'"));
    });

    test('should throw an error if condition in while-statement is not a boolean', () => {
        const source = `
            while ("hello") {}
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("While statement condition must be a boolean, but got 'string'"));
    });

    // --- Array Tests ---

    test('should correctly analyze an array declaration', () => {
        const source = `let arr: num[] = [1, 2, 3];`;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).not.toThrow();
    });

    test('should throw an error when indexing a non-array variable', () => {
        const source = `
            let x: num = 10;
            let y: num = x[0];
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Cannot access index of non-array type 'num'"));
    });

    test('should throw an error for non-numeric array index', () => {
        const source = `
            let arr: num[] = [1, 2];
            let y: num = arr["hello"];
        `;
        const ast = createAst(source);
        expect(() => analyzer.analyze(ast)).toThrow(new SemanticError("Array index must be of type 'num', but got 'string'"));
    });
}); 