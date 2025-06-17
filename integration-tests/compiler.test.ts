import { Lexer } from '../src/lexer/lexer';
import { SLRParser } from '../src/slr/slr';
import { Program, VarDecl, Literal, IfStmt, Block, BinaryExpr, Identifier, WhileStmt, CallExpr, ArrayLiteral, ArrayAccess } from '../src/ast/entity';
import { fullGrammar } from './grammars';
import { ErrorHandler } from '../src/error/error';

describe('Compiler Integration Tests', () => {

    const parseWithNoErrors = (input: string): Program => {
        const errorHandler = new ErrorHandler();
        const lexer = new Lexer();
        const tokens = lexer.tokenize(input, errorHandler);
        const parser = new SLRParser(fullGrammar, errorHandler);
        const ast = parser.parse(tokens);

        if (errorHandler.hasErrors()) {
            errorHandler.printErrors();
        }

        expect(errorHandler.hasErrors()).toBe(false);
        expect(ast).toBeInstanceOf(Program);
        return ast as Program;
    };

    test('should parse a simple variable declaration and build a correct AST', () => {
        const input = 'let x : num = 42;';
        const program = parseWithNoErrors(input);

        // 2. Check the program statements
        expect(program.statements).toHaveLength(1);
        const stmt = program.statements[0];

        // 3. Check if the statement is a VarDecl
        expect(stmt).toBeInstanceOf(VarDecl);
        const varDecl = stmt as VarDecl;

        // 4. Check the properties of the VarDecl
        expect(varDecl.name).toBe('x');
        expect(varDecl.type).toBe('num');
        
        // 5. Check the initializer
        expect(varDecl.initializer).toBeInstanceOf(Literal);
        const literal = varDecl.initializer as Literal;
        expect(literal.value).toBe(42);
    });

    test('should handle a simple function declaration', () => {
        const input = 'function main(): void {}';
        const ast = parseWithNoErrors(input);
        expect(ast).toBeInstanceOf(Program);
        // Add more detailed checks for FuncDecl if necessary
    });

    test('should handle an if-else statement with expressions', () => {
        const input = `
            if (x > 10) {
                let a: num = 1;
            } else {
                let b: num = 2;
            }
        `;
        const program = parseWithNoErrors(input);

        expect(program.statements).toHaveLength(1);
        const stmt = program.statements[0];

        expect(stmt).toBeInstanceOf(IfStmt);
        const ifStmt = stmt as IfStmt;

        // Check condition
        expect(ifStmt.condition).toBeInstanceOf(BinaryExpr);
        const condition = ifStmt.condition as BinaryExpr;
        expect(condition.operator).toBe('>');
        expect(condition.left).toMatchObject({ name: 'x' });
        expect(condition.right).toMatchObject({ value: 10 });

        // Check then branch
        expect(ifStmt.thenBranch).toBeInstanceOf(Block);
        expect(ifStmt.thenBranch.statements).toHaveLength(1);
        const thenDecl = ifStmt.thenBranch.statements[0] as VarDecl;
        expect(thenDecl.name).toBe('a');
        expect(thenDecl.initializer).toMatchObject({ value: 1 });

        // Check else branch
        expect(ifStmt.elseBranch).toBeInstanceOf(Block);
        expect(ifStmt.elseBranch?.statements).toHaveLength(1);
        const elseDecl = ifStmt.elseBranch?.statements[0] as VarDecl;
        expect(elseDecl.name).toBe('b');
        expect(elseDecl.initializer).toMatchObject({ value: 2 });
    });

    test('should correctly parse operator precedence in expressions', () => {
        const input = 'let result: num = 10 + 2 * 5;';
        const program = parseWithNoErrors(input);
        const varDecl = program.statements[0] as VarDecl;
        
        // AST should be: VarDecl -> BinaryExpr(+) -> left: Literal(10), right: BinaryExpr(*)
        expect(varDecl.initializer).toBeInstanceOf(BinaryExpr);
        const addExpr = varDecl.initializer as BinaryExpr;
        expect(addExpr.operator).toBe('+');
        expect(addExpr.left).toMatchObject({ value: 10 });

        expect(addExpr.right).toBeInstanceOf(BinaryExpr);
        const mulExpr = addExpr.right as BinaryExpr;
        expect(mulExpr.operator).toBe('*');
        expect(mulExpr.left).toMatchObject({ value: 2 });
        expect(mulExpr.right).toMatchObject({ value: 5 });
    });

    test('should handle a while statement', () => {
        const input = `
            while (i < 100) {
                let i: num = i + 1;
            }
        `;
        const program = parseWithNoErrors(input);

        expect(program.statements).toHaveLength(1);
        const stmt = program.statements[0];

        expect(stmt).toBeInstanceOf(WhileStmt);
        const whileStmt = stmt as WhileStmt;

        // Check condition
        expect(whileStmt.condition).toBeInstanceOf(BinaryExpr);
        const condition = whileStmt.condition as BinaryExpr;
        expect(condition.operator).toBe('<');
        expect(condition.left).toMatchObject({ name: 'i' });
        expect(condition.right).toMatchObject({ value: 100 });

        // Check body
        expect(whileStmt.body).toBeInstanceOf(Block);
        expect(whileStmt.body.statements).toHaveLength(1);
        const varDecl = whileStmt.body.statements[0] as VarDecl;
        expect(varDecl.name).toBe('i');
        expect(varDecl.initializer).toBeInstanceOf(BinaryExpr);
    });

    test('should handle a function call with arguments', () => {
        const input = `
            function myFunc(a: num, b: string): void {}
            myFunc(42, "hello");
        `;
        const program = parseWithNoErrors(input);

        expect(program.statements).toHaveLength(2);
        const funcCallStmt = program.statements[1];

        expect(funcCallStmt).toBeInstanceOf(CallExpr);
        const callExpr = funcCallStmt as CallExpr;

        expect(callExpr.callee).toBe('myFunc');
        expect(callExpr.args).toHaveLength(2);
        expect(callExpr.args[0]).toMatchObject({ value: 42 });
        expect(callExpr.args[1]).toMatchObject({ value: 'hello' });
    });

    test('should handle array declaration and literals', () => {
        const input = 'let myArray: num[] = [1, 2, 3];';
        const program = parseWithNoErrors(input);

        const varDecl = program.statements[0] as VarDecl;
        expect(varDecl.name).toBe('myArray');
        expect(varDecl.type).toBe('num[]');
        
        expect(varDecl.initializer).toBeInstanceOf(ArrayLiteral);
        const arrayLiteral = varDecl.initializer as ArrayLiteral;
        expect(arrayLiteral.elements).toHaveLength(3);
        expect(arrayLiteral.elements[0]).toMatchObject({ value: 1 });
        expect(arrayLiteral.elements[1]).toMatchObject({ value: 2 });
        expect(arrayLiteral.elements[2]).toMatchObject({ value: 3 });
    });

    test('should handle array access', () => {
        const input = 'let x: num = myArray[0];';
        const program = parseWithNoErrors(input);
        
        const varDecl = program.statements[0] as VarDecl;
        expect(varDecl.name).toBe('x');
        
        expect(varDecl.initializer).toBeInstanceOf(ArrayAccess);
        const arrayAccess = varDecl.initializer as ArrayAccess;
        expect(arrayAccess.array).toMatchObject({ name: 'myArray' });
        expect(arrayAccess.index).toMatchObject({ value: 0 });
    });
}); 