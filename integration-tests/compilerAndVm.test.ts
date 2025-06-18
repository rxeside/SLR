import { Lexer } from '@src/lexer/lexer';
import { SLRParser } from '@src/slr/slr';
import { fullGrammar } from './grammars';
import { Program } from '@src/ast/entity';
import { SemanticAnalyzer } from '@src/analyzer/analyzer';
import { SymbolTable } from '@src/symbolTable/symbolTable';
import { ErrorHandler } from '@src/error/error';
import { BytecodeGenerator } from '@src/generator/bytecode_generator';
import { VirtualMachine, InterpretResult } from '@src/vm/vm';
import {
    numValue,
    boolValue,
    ValueType,
    VMArray,
    CompiledFunction,
    asNumber,
    asBoolean,
    asString,
    asArray
} from '@src/vm/value';
import { OpCode } from "../src/vm/opcodes";

function printChunkDetailed(func: CompiledFunction) {
    console.log(`\n--- Function: ${func.name} (Arity: ${func.arity}, Locals: ${func.numLocals}) ---`);

    if (func.chunk.constants.length > 0) {
        console.log(" Constants:");
        func.chunk.constants.forEach((constant, index) => {
            let constStr = `  [${index}] = `;
            if (!constant) { constStr += 'undefined_constant_entry'; console.log(constStr); return; }
            switch (constant.type) {
                case ValueType.NUM: constStr += `${asNumber(constant)}`; break;
                case ValueType.BOOL: constStr += `${asBoolean(constant)}`; break;
                case ValueType.VOID: constStr += `void`; break;
                case ValueType.STRING_OBJ: constStr += `"${asString(constant)}"`; break;
                case ValueType.FUNCTION_OBJ: constStr += `<Function: ${(constant.as.obj as CompiledFunction).name}>`; break;
                case ValueType.ARRAY_OBJ: constStr += `<Array: len=${(asArray(constant)).elements.length}>`; break;
                default: constStr += `unknown_value_type (${constant.type})`;
            }
            console.log(constStr);
        });
    } else {
        console.log(" Constants: (none)");
    }

    console.log(" Code:");
    let i = 0;
    while (i < func.chunk.code.length) {
        const instructionAddress = i;
        const op = func.chunk.code[i] as OpCode;
        let line = `  ${String(instructionAddress).padStart(4, '0')} | ${OpCode[op] ? OpCode[op].padEnd(18) : `UNKNOWN(0x${op.toString(16)})`.padEnd(18)}`;
        const sourceLine = func.chunk.lines[instructionAddress] || func.chunk.lines[instructionAddress-1] || '?';

        i++;

        switch (op) {
            case OpCode.OP_PUSH_CONST:
            case OpCode.OP_DEFINE_GLOBAL:
            case OpCode.OP_LOAD_GLOBAL:
            case OpCode.OP_STORE_GLOBAL: {
                if (i + 1 >= func.chunk.code.length) { line += ' (incomplete operand)'; break; }
                const operand = (func.chunk.code[i] << 8) | func.chunk.code[i + 1];
                line += ` ${operand}`;
                i += 2;
                break;
            }
            case OpCode.OP_LOAD_LOCAL:
            case OpCode.OP_STORE_LOCAL: {
                if (i >= func.chunk.code.length) { line += ' (incomplete operand)'; break; }
                const operand = func.chunk.code[i];
                line += ` ${operand}`;
                i++;
                break;
            }
            case OpCode.OP_JUMP:
            case OpCode.OP_JUMP_IF_FALSE:
            case OpCode.OP_JUMP_IF_TRUE: {
                if (i + 1 >= func.chunk.code.length) { line += ' (incomplete operand)'; break; }
                const offset = (func.chunk.code[i] << 8) | func.chunk.code[i + 1];
                const signedOffset = (offset & 0x8000) ? (offset | ~0xFFFF) : offset;
                const targetAddress = instructionAddress + 1 + 2 + signedOffset;
                line += ` ${signedOffset} (to ${String(targetAddress).padStart(4, '0')})`;
                i += 2;
                break;
            }
            case OpCode.OP_CALL: {
                if (i >= func.chunk.code.length) { line += ' (incomplete operand)'; break; }
                const argCount = func.chunk.code[i];
                line += ` args=${argCount}`;
                i++;
                break;
            }
            case OpCode.OP_NEW_ARRAY: {
                if (i + 1 >= func.chunk.code.length) { line += ' (incomplete operand)'; break; }
                const numElements = (func.chunk.code[i] << 8) | func.chunk.code[i + 1];
                line += ` ${numElements}`;
                i += 2;
                break;
            }
        }
        console.log(`${line.padEnd(50)} ; line ${sourceLine}`);
    }
}

function compileAndRun(sourceCode: string): { vm: VirtualMachine; result: InterpretResult; errorHandler: ErrorHandler } {
    const errorHandler = new ErrorHandler();
    errorHandler.setSourceCode(sourceCode);

    const lexer = new Lexer();
    const tokens = lexer.tokenize(sourceCode, errorHandler);
    if (errorHandler.hasErrors()) {
        return { vm: new VirtualMachine(), result: InterpretResult.COMPILE_ERROR, errorHandler };
    }

    const parser = new SLRParser(fullGrammar, errorHandler);
    const ast = parser.parse(tokens);
    if (errorHandler.hasErrors() || !ast) {
        return { vm: new VirtualMachine(), result: InterpretResult.COMPILE_ERROR, errorHandler };
    }
    if (!(ast instanceof Program)) {
        throw new Error("Parsing did not return a Program AST node.");
    }

    const symbolTable = new SymbolTable();
    const analyzer = new SemanticAnalyzer(symbolTable, errorHandler);
    analyzer.analyze(ast);
    if (errorHandler.hasErrors()) {
        return { vm: new VirtualMachine(), result: InterpretResult.COMPILE_ERROR, errorHandler };
    }

    const bytecodeGenerator = new BytecodeGenerator(symbolTable);
    const mainScriptFunction = bytecodeGenerator.compile(ast);
    console.log("COMPILED");
    printChunkDetailed(mainScriptFunction);
    bytecodeGenerator.getCompiledFunctions().forEach(f => {
        if (f.name === "bubbleSort") {
            console.log("--- COMPILED bubbleSort ---");
            printChunkDetailed(f);
        }
    });

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
            if (x > 5) {
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
        const sourceCode = `
            let r1: bool = 10 > 5;
            let r2: bool = 10 < 5;
            let r3: bool = 10 == 10;
            let r4: bool = 10 != 5;
        `;
        const { vm, result, errorHandler } = compileAndRun(sourceCode);
        expect(errorHandler.hasErrors()).toBe(false);
        expect(result).toBe(InterpretResult.OK);

        expect(vm['globals'].get('r1')).toEqual(boolValue(true));
        expect(vm['globals'].get('r2')).toEqual(boolValue(false));
        expect(vm['globals'].get('r3')).toEqual(boolValue(true));
        expect(vm['globals'].get('r4')).toEqual(boolValue(true));
    });

    test('should compile and run bubble sort on an array', () => {
        const sourceCode = `
    function bubbleSort(arr: num[], len: num): void {
        let i: num = 0;
        let j: num = 0;
        let temp: num = 0;
        let swapped: bool = true;

        while (swapped) {
            swapped = false;
            j = 0;
            while (j < len - 1) {
                if (arr[j] > arr[j + 1]) { 
                    temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                    swapped = true;
                }
                j = j + 1;
            }
            len = len - 1; 
        }
    }

    let data: num[] = [5, 1, 4, 2, 8];
    bubbleSort(data, 5); 
`;

        const { vm, result, errorHandler } = compileAndRun(sourceCode);

        if (errorHandler.hasErrors()) {
            console.log("Bubble Sort Test - Compilation/Semantic errors:", errorHandler.errors);
        }
        expect(errorHandler.hasErrors()).toBe(false);
        expect(result).toBe(InterpretResult.OK);

        const sortedArrayGlobal = vm['globals'].get('data');
        expect(sortedArrayGlobal).toBeDefined();
        expect(sortedArrayGlobal?.type).toBe(ValueType.ARRAY_OBJ);

        const vmArray = sortedArrayGlobal?.as.obj as VMArray;
        console.log("Array 'data' after sort in VM:", vmArray.elements.map(e => e?.as?.number));
        expect(vmArray).toBeDefined();
        expect(vmArray.elements.length).toBe(5);

        const expectedSorted = [1, 2, 4, 5, 8];
        for (let k = 0; k < expectedSorted.length; k++) {
            expect(vmArray.elements[k].type).toBe(ValueType.NUM);
            expect(vmArray.elements[k].as.number).toBe(expectedSorted[k]);
        }
    });
});