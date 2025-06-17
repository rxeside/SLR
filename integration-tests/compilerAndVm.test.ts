import { Lexer } from '@src/lexer/lexer';
import { SLRParser } from '@src/slr/slr';
import { fullGrammar } from './grammars';
import { Program } from '@src/ast/entity';
import { SemanticAnalyzer } from '@src/analyzer/analyzer';
import { SymbolTable } from '@src/symbolTable/symbolTable';
import { ErrorHandler } from '@src/error/error';
import { BytecodeGenerator } from '@src/generator/bytecode_generator';
import { VirtualMachine, InterpretResult } from '@src/vm/vm';
import { numValue, boolValue, ValueType } from '@src/vm/value';

function compileAndRun(sourceCode: string): { vm: VirtualMachine; result: InterpretResult; errorHandler: ErrorHandler } {
    const errorHandler = new ErrorHandler();
    errorHandler.setSourceCode(sourceCode);

    // 1. Lexing
    const lexer = new Lexer();
    const tokens = lexer.tokenize(sourceCode, errorHandler);
    if (errorHandler.hasErrors()) {
        return { vm: new VirtualMachine(), result: InterpretResult.COMPILE_ERROR, errorHandler };
    }

    // 2. Parsing
    const parser = new SLRParser(fullGrammar, errorHandler);
    const ast = parser.parse(tokens);
    if (errorHandler.hasErrors() || !ast) {
        // console.error("Parsing errors:", errorHandler.errors);
        return { vm: new VirtualMachine(), result: InterpretResult.COMPILE_ERROR, errorHandler };
    }
    if (!(ast instanceof Program)) {
        throw new Error("Parsing did not return a Program AST node.");
    }

    // 3. Semantic Analysis
    const symbolTable = new SymbolTable();
    const analyzer = new SemanticAnalyzer(symbolTable, errorHandler); // Передаем errorHandler
    analyzer.analyze(ast);
    if (errorHandler.hasErrors()) {
        // console.error("Semantic errors:", errorHandler.errors);
        return { vm: new VirtualMachine(), result: InterpretResult.COMPILE_ERROR, errorHandler };
    }

    // 4. Bytecode Generation
    const bytecodeGenerator = new BytecodeGenerator(symbolTable);
    const mainScriptFunction = bytecodeGenerator.compile(ast);

    // 5. Virtual Machine Execution
    const vm = new VirtualMachine();
    const result = vm.interpret(mainScriptFunction);

    return { vm, result, errorHandler };
}

describe('Compiler and VM Integration (Current Analyzer Capabilities)', () => {
    test('should compile and run simple arithmetic (10 + 20 * 2)', () => {
        const sourceCode = `
            let result: num = 10 + 20 * 2; 
        `;
        const { vm, result, errorHandler } = compileAndRun(sourceCode);

        expect(errorHandler.hasErrors()).toBe(false);
        expect(result).toBe(InterpretResult.OK);

        const globalResult = vm['globals'].get('result');
        expect(globalResult).toEqual(numValue(50));
    });


    test('should compile and run if statement with supported comparisons', () => {
        const sourceCode = `
            let x: num = 10;
            let y: num = 0;
            if (x > 5) { // '>' поддерживается
                y = 100;
            } else {
                y = 200;
            }
        `;
        const { vm, result, errorHandler } = compileAndRun(sourceCode);

        expect(errorHandler.hasErrors()).toBe(false);
        expect(result).toBe(InterpretResult.OK);
        const globalY = vm['globals'].get('y');
        expect(globalY).toEqual(numValue(100));
    });

    test('should compile and run a simple function call (using "function" keyword)', () => {
        const sourceCodeFixed = `
            function add(a: num, b: num): num {
                return a + b;
            }
            let res: num = add(15, 25); 
        `;
        const { vm, result, errorHandler } = compileAndRun(sourceCodeFixed);

        if (errorHandler.hasErrors()) {
            console.log("Test 'simple function call' - Compilation/Semantic errors:", errorHandler.errors);
        }
        expect(errorHandler.hasErrors()).toBe(false);
        expect(result).toBe(InterpretResult.OK);

        const globalRes = vm['globals'].get('res');
        expect(globalRes).toEqual(numValue(40));
    });


    test('should handle variable declarations and assignments', () => {
        const sourceCode = `
            let val1: num = 100;
            let val2: bool = true;
            val1 = val1 + 50; 
            val2 = false;
        `;
        const { vm, result, errorHandler } = compileAndRun(sourceCode);
        expect(errorHandler.hasErrors()).toBe(false);
        expect(result).toBe(InterpretResult.OK);

        const globalVal1 = vm['globals'].get('val1');
        expect(globalVal1).toEqual(numValue(150));
        const globalVal2 = vm['globals'].get('val2');
        expect(globalVal2).toEqual(boolValue(false));
    });

    test('should handle supported comparisons', () => {
        // Используем только <, >, ==, !=
        const sourceCode = `
            let r1: bool = 10 > 5;  // true
            let r2: bool = 10 < 5;  // false
            let r3: bool = 10 == 10; // true
            let r4: bool = 10 != 5;  // true
        `;
        const { vm, result, errorHandler } = compileAndRun(sourceCode);
        expect(errorHandler.hasErrors()).toBe(false);
        expect(result).toBe(InterpretResult.OK);

        expect(vm['globals'].get('r1')).toEqual(boolValue(true));
        expect(vm['globals'].get('r2')).toEqual(boolValue(false));
        expect(vm['globals'].get('r3')).toEqual(boolValue(true));
        expect(vm['globals'].get('r4')).toEqual(boolValue(true));
    });
});