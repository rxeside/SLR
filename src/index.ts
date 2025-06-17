import fs from 'fs';
import path from 'path'; // Для работы с путями

// Предполагаемые пути к твоим модулям. Скорректируй, если они другие.
import { Lexer } from './lexer/lexer';
import { SLRParser } from './slr/slr';
import { fullGrammar } from '../integration-tests/grammars'; // Если грамматика здесь
// Если грамматика в другом месте, например: import { fullGrammar } from './grammar/fullGrammar';
import { Program } from './ast/entity';
import { SemanticAnalyzer } from './analyzer/analyzer';
import { SymbolTable } from './symbolTable/symbolTable';
import { ErrorHandler } from './error/error';
import { BytecodeGenerator } from './generator/bytecode_generator';
import { VirtualMachine, InterpretResult } from './vm/vm';
import { OpCode } from './vm/opcodes';
import { ValueType, VMString, CompiledFunction, VMArray, VMValue, isObject, asString, asNumber, asBoolean, asArray } from './vm/value'; // Добавил VMArray для полноты

// ФУНКЦИЯ ДЛЯ ПЕЧАТИ БАЙТ-КОДА (вставить эту функцию сюда)
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
        const sourceLine = func.chunk.lines[instructionAddress] || func.chunk.lines[instructionAddress-1] || '?'; // Более устойчивое получение строки

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
                // Преобразуем в знаковое смещение
                const signedOffset = (offset & 0x8000) ? (offset | ~0xFFFF) : offset;
                const targetAddress = instructionAddress + 1 + 2 + signedOffset; // +1 за опкод, +2 за операнд смещения
                line += ` ${signedOffset} (to ${String(targetAddress).padStart(4, '0')})`;
                i += 2;
                break;
            }
            case OpCode.OP_CALL: {
                if (i + 2 >= func.chunk.code.length) { line += ' (incomplete operand)'; break; }
                const funcIndex = (func.chunk.code[i] << 8) | func.chunk.code[i + 1];
                const argCount = func.chunk.code[i + 2];
                line += ` func_idx=${funcIndex} args=${argCount}`;
                i += 3;
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

function compileAndRunBytecode(sourceCode: string, sourceName: string = "script"): void {
    const errorHandler = new ErrorHandler();
    errorHandler.setSourceCode(sourceCode); // Передаем исходный код в ErrorHandler

    console.log("--- Lexing ---");
    const lexer = new Lexer();
    const tokens = lexer.tokenize(sourceCode, errorHandler);
    if (errorHandler.hasErrors()) {
        errorHandler.printErrors(); console.log(`Lexing failed for ${sourceName}.`); return;
    }

    console.log("\n--- Parsing ---");
    const parser = new SLRParser(fullGrammar, errorHandler);
    const ast = parser.parse(tokens);

    if (errorHandler.hasErrors() || !ast) {
        errorHandler.printErrors(); console.log(`Parsing failed for ${sourceName}.`); return;
    }
    if (!(ast instanceof Program)) {
        console.log(`Parsing did not return a Program AST node for ${sourceName}.`); return;
    }

    console.log("\n--- Semantic Analysis ---");
    const symbolTable = new SymbolTable();
    const analyzer = new SemanticAnalyzer(symbolTable, errorHandler);
    analyzer.analyze(ast);

    if (errorHandler.hasErrors()) {
        errorHandler.printErrors(); console.log(`Semantic analysis failed for ${sourceName}.`); return;
    }

    console.log("\n--- Bytecode Generation ---");
    const bytecodeGenerator = new BytecodeGenerator(symbolTable);
    const mainScriptFunction = bytecodeGenerator.compile(ast);

    console.log("--- COMPILED BYTECODE ---");
    printChunkDetailed(mainScriptFunction);
    bytecodeGenerator.getCompiledFunctions().forEach(f => {
        if (f !== mainScriptFunction && f.name !== "<script>") {
            printChunkDetailed(f);
        }
    });
    console.log("------------------------");

    console.log("\n--- Virtual Machine Execution ---");
    const vm = new VirtualMachine();
    const result = vm.interpret(mainScriptFunction);

    if (result === InterpretResult.OK) {
        console.log(`\nExecution of ${sourceName} finished successfully.`);
        if (vm.getStackTop() > 0) { // Используем геттер для stackTop
            const finalValue = vm.peekStack(0);
            console.log("Final value on stack:", finalValue ? JSON.stringify(finalValue) : 'undefined');
        } else {
            console.log("Stack is empty after execution.");
        }
    } else if (result === InterpretResult.RUNTIME_ERROR) {
        console.log(`\nExecution of ${sourceName} failed with runtime error.`);
    }
}

function main() {
    const filePathArg = process.argv[2];
    if (!filePathArg) {
        console.error("Please provide a path to the source file to compile and run.");
        process.exit(1);
    }

    const filePath = path.resolve(filePathArg);

    try {
        if (!fs.existsSync(filePath)) {
            console.error(`Error: File not found at ${filePath}`);
            process.exit(1);
        }
        console.log(`Compiling and running: ${filePath}\n`);
        const sourceCode = fs.readFileSync(filePath, 'utf-8');
        compileAndRunBytecode(sourceCode, path.basename(filePath));
    } catch (error: any) {
        console.error(`Error processing file ${filePath}: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();