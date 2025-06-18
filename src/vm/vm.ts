import { OpCode } from './opcodes';
import { Chunk } from './chunk';
import {
    VMValue, ValueType, CompiledFunction, VMString, VMArray,
    asNumber, asBoolean, asObject, asString, asArray, asFunction,
    numValue, boolValue, voidValue, objectValue, isNumber, isBoolean, isVoid, isObject
} from './value';

const STACK_MAX = 256 * 4;
const FRAMES_MAX = 64;

interface CallFrame {
    func: CompiledFunction;
    ip: number;
    slotsOffset: number;
}

export enum InterpretResult {
    OK,
    COMPILE_ERROR,
    RUNTIME_ERROR,
}

export class VirtualMachine {
    private frames: CallFrame[];
    private frameCount: number;
    private stack: VMValue[];
    private stackTop: number;
    private globals: Map<string, VMValue>;

    constructor() {
        this.frames = new Array(FRAMES_MAX);
        this.frameCount = 0;
        this.stack = new Array(STACK_MAX);
        this.stackTop = 0;
        this.globals = new Map();
    }

    public getStackTop(): number {
        return this.stackTop;
    }

    public peekStack(distance: number): VMValue | undefined {
        if (this.stackTop - 1 - distance < 0 || this.stackTop - 1 - distance >= this.stackTop) {
            return undefined;
        }
        return this.stack[this.stackTop - 1 - distance];
    }

    public interpret(mainFunction: CompiledFunction): InterpretResult {
        if (!mainFunction || !mainFunction.chunk) {
            console.error("[VM] Error: Main function or its chunk is undefined.");
            return InterpretResult.RUNTIME_ERROR;
        }

        this.stackTop = 0;
        this.frameCount = 0;
        this.globals.clear();

        this.push(objectValue(mainFunction));

        if (!this.callFunction(mainFunction, 0)) {
            return InterpretResult.RUNTIME_ERROR;
        }

        return this.run();
    }

    private currentFrame(): CallFrame {
        if (this.frameCount === 0) {
            throw new Error("VM Critical: Attempted to access currentFrame with no active frames.");
        }
        return this.frames[this.frameCount - 1];
    }

    private currentChunk(): Chunk {
        return this.currentFrame().func.chunk;
    }

    private readByte(): number {
        const frame = this.currentFrame();
        console.log(`[VM_READBYTE] Trying to read from func '${frame.func.name}', ip: ${frame.ip}, chunk_len: ${frame.func.chunk.code.length}`);
        if (frame.ip >= frame.func.chunk.code.length) {
            this.runtimeError("Attempted to read byte past end of chunk.");
            throw new Error("VM IP out of bounds.");
        }
        return frame.func.chunk.code[frame.ip++];
    }

    private readShort(): number {
        const frame = this.currentFrame();
        if (frame.ip + 1 >= frame.func.chunk.code.length) {
            this.runtimeError("Attempted to read short past end of chunk.");
            throw new Error("VM IP out of bounds for short.");
        }
        const highByte = frame.func.chunk.code[frame.ip];
        const lowByte = frame.func.chunk.code[frame.ip + 1];
        frame.ip += 2;

        const rawValue = (highByte << 8) | lowByte;

        if ((rawValue & 0x8000) !== 0) {
            return (rawValue << 16) >> 16;
        } else {
            return rawValue;
        }
    }

    private readConstant(): VMValue {
        const constIndex = this.readShort();
        const chunk = this.currentChunk();
        if (constIndex >= chunk.constants.length) {
            this.runtimeError(`Invalid constant index ${constIndex}. Max is ${chunk.constants.length -1}.`);
            throw new Error("VM constant index out of bounds.");
        }
        return chunk.constants[constIndex];
    }

    private push(value: VMValue): void {
        if (this.stackTop >= STACK_MAX) {
            this.runtimeError("Stack overflow.");
            throw new Error("VM Stack Overflow internal error");
        }
        this.stack[this.stackTop++] = value;
    }

    private pop(): VMValue {
        if (this.stackTop === 0) {
            this.runtimeError("Stack underflow (popping empty stack).");
            throw new Error("VM Stack Underflow internal error");
        }
        this.stackTop--;
        const value = this.stack[this.stackTop];
        return value;
    }

    private peek(distance: number): VMValue {
        const index = this.stackTop - 1 - distance;
        if (index < 0 || index >= this.stackTop) {
            this.runtimeError(`Stack underflow (peeking at distance ${distance}, index ${index}, top ${this.stackTop}).`);
            throw new Error("VM Stack Peek Underflow internal error");
        }
        return this.stack[index];
    }

    private callFunction(funcToCall: CompiledFunction, argCount: number): boolean {
        if (argCount !== funcToCall.arity) {
            this.runtimeError(
                `Function '${funcToCall.name}' expected ${funcToCall.arity} arguments but got ${argCount}.`
            );
            return false;
        }
        if (this.frameCount >= FRAMES_MAX) {
            this.runtimeError("Stack overflow (frames).");
            return false;
        }

        const frame: CallFrame = {
            func: funcToCall,
            ip: 0,
            slotsOffset: this.stackTop - argCount - 1,
        };
        this.frames[this.frameCount++] = frame;

        const numPureLocals = funcToCall.numLocals - funcToCall.arity;
        for (let i = 0; i < numPureLocals; i++) {
            this.push(voidValue());
        }

        return true;
    }

    private runtimeError(message: string, ...args: any[]): void {
        console.error(`\nRuntime Error: ${message}`, ...args);
        for (let i = this.frameCount - 1; i >= 0; i--) {
            const frame = this.frames[i];
            const func = frame.func;
            const instructionPointerForLine = Math.max(0, frame.ip > 0 ? frame.ip -1 : 0);
            const sourceLine = func.chunk.lines[instructionPointerForLine] || "?";
            console.error(`  [line ${sourceLine}] in ${func.name || '<script>'}`);
        }
    }

    private isTruthy(value: VMValue): boolean {
        if (!value) return false;
        switch (value.type) {
            case ValueType.BOOL: return asBoolean(value);
            case ValueType.VOID: return false;
            case ValueType.NUM: return asNumber(value) !== 0;
            case ValueType.STRING_OBJ:
            case ValueType.ARRAY_OBJ:
            case ValueType.FUNCTION_OBJ:
                return true;
            default: return false;
        }
    }

    private run(): InterpretResult {
        let frame = this.currentFrame();

        while (true) {
            const instructionAddress = frame.ip;
            const instruction = this.readByte() as OpCode;
            const DEBUG_VM = true;
            if (DEBUG_VM) {
                let debugLine = `[VM] ${String(instructionAddress).padStart(4, '0')} | ${OpCode[instruction] ? OpCode[instruction].padEnd(18) : `UNKNOWN(0x${instruction.toString(16)})`.padEnd(18)}`;
                const stackSlice = this.stack.slice(0, this.stackTop).map(v => {
                    if (!v) return 'undef_slot';
                    switch (v.type) {
                        case ValueType.NUM: return v.as.number;
                        case ValueType.BOOL: return v.as.boolean;
                        case ValueType.VOID: return 'void';
                        case ValueType.STRING_OBJ: return `"${(v.as.obj as VMString).value}"`;
                        case ValueType.FUNCTION_OBJ: return `<Fn:${(v.as.obj as CompiledFunction).name}>`;
                        case ValueType.ARRAY_OBJ:
                            const debugStackArr = v.as.obj as VMArray;
                            const stackElementsStr = debugStackArr.elements.slice(0, 5).map(el => {
                                if (!el) return 'undef_el_val';
                                if (el.type === ValueType.NUM) return el.as.number;
                                return `?${ValueType[el.type]}`;
                            }).join(',');
                            return `<Arr[${debugStackArr.elements.length}](${stackElementsStr}${debugStackArr.elements.length > 5 ? '...' : ''})>`;
                        default: return `?type(${v.type})`;
                    }
                });
                debugLine += `| Stack: [${stackSlice.join(', ')}]`;

                const locals = [];
                for (let i = 0; i < frame.func.numLocals; i++) {
                    const localVal = this.stack[frame.slotsOffset + 1 + i];
                    if (!localVal) { locals.push(`L${i}=undef_slot`); continue; }
                    switch (localVal.type) {
                        case ValueType.NUM: locals.push(`L${i}=${localVal.as.number}`); break;
                        case ValueType.BOOL: locals.push(`L${i}=${localVal.as.boolean}`); break;
                        case ValueType.VOID: locals.push(`L${i}=void`); break;
                        case ValueType.STRING_OBJ: locals.push(`L${i}="${(localVal.as.obj as VMString).value}"`); break;
                        case ValueType.FUNCTION_OBJ: locals.push(`L${i}=<Fn:${(localVal.as.obj as CompiledFunction).name}>`); break;
                        case ValueType.ARRAY_OBJ:
                            const debugLocalArr = localVal.as.obj as VMArray;
                            let localElementsStr = debugLocalArr.elements.slice(0, 5).map(el => {
                                if (!el) return 'undef_el_val';
                                if (el.type === ValueType.NUM) return el.as.number;
                                return `?${ValueType[el.type]}`;
                            }).join(',');
                            locals.push(`<Arr[${debugLocalArr.elements.length}](${localElementsStr}${debugLocalArr.elements.length > 5 ? '...' : ''})>`);
                            break;
                        default: locals.push(`L${i}=?type(${localVal.type})`);
                    }
                }

                if (locals.length > 0) debugLine += ` | Locals(slot0=func): {${locals.join(', ')}}`;
                console.log(debugLine);
            }

            try {
                switch (instruction) {
                    case OpCode.OP_HALT:
                        return InterpretResult.OK;

                    case OpCode.OP_PUSH_CONST: {
                        const constant = this.readConstant();
                        this.push(constant);
                        break;
                    }
                    case OpCode.OP_PUSH_TRUE:  this.push(boolValue(true)); break;
                    case OpCode.OP_PUSH_FALSE: this.push(boolValue(false)); break;
                    case OpCode.OP_PUSH_VOID:  this.push(voidValue()); break;

                    case OpCode.OP_POP: this.pop(); break;

                    case OpCode.OP_ADD:
                    case OpCode.OP_SUBTRACT:
                    case OpCode.OP_MULTIPLY:
                    case OpCode.OP_DIVIDE:
                    case OpCode.OP_EQUAL:
                    case OpCode.OP_NOT_EQUAL:
                    case OpCode.OP_GREATER:
                    case OpCode.OP_LESS: {
                        const bVal = this.pop();
                        const aVal = this.pop();

                        if (instruction >= OpCode.OP_ADD && instruction <= OpCode.OP_DIVIDE) {
                            if (!isNumber(aVal) || !isNumber(bVal)) {
                                this.runtimeError(`Operands must be numbers for arithmetic operation. Got ${ValueType[aVal.type]} and ${ValueType[bVal.type]}.`);
                                return InterpretResult.RUNTIME_ERROR;
                            }
                            const a = asNumber(aVal);
                            const b = asNumber(bVal);
                            switch (instruction) {
                                case OpCode.OP_ADD:
                                    if (aVal.type === ValueType.STRING_OBJ || bVal.type === ValueType.STRING_OBJ) {
                                        this.runtimeError("String concatenation not yet supported with '+' for numbers, cast explicitly.");
                                        return InterpretResult.RUNTIME_ERROR;
                                    }
                                    this.push(numValue(a + b)); break;
                                case OpCode.OP_SUBTRACT: this.push(numValue(a - b)); break;
                                case OpCode.OP_MULTIPLY: this.push(numValue(a * b)); break;
                                case OpCode.OP_DIVIDE:
                                    if (b === 0) {
                                        this.runtimeError("Division by zero.");
                                        return InterpretResult.RUNTIME_ERROR;
                                    }
                                    this.push(numValue(a / b));
                                    break;
                            }
                        }
                        else if (instruction >= OpCode.OP_EQUAL && instruction <= OpCode.OP_LESS) {
                            let result = false;
                            if (aVal.type === ValueType.NUM && bVal.type === ValueType.NUM) {
                                const a = asNumber(aVal);
                                const b = asNumber(bVal);
                                switch (instruction) {
                                    case OpCode.OP_EQUAL: result = a === b; break;
                                    case OpCode.OP_NOT_EQUAL: result = a !== b; break;
                                    case OpCode.OP_GREATER: result = a > b; break;
                                    case OpCode.OP_LESS: result = a < b; break;
                                }
                            } else if (aVal.type === ValueType.BOOL && bVal.type === ValueType.BOOL) {
                                if (instruction === OpCode.OP_EQUAL) result = asBoolean(aVal) === asBoolean(bVal);
                                else if (instruction === OpCode.OP_NOT_EQUAL) result = asBoolean(aVal) !== asBoolean(bVal);
                                else { this.runtimeError("Cannot apply <, > to booleans."); return InterpretResult.RUNTIME_ERROR;}
                            } else if (aVal.type === ValueType.STRING_OBJ && bVal.type === ValueType.STRING_OBJ) {
                                const strA = (aVal.as.obj as VMString).value;
                                const strB = (bVal.as.obj as VMString).value;
                                if (instruction === OpCode.OP_EQUAL) result = strA === strB;
                                else if (instruction === OpCode.OP_NOT_EQUAL) result = strA !== strB;
                                else { this.runtimeError("Cannot apply <, > to strings yet (lexicographical needed)."); return InterpretResult.RUNTIME_ERROR;}
                            } else if (aVal.type === ValueType.VOID && bVal.type === ValueType.VOID) {
                                if (instruction === OpCode.OP_EQUAL) result = true;
                                else if (instruction === OpCode.OP_NOT_EQUAL) result = false;
                                else { this.runtimeError(`Cannot apply <, > to void values.`); return InterpretResult.RUNTIME_ERROR; }
                            } else if (isObject(aVal) && isObject(bVal)) {
                                if (instruction === OpCode.OP_EQUAL) result = aVal.as.obj === bVal.as.obj;
                                else if (instruction === OpCode.OP_NOT_EQUAL) result = aVal.as.obj !== bVal.as.obj;
                                else { this.runtimeError(`Cannot apply <, > to object types ${ValueType[aVal.type]} and ${ValueType[bVal.type]} by reference.`); return InterpretResult.RUNTIME_ERROR; }
                            }
                            else {
                                if (aVal.type === ValueType.VOID || bVal.type === ValueType.VOID) {
                                    if (instruction === OpCode.OP_EQUAL) result = false;
                                    else if (instruction === OpCode.OP_NOT_EQUAL) result = true;
                                    else { this.runtimeError(`Cannot compare void with ${ValueType[aVal.type === ValueType.VOID ? bVal.type : aVal.type]} using < or >.`); return InterpretResult.RUNTIME_ERROR; }
                                } else {
                                    if (instruction === OpCode.OP_EQUAL) result = false;
                                    else if (instruction === OpCode.OP_NOT_EQUAL) result = true;
                                    else {
                                        this.runtimeError(`Cannot compare types ${ValueType[aVal.type]} and ${ValueType[bVal.type]} with this operator.`);
                                        return InterpretResult.RUNTIME_ERROR;
                                    }
                                }
                            }
                            this.push(boolValue(result));
                        }
                        break;
                    }
                    case OpCode.OP_NEGATE: {
                        const val = this.peek(0);
                        if (!isNumber(val)) {
                            this.runtimeError("Operand must be a number for negation.");
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        this.stack[this.stackTop - 1] = numValue(-asNumber(val));
                        break;
                    }
                    case OpCode.OP_NOT: {
                        const val = this.pop();
                        this.push(boolValue(!this.isTruthy(val)));
                        break;
                    }

                    case OpCode.OP_DEFINE_GLOBAL: {
                        const nameConstant = this.readConstant();
                        if (nameConstant.type !== ValueType.STRING_OBJ) {
                            this.runtimeError("Global variable name is not a string constant.");
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        const globalName = (nameConstant.as.obj as VMString).value;
                        this.globals.set(globalName, this.peek(0));
                        break;
                    }
                    case OpCode.OP_LOAD_GLOBAL: {
                        const nameConstant = this.readConstant();
                        if (nameConstant.type !== ValueType.STRING_OBJ) {
                            this.runtimeError("Global variable name is not a string constant.");
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        const globalName = (nameConstant.as.obj as VMString).value;
                        const value = this.globals.get(globalName);
                        if (value === undefined) {
                            this.runtimeError(`Undefined global variable '${globalName}'.`);
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        this.push(value);
                        break;
                    }
                    case OpCode.OP_STORE_GLOBAL: {
                        const nameConstant = this.readConstant();
                        if (nameConstant.type !== ValueType.STRING_OBJ) {
                            this.runtimeError("Global variable name is not a string constant.");
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        const globalName = (nameConstant.as.obj as VMString).value;
                        if (!this.globals.has(globalName)) {
                            this.runtimeError(`Cannot store to undefined global variable '${globalName}'. Use 'let' to define.`);
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        this.globals.set(globalName, this.peek(0));
                        break;
                    }
                    case OpCode.OP_LOAD_LOCAL: {
                        const slot = this.readByte();
                        this.push(this.stack[frame.slotsOffset + 1 + slot]);
                        break;
                    }
                    case OpCode.OP_STORE_LOCAL: {
                        const slot = this.readByte();
                        this.stack[frame.slotsOffset + 1 + slot] = this.peek(0);
                        break;
                    }

                    case OpCode.OP_JUMP: {
                        const offset = this.readShort();
                        frame.ip += offset;
                        break;
                    }
                    case OpCode.OP_JUMP_IF_FALSE: {
                        const offset = this.readShort();
                        if (!this.isTruthy(this.peek(0))) {
                            frame.ip += offset;
                        }
                        break;
                    }
                    case OpCode.OP_JUMP_IF_TRUE: {
                        const offset = this.readShort();
                        if (this.isTruthy(this.peek(0))) {
                            frame.ip += offset;
                        }
                        break;
                    }

                    case OpCode.OP_CALL: {
                        const argCount = this.readByte();
                        const calleeValue = this.peek(argCount);
                        if (!calleeValue || calleeValue.type !== ValueType.FUNCTION_OBJ) {
                            this.runtimeError(`Can only call functions and procedures. Found type ${calleeValue ? ValueType[calleeValue.type] : 'undefined'}.`);
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        const funcToCall = asFunction(calleeValue);
                        if (!this.callFunction(funcToCall, argCount)) {
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        frame = this.currentFrame();
                        break;
                    }
                    case OpCode.OP_RETURN: {
                        const result = this.pop();
                        this.frameCount--;
                        if (this.frameCount === 0) {
                            this.pop();
                            return InterpretResult.OK;
                        }
                        this.stackTop = frame.slotsOffset;
                        this.push(result);
                        frame = this.currentFrame();
                        break;
                    }

                    case OpCode.OP_NEW_ARRAY: {
                        const numElements = this.readShort();
                        const elements: VMValue[] = [];
                        for (let i = 0; i < numElements; i++) {
                            elements.unshift(this.pop());
                        }
                        const arrayObj: VMArray = { type: ValueType.ARRAY_OBJ, elements };
                        this.push(objectValue(arrayObj));
                        break;
                    }
                    case OpCode.OP_ARRAY_GET: {
                        const indexVal = this.pop();
                        const arrayVal = this.pop();
                        console.log('[VM OP_ARRAY_GET] arrayVal type:', ValueType[arrayVal.type], 'indexVal type:', ValueType[indexVal.type]);
                        if (!isNumber(indexVal)) {
                            this.runtimeError("Array index must be a number."); return InterpretResult.RUNTIME_ERROR;
                        }
                        if (arrayVal.type !== ValueType.ARRAY_OBJ) {
                            this.runtimeError("Can only index arrays."); return InterpretResult.RUNTIME_ERROR;
                        }
                        const index = asNumber(indexVal);
                        const array = asArray(arrayVal);
                        if (index < 0 || index >= array.elements.length || !Number.isInteger(index)) {
                            this.runtimeError(`Array index out of bounds: ${index} for length ${array.elements.length}.`);
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        this.push(array.elements[index]);
                        break;
                    }
                    case OpCode.OP_ARRAY_SET: {
                        const valueToSet = this.pop();
                        const indexVal = this.pop();
                        const arrayVal = this.pop();
                        console.log('[VM OP_ARRAY_SET] arrayVal type:', ValueType[arrayVal.type], 'indexVal type:', ValueType[indexVal.type], 'valueToSet type:', ValueType[valueToSet.type]);

                        if (!isNumber(indexVal)) {
                            this.runtimeError("Array index must be a number."); return InterpretResult.RUNTIME_ERROR;
                        }
                        if (arrayVal.type !== ValueType.ARRAY_OBJ) {
                            this.runtimeError("Can only set elements on arrays."); return InterpretResult.RUNTIME_ERROR;
                        }
                        const index = asNumber(indexVal);
                        const array = asArray(arrayVal);

                        if (index < 0 || index >= array.elements.length || !Number.isInteger(index)) {
                            this.runtimeError(`Array index out of bounds for assignment: ${index} for length ${array.elements.length}.`);
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        array.elements[index] = valueToSet;
                        this.push(valueToSet);
                        break;
                    }
                    default:
                        this.runtimeError(`Unknown opcode ${OpCode[instruction] || instruction}.`);
                        return InterpretResult.RUNTIME_ERROR;
                }
            } catch (e: any) {
                this.runtimeError(`Internal VM Error: ${e.message}`, e.stack);
                return InterpretResult.RUNTIME_ERROR;
            }

            if (this.frameCount > 0) {
                const potentiallyNewFrame = this.currentFrame();
                if (frame !== potentiallyNewFrame) {
                    frame = potentiallyNewFrame;
                }
            } else {
                console.error("[VM] Critical: Attempted to run with no active call frames, but not halted.");
                return InterpretResult.RUNTIME_ERROR;
            }
        }
    }
}