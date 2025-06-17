// src/vm/vm.test.ts

import { VirtualMachine, InterpretResult } from './vm';
import { OpCode } from './opcodes';
import { Chunk } from './chunk';
import { CompiledFunction, ValueType, numValue, boolValue, voidValue, objectValue } from './value';

// Вспомогательная функция для создания простой CompiledFunction для тестов
function createTestFunction(name: string, chunk: Chunk): CompiledFunction {
    return {
        type: ValueType.FUNCTION_OBJ,
        name,
        arity: 0,
        numLocals: 0,
        chunk,
    };
}

describe('VirtualMachine', () => {
    let vm: VirtualMachine;

    beforeEach(() => {
        vm = new VirtualMachine();
    });

    test('should push and pop numbers correctly', () => {
        const chunk = new Chunk();
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        const constIndex = chunk.addConstant(numValue(123));
        chunk.writeShort(constIndex, 1);
        chunk.writeByte(OpCode.OP_HALT, 1);

        const mainFunc = createTestFunction('<script>', chunk);
        const result = vm.interpret(mainFunc);

        expect(result).toBe(InterpretResult.OK);
        // Ожидаем 2: mainFunc и 123
        expect(vm.getStackTop()).toBe(2);
        expect(vm.peekStack(0)).toEqual(numValue(123)); // 123 на вершине
    });

    test('should perform addition of two numbers', () => {
        const chunk = new Chunk();
        // 10
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        const constIdx10 = chunk.addConstant(numValue(10));
        chunk.writeShort(constIdx10, 1);
        // 20
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        const constIdx20 = chunk.addConstant(numValue(20));
        chunk.writeShort(constIdx20, 1);
        // ADD
        chunk.writeByte(OpCode.OP_ADD, 1);
        chunk.writeByte(OpCode.OP_HALT, 1);

        const mainFunc = createTestFunction('<script>', chunk);
        const result = vm.interpret(mainFunc);

        expect(result).toBe(InterpretResult.OK);
        // Ожидаем 2: mainFunc и результат (30)
        expect(vm.getStackTop()).toBe(2);
        expect(vm.peekStack(0)).toEqual(numValue(30));
    });

    test('should perform subtraction', () => {
        const chunk = new Chunk();
        // 30
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        chunk.writeShort(chunk.addConstant(numValue(30)), 1);
        // 5
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        chunk.writeShort(chunk.addConstant(numValue(5)), 1);
        // SUBTRACT
        chunk.writeByte(OpCode.OP_SUBTRACT, 1);
        chunk.writeByte(OpCode.OP_HALT, 1);

        const mainFunc = createTestFunction('<script>', chunk);
        const result = vm.interpret(mainFunc);

        expect(result).toBe(InterpretResult.OK);
        // Ожидаем 2: mainFunc и результат (25)
        expect(vm.getStackTop()).toBe(2);
        expect(vm.peekStack(0)).toEqual(numValue(25));
    });

    test('should perform multiplication', () => {
        const chunk = new Chunk();
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        chunk.writeShort(chunk.addConstant(numValue(7)), 1);
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        chunk.writeShort(chunk.addConstant(numValue(6)), 1);
        chunk.writeByte(OpCode.OP_MULTIPLY, 1);
        chunk.writeByte(OpCode.OP_HALT, 1);

        const mainFunc = createTestFunction('<script>', chunk);
        const result = vm.interpret(mainFunc);

        expect(result).toBe(InterpretResult.OK);
        // Ожидаем 2: mainFunc и результат (42)
        expect(vm.getStackTop()).toBe(2);
        expect(vm.peekStack(0)).toEqual(numValue(42));
    });

    test('should perform division', () => {
        const chunk = new Chunk();
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        chunk.writeShort(chunk.addConstant(numValue(100)), 1);
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        chunk.writeShort(chunk.addConstant(numValue(4)), 1);
        chunk.writeByte(OpCode.OP_DIVIDE, 1);
        chunk.writeByte(OpCode.OP_HALT, 1);

        const mainFunc = createTestFunction('<script>', chunk);
        const result = vm.interpret(mainFunc);

        expect(result).toBe(InterpretResult.OK);
        // Ожидаем 2: mainFunc и результат (25)
        expect(vm.getStackTop()).toBe(2);
        expect(vm.peekStack(0)).toEqual(numValue(25));
    });

    test('should handle division by zero', () => {
        const originalConsoleError = console.error;
        console.error = jest.fn();

        const chunk = new Chunk();
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        chunk.writeShort(chunk.addConstant(numValue(10)), 1);
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        chunk.writeShort(chunk.addConstant(numValue(0)), 1);
        chunk.writeByte(OpCode.OP_DIVIDE, 1);

        const mainFunc = createTestFunction('<script>', chunk);
        const result = vm.interpret(mainFunc);

        expect(result).toBe(InterpretResult.RUNTIME_ERROR);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Runtime Error: Division by zero."));
        // При ошибке стек может быть в непредсказуемом состоянии, или stackTop может не измениться
        // после того, как interpret вернет RUNTIME_ERROR до завершения run.
        // Поэтому здесь не проверяем getStackTop, если только нет четкого контракта.
        console.error = originalConsoleError;
    });


    test('should handle simple stack operations: PUSH_TRUE, PUSH_FALSE, PUSH_VOID, POP', () => {
        const chunk = new Chunk();
        chunk.writeByte(OpCode.OP_PUSH_TRUE, 1);    // stack: [mainFunc, true]
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);   // stack: [mainFunc, true, 42]
        chunk.writeShort(chunk.addConstant(numValue(42)), 1);
        chunk.writeByte(OpCode.OP_POP, 1);          // stack: [mainFunc, true]
        chunk.writeByte(OpCode.OP_PUSH_FALSE, 1);   // stack: [mainFunc, true, false]
        chunk.writeByte(OpCode.OP_PUSH_VOID, 1);    // stack: [mainFunc, true, false, void]
        chunk.writeByte(OpCode.OP_HALT, 1);

        const mainFunc = createTestFunction('<script>', chunk);
        const result = vm.interpret(mainFunc);

        expect(result).toBe(InterpretResult.OK);
        // Ожидаем 4: mainFunc, true, false, void
        expect(vm.getStackTop()).toBe(4);
        expect(vm.peekStack(0)).toEqual(voidValue());   // Верхний - void
        expect(vm.peekStack(1)).toEqual(boolValue(false)); // Под ним - false
        expect(vm.peekStack(2)).toEqual(boolValue(true));  // Под ним - true
        // vm.peekStack(3) будет mainFunc
    });

    test('should execute negation', () => {
        const chunk = new Chunk();
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        chunk.writeShort(chunk.addConstant(numValue(5)), 1);
        chunk.writeByte(OpCode.OP_NEGATE, 1);
        chunk.writeByte(OpCode.OP_HALT, 1);

        const mainFunc = createTestFunction('<script>', chunk);
        const result = vm.interpret(mainFunc);

        expect(result).toBe(InterpretResult.OK);
        // Ожидаем 2: mainFunc и -5
        expect(vm.getStackTop()).toBe(2);
        expect(vm.peekStack(0)).toEqual(numValue(-5));
    });

    test('should execute logical NOT', () => {
        const chunk = new Chunk();
        chunk.writeByte(OpCode.OP_PUSH_TRUE, 1);
        chunk.writeByte(OpCode.OP_NOT, 1);
        chunk.writeByte(OpCode.OP_PUSH_CONST, 1);
        chunk.writeShort(chunk.addConstant(numValue(0)), 1);
        chunk.writeByte(OpCode.OP_NOT, 1);
        chunk.writeByte(OpCode.OP_HALT, 1);

        const mainFunc = createTestFunction('<script>', chunk);
        const result = vm.interpret(mainFunc);
        expect(result).toBe(InterpretResult.OK);
        // Ожидаем 3: mainFunc, false, true
        expect(vm.getStackTop()).toBe(3);
        expect(vm.peekStack(0)).toEqual(boolValue(true));
        expect(vm.peekStack(1)).toEqual(boolValue(false));
    });

    // TODO: Добавить тесты для OP_EQUAL, OP_NOT_EQUAL, OP_GREATER, OP_LESS с разными типами
    // TODO: Добавить тесты для глобальных и локальных переменных (OP_DEFINE_GLOBAL, OP_LOAD_GLOBAL, OP_STORE_GLOBAL, OP_LOAD_LOCAL, OP_STORE_LOCAL)
    // TODO: Добавить тесты для инструкций перехода (OP_JUMP, OP_JUMP_IF_FALSE, OP_JUMP_IF_TRUE)
    // TODO: Добавить тесты для вызова функций (OP_CALL, OP_RETURN) - это будет сложнее, т.к. нужно будет создавать несколько CompiledFunction
    // TODO: Добавить тесты для массивов (OP_NEW_ARRAY, OP_ARRAY_GET, OP_ARRAY_SET)
});