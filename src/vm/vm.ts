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
    slotsOffset: number; // Смещение в this.stack, где начинаются слоты этой функции
}

export enum InterpretResult {
    OK,
    COMPILE_ERROR, // Этот результат используется на этапе компиляции, а не ВМ
    RUNTIME_ERROR,
}

export class VirtualMachine {
    private frames: CallFrame[];
    private frameCount: number;

    private stack: VMValue[];
    private stackTop: number; // Указывает на следующий *свободный* слот стека

    private globals: Map<string, VMValue>; // Глобальные переменные

    // TODO: Куча для объектов (пока строки и массивы хранятся как объекты, но без GC)

    constructor() {
        this.frames = new Array(FRAMES_MAX);
        this.frameCount = 0;
        this.stack = new Array(STACK_MAX); // Инициализируем массив
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
            return InterpretResult.RUNTIME_ERROR; // Или COMPILE_ERROR, если это ошибка компиляции
        }

        this.stackTop = 0;
        this.frameCount = 0;
        this.globals.clear(); // Очищаем глобальные переменные перед новым запуском

        // Помещаем главную функцию (скрипт) на стек, как будто она вызвана
        // Сначала сама функция (для кадра)
        this.push(objectValue(mainFunction));
        // Затем вызываем ее
        if (!this.callFunction(mainFunction, 0)) { // 0 аргументов для главного скрипта
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
        if (frame.ip >= frame.func.chunk.code.length) {
            this.runtimeError("Attempted to read byte past end of chunk.");
            throw new Error("VM IP out of bounds."); // Это должно прервать выполнение
        }
        return frame.func.chunk.code[frame.ip++];
    }

    private readShort(): number {
        const frame = this.currentFrame();
        if (frame.ip + 1 >= frame.func.chunk.code.length) {
            this.runtimeError("Attempted to read short past end of chunk.");
            throw new Error("VM IP out of bounds for short.");
        }
        frame.ip += 2;
        return (frame.func.chunk.code[frame.ip - 2] << 8) | frame.func.chunk.code[frame.ip - 1];
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
            // В реальной ВМ это должно приводить к остановке
            throw new Error("VM Stack Overflow internal error"); // Пока так для жесткой остановки
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
        // this.stack[this.stackTop] = undefined; // Опционально: очистка слота
        return value;
    }

    private peek(distance: number): VMValue { // 0 - вершина, 1 - под ней
        const index = this.stackTop - 1 - distance;
        if (index < 0 || index >= this.stackTop) { // index < 0 or index >= stackTop
            this.runtimeError(`Stack underflow (peeking at distance ${distance}, index ${index}, top ${this.stackTop}).`);
            throw new Error("VM Stack Peek Underflow internal error");
        }
        return this.stack[index];
    }

    private callFunction(funcToCall: CompiledFunction, argCount: number): boolean {
        if (argCount !== funcToCall.arity) {
            this.runtimeError(
                `Function ${funcToCall.name || '<anonymous>'} expected ${funcToCall.arity} arguments but got ${argCount}.`
            );
            return false;
        }
        if (this.frameCount >= FRAMES_MAX) {
            this.runtimeError("Call stack overflow (frames).");
            return false;
        }

        // slotsOffset - это индекс на стеке, где начинается слот для funcToCall_obj.
        // Аргументы лежат выше этого объекта на стеке.
        // this.stackTop указывает на следующий свободный слот *после* всех аргументов.
        // Таким образом, funcToCall_obj находится по адресу this.stackTop - argCount - 1.
        const frame: CallFrame = {
            func: funcToCall,
            ip: 0,
            slotsOffset: this.stackTop - argCount - 1,
        };
        this.frames[this.frameCount++] = frame;

        // Расширяем стек для локальных переменных, которые не являются параметрами.
        // Параметры (в количестве funcToCall.arity) уже на стеке, сразу после funcToCall_obj.
        // numLocals в CompiledFunction - это общее количество локальных слотов (параметры + переменные).
        const numPureLocals = funcToCall.numLocals - funcToCall.arity;
        for (let i = 0; i < numPureLocals; i++) {
            this.push(voidValue()); // Инициализируем "чистые" локальные переменные void'ом
        }

        return true;
    }

    private runtimeError(message: string, ...args: any[]): void {
        console.error(`\nRuntime Error: ${message}`, ...args);
        for (let i = this.frameCount - 1; i >= 0; i--) {
            const frame = this.frames[i];
            const func = frame.func;
            // Пытаемся получить номер строки, соответствующий текущей или предыдущей инструкции
            // frame.ip указывает на *следующую* инструкцию. Для текущей/предыдущей лучше ip-1.
            const instructionPointerForLine = Math.max(0, frame.ip > 0 ? frame.ip -1 : 0);
            const sourceLine = func.chunk.lines[instructionPointerForLine] || "?";
            console.error(`  [line ${sourceLine}] in ${func.name || '<script>'}`);
        }
        // Важно! Не сбрасывать стеки здесь, чтобы главный цикл мог вернуть RUNTIME_ERROR
    }

    // Вспомогательная функция для определения "истинности" значения в вашем языке
    private isTruthy(value: VMValue): boolean {
        if (!value) return false; // на случай undefined слота
        switch (value.type) {
            case ValueType.BOOL: return asBoolean(value);
            case ValueType.VOID: return false; // void всегда ложь
            case ValueType.NUM: return asNumber(value) !== 0; // 0 - ложь, остальное - истина
            // Объекты (строки, массивы, функции) обычно считаются истинными, если они существуют
            case ValueType.STRING_OBJ:
            case ValueType.ARRAY_OBJ:
            case ValueType.FUNCTION_OBJ:
                return true;
            default: return false; // На всякий случай
        }
    }


    private run(): InterpretResult {
        let frame = this.currentFrame(); // Гарантировано, что frameCount > 0 здесь из-за interpret

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const instructionAddress = frame.ip; // Для отладки
            const instruction = this.readByte() as OpCode;

            if (process.env.DEBUG_VM) {
                let debugLine = `[VM] ${String(instructionAddress).padStart(4, '0')} | ${OpCode[instruction] ? OpCode[instruction].padEnd(18) : `UNKNOWN(0x${instruction.toString(16)})`.padEnd(18)}`;
                const stackSlice = this.stack.slice(0, this.stackTop).map(v => {
                    if (!v) return 'undef_slot';
                    switch (v.type) {
                        case ValueType.NUM: return v.as.number;
                        case ValueType.BOOL: return v.as.boolean;
                        case ValueType.VOID: return 'void';
                        case ValueType.STRING_OBJ: return `"${(v.as.obj as VMString).value}"`;
                        case ValueType.FUNCTION_OBJ: return `<Fn:${(v.as.obj as CompiledFunction).name}>`;
                        case ValueType.ARRAY_OBJ: return `<Arr[${(v.as.obj as VMArray).elements.length}]>`;
                        default: return `?type(${v.type})`;
                    }
                });
                debugLine += `| Stack: [${stackSlice.join(', ')}]`;

                const locals = [];
                // Локальные переменные доступны по frame.slotsOffset + localIndex.
                // Слот 0 (относительно slotsOffset) содержит func_obj.
                // Параметры (localIndex 0..arity-1) лежат в this.stack[frame.slotsOffset + 1 + paramIndex].
                // Локальные (localIndex arity..numLocals-1) лежат дальше.
                // НО! SymbolTable выдает localIndex от 0 до numLocals-1, где параметры - это первые.
                // И callFunction рассчитывает slotsOffset как место, где лежит func_obj.
                // Значит, this.stack[frame.slotsOffset] - это func_obj
                // this.stack[frame.slotsOffset + 1] - это параметр с localIndex 0
                // this.stack[frame.slotsOffset + 1 + i] - это переменная с localIndex i

                // Корректнее: slotsOffset - это начало слотов для функции, включая func_obj.
                // То есть this.stack[frame.slotsOffset] - это func_obj
                // this.stack[frame.slotsOffset + 1 + local_idx]
                // Или, если BytecodeGenerator выдает localIndex так, что 0-й это первый параметр,
                // а func_obj лежит "под" параметрами, то:
                // this.stack[frame.slotsOffset + local_idx] --- если slotsOffset указывает на первый параметр.
                // В текущей реализации callFunction:
                // slotsOffset: this.stackTop - argCount - 1, (указывает на funcToCall_obj)
                // Параметры: slot 0 (localIndex 0) - это this.stack[slotsOffset + 1]
                //            slot i (localIndex i) - это this.stack[slotsOffset + 1 + i]
                // "Чистые" локальные (после параметров):
                //            slot k (localIndex k) - это this.stack[slotsOffset + 1 + k]
                // Таким образом, все локальные переменные (включая параметры) доступны по
                // this.stack[frame.slotsOffset + 1 + localIndex]
                // Это не очень удобно. Лучше если slotsOffset указывает на первый *аргумент/локальную*.
                // И func_obj если нужен, то хранится в CompiledFunction или как-то еще.
                // Либо, если слот 0 всегда func_obj, тогда все localIndex смещены.
                // Предположим, что BytecodeGenerator выдает localIndex от 0 (для первого параметра/локальной).
                // И callFunction.slotsOffset указывает на место, где лежит *первый параметр* (или func_obj, если он в слоте 0).
                // Если frame.slotsOffset указывает на func_obj, то первый параметр (localIndex 0) будет this.stack[frame.slotsOffset + 1].
                // Если frame.slotsOffset указывает на первый параметр, то он будет this.stack[frame.slotsOffset].

                // Давайте пересмотрим callFunction:
                // slotsOffset: this.stackTop - argCount - 1, // Это место, где лежит funcToCall_obj
                // Локальная переменная с индексом `idx` (от 0 до numLocals-1)
                // если `idx < arity` (параметр), то она на стеке в `frame.slotsOffset + 1 + idx`
                // если `idx >= arity` (чистая локальная), то она на стеке в `frame.slotsOffset + 1 + idx` (после параметров)
                // Это значит, что доступ ко всем локальным (параметрам и переменным) идет через `frame.slotsOffset + 1 + local_index_от_symbol_table`

                // Поправим логику в callFunction, чтобы slotsOffset указывал на *начало* слотов для переменных/параметров,
                // а не на саму функцию на стеке.
                // Если так, то `this.stack[frame.slotsOffset + localIndex]` будет правильно.
                // Это изменение в `callFunction`: `slotsOffset: this.stackTop - argCount`,
                // и `this.push(objectValue(mainFunction))` должна быть сделана так, чтобы не мешать.
                // Текущая логика в `callFunction` для `slotsOffset` и отладки:
                // `slotsOffset: this.stackTop - argCount - 1` (указывает на func_obj)
                // Тогда для локальной `i`: `this.stack[frame.slotsOffset + 1 + i]`
                // Где `i` это `localIndex` от `SymbolTable` (0 для первого параметра).
                // Это немного запутано.
                // Давайте оставим как есть, но в отладке будем внимательны:
                // `frame.slotsOffset` -> func_obj
                // `frame.slotsOffset + 1` -> param0 / local0
                // `frame.slotsOffset + 1 + i` -> param_i / local_i

                for (let i = 0; i < frame.func.numLocals; i++) {
                    const localVal = this.stack[frame.slotsOffset + 1 + i]; // localIndex i (0-based for params/locals)
                    if (!localVal) { locals.push(`L${i}=undef_slot`); continue; }
                    switch (localVal.type) {
                        case ValueType.NUM: locals.push(`L${i}=${localVal.as.number}`); break;
                        case ValueType.BOOL: locals.push(`L${i}=${localVal.as.boolean}`); break;
                        case ValueType.VOID: locals.push(`L${i}=void`); break;
                        case ValueType.STRING_OBJ: locals.push(`L${i}="${(localVal.as.obj as VMString).value}"`); break;
                        case ValueType.FUNCTION_OBJ: locals.push(`L${i}=<Fn:${(localVal.as.obj as CompiledFunction).name}>`); break;
                        case ValueType.ARRAY_OBJ: locals.push(`L${i}=<Arr[${(localVal.as.obj as VMArray).elements.length}]>`); break;
                        default: locals.push(`L${i}=?type(${localVal.type})`);
                    }
                }

                if (locals.length > 0) debugLine += ` | Locals(slot0=func): {${locals.join(', ')}}`;
                console.log(debugLine);
            }


            try { // Обернем switch в try-catch для отлова внутренних ошибок ВМ
                switch (instruction) {
                    case OpCode.OP_HALT:
                        // Если есть значение на стеке (результат скрипта), можно его вернуть/обработать
                        // if (this.stackTop > 0) { console.log("Script final val:", this.peek(0));}
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

                    // --- Арифметические и логические операции ---
                    case OpCode.OP_ADD:
                    case OpCode.OP_SUBTRACT:
                    case OpCode.OP_MULTIPLY:
                    case OpCode.OP_DIVIDE:
                    case OpCode.OP_EQUAL:
                    case OpCode.OP_NOT_EQUAL:
                    case OpCode.OP_GREATER:
                    case OpCode.OP_LESS: {
                        // Порядок важен: bVal - правый операнд, aVal - левый
                        const bVal = this.pop();
                        const aVal = this.pop();

                        // Для бинарных числовых операций
                        if (instruction >= OpCode.OP_ADD && instruction <= OpCode.OP_DIVIDE) {
                            if (!isNumber(aVal) || !isNumber(bVal)) {
                                this.runtimeError(`Operands must be numbers for arithmetic operation. Got ${ValueType[aVal.type]} and ${ValueType[bVal.type]}.`);
                                return InterpretResult.RUNTIME_ERROR;
                            }
                            const a = asNumber(aVal);
                            const b = asNumber(bVal);
                            switch (instruction) {
                                case OpCode.OP_ADD:
                                    // Обработка конкатенации строк, если нужно
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
                        // Для операций сравнения
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
                                // TODO: Greater/Less для строк (лексикографическое)
                                else { this.runtimeError("Cannot apply <, > to strings yet (lexicographical needed)."); return InterpretResult.RUNTIME_ERROR;}
                            } else if (aVal.type === ValueType.VOID && bVal.type === ValueType.VOID) { // void == void is true, void != void is false
                                if (instruction === OpCode.OP_EQUAL) result = true;
                                else if (instruction === OpCode.OP_NOT_EQUAL) result = false;
                                else { this.runtimeError(`Cannot apply <, > to void values.`); return InterpretResult.RUNTIME_ERROR; }
                            } else if (isObject(aVal) && isObject(bVal)) { // Сравнение объектов по ссылке (кроме строк, они выше)
                                if (instruction === OpCode.OP_EQUAL) result = aVal.as.obj === bVal.as.obj;
                                else if (instruction === OpCode.OP_NOT_EQUAL) result = aVal.as.obj !== bVal.as.obj;
                                else { this.runtimeError(`Cannot apply <, > to object types ${ValueType[aVal.type]} and ${ValueType[bVal.type]} by reference.`); return InterpretResult.RUNTIME_ERROR; }
                            }
                            else { // Разные типы (кроме уже обработанных)
                                // void == non-void is false, void != non-void is true
                                if (aVal.type === ValueType.VOID || bVal.type === ValueType.VOID) {
                                    if (instruction === OpCode.OP_EQUAL) result = false;
                                    else if (instruction === OpCode.OP_NOT_EQUAL) result = true;
                                    else { this.runtimeError(`Cannot compare void with ${ValueType[aVal.type === ValueType.VOID ? bVal.type : aVal.type]} using < or >.`); return InterpretResult.RUNTIME_ERROR; }
                                } else {
                                    // Для разных типов (не void), сравнение на равенство всегда false, на неравенство true
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
                        const val = this.peek(0); // Не снимаем со стека, а заменяем
                        if (!isNumber(val)) {
                            this.runtimeError("Operand must be a number for negation.");
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        this.stack[this.stackTop - 1] = numValue(-asNumber(val)); // Заменяем на месте
                        break;
                    }
                    case OpCode.OP_NOT: {
                        const val = this.pop();
                        this.push(boolValue(!this.isTruthy(val)));
                        break;
                    }

                    // --- Переменные ---
                    case OpCode.OP_DEFINE_GLOBAL: {
                        const nameConstant = this.readConstant();
                        if (nameConstant.type !== ValueType.STRING_OBJ) {
                            this.runtimeError("Global variable name is not a string constant.");
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        const globalName = (nameConstant.as.obj as VMString).value;
                        // Значение для определения уже на стеке (от VarDecl)
                        this.globals.set(globalName, this.peek(0));
                        // DEFINE_GLOBAL не снимает значение со стека само по себе,
                        // это делает BytecodeGenerator через OP_POP после VarDecl, если это statement.
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
                            // Это не должно происходить, если семантический анализ работает правильно
                            // (т.е. присваивание к необъявленной глобальной переменной - ошибка компиляции).
                            // Но для защиты ВМ:
                            this.runtimeError(`Cannot store to undefined global variable '${globalName}'. Use 'let' to define.`);
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        // Значение для сохранения находится на вершине стека.
                        // STORE_GLOBAL не снимает его, чтобы присваивание было выражением.
                        this.globals.set(globalName, this.peek(0));
                        break;
                    }
                    case OpCode.OP_LOAD_LOCAL: {
                        const slot = this.readByte(); // localIndex от SymbolTable
                        // this.stack[frame.slotsOffset] - это func_obj (если он там)
                        // this.stack[frame.slotsOffset + 1 + slot] - это локальная переменная/параметр
                        this.push(this.stack[frame.slotsOffset + 1 + slot]);
                        break;
                    }
                    case OpCode.OP_STORE_LOCAL: {
                        const slot = this.readByte(); // localIndex
                        // Значение на вершине стека this.peek(0)
                        // Записываем в this.stack[frame.slotsOffset + 1 + slot]
                        // Значение остается на стеке (для присваивания как выражения).
                        this.stack[frame.slotsOffset + 1 + slot] = this.peek(0);
                        break;
                    }

                    // --- Управляющие инструкции ---
                    case OpCode.OP_JUMP: {
                        const offset = this.readShort(); // Знаковое i16
                        frame.ip += offset;
                        break;
                    }
                    case OpCode.OP_JUMP_IF_FALSE: {
                        const offset = this.readShort();
                        if (!this.isTruthy(this.peek(0))) { // Условие на вершине стека
                            frame.ip += offset;
                        }
                        // Компилятор должен добавить OP_POP для условия после этого, если IF-выражение
                        // или если условие не используется дальше (для if-стейтмента оно убирается в BytecodeGenerator)
                        break;
                    }
                    case OpCode.OP_JUMP_IF_TRUE: { // Используется для '||'
                        const offset = this.readShort();
                        if (this.isTruthy(this.peek(0))) {
                            frame.ip += offset;
                        }
                        break;
                    }

                    // --- Функции ---
                    case OpCode.OP_CALL: {
                        const funcConstIndex = this.readShort();
                        const argCount = this.readByte();

                        const calleeValueFromConst = this.currentChunk().constants[funcConstIndex];

                        if (calleeValueFromConst.type !== ValueType.FUNCTION_OBJ) {
                            this.runtimeError("Can only call functions (callee from const is not a function).");
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        const funcToCall = asFunction(calleeValueFromConst);

                        // Перед этим OP_CALL, BytecodeGenerator должен был положить аргументы на стек.
                        // Стек: [..., arg1, ..., argN] <- stackTop
                        // Теперь нам нужно положить funcToCall_obj на стек *под* аргументы.
                        // 1. Сохраним аргументы временно
                        const args: VMValue[] = [];
                        for(let i = 0; i < argCount; i++) {
                            args.push(this.pop()); // Снимаем в обратном порядке: argN, argN-1, ...
                        }
                        // 2. Кладем саму функцию (которую будем вызывать) на стек
                        this.push(objectValue(funcToCall)); // funcToCall - это CompiledFunction
                        // 3. Возвращаем аргументы на стек в правильном порядке
                        for(let i = argCount - 1; i >= 0; i--) {
                            this.push(args[i]);
                        }
                        // Теперь стек: [..., funcToCall_obj, arg1, ..., argN] <- stackTop

                        if (!this.callFunction(funcToCall, argCount)) {
                            return InterpretResult.RUNTIME_ERROR;
                        }
                        frame = this.currentFrame(); // Важно обновить текущий кадр!
                        break;
                    }
                    case OpCode.OP_RETURN: {
                        const result = this.pop(); // Значение, возвращаемое функцией

                        // Закрываем текущий кадр
                        this.frameCount--;
                        if (this.frameCount === 0) {
                            // Вернулись из главного скрипта
                            this.pop(); // Убираем главную функцию <script> со стека (которую interpret поместил)
                            // Результат выполнения скрипта (если есть) уже был popped как result.
                            // Если нужно, чтобы он остался на стеке, то:
                            // if (result.type !== ValueType.VOID) this.push(result);
                            return InterpretResult.OK; // Завершение ВМ
                        }

                        // Восстанавливаем stackTop до состояния перед вызовом этой функции
                        // frame (который сейчас this.frames[this.frameCount], т.е. старый frame)
                        // .slotsOffset указывал на func_obj завершившейся функции.
                        this.stackTop = this.currentFrame().slotsOffset; // Неверно. Нужен slotsOffset *завершившегося* кадра.
                        // frame все еще ссылается на завершающийся кадр.
                        this.stackTop = frame.slotsOffset; // stackTop теперь указывает на место, где была func_obj
                        // завершившейся функции.
                        this.push(result); // Кладем результат на стек для вызывающей функции

                        frame = this.currentFrame(); // Обновляем текущий кадр на вызывающую функцию
                        break;
                    }

                    // --- Массивы ---
                    case OpCode.OP_NEW_ARRAY: {
                        const numElements = this.readShort();
                        const elements: VMValue[] = [];
                        // Элементы уже на стеке в порядке [el0, el1, ..., elN-1] <- stackTop
                        for (let i = 0; i < numElements; i++) {
                            elements.unshift(this.pop()); // Снимаем со стека в обратном порядке
                        }
                        const arrayObj: VMArray = { type: ValueType.ARRAY_OBJ, elements };
                        this.push(objectValue(arrayObj));
                        break;
                    }
                    case OpCode.OP_ARRAY_GET: {
                        const indexVal = this.pop(); // Индекс
                        const arrayVal = this.pop(); // Массив
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
                        // Порядок на стеке, ожидаемый BytecodeGenerator: array_ref, index, value
                        const valueToSet = this.pop();
                        const indexVal = this.pop();
                        const arrayVal = this.pop();

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
                        this.push(valueToSet); // Оставляем присвоенное значение на стеке (для выражений a[i] = b = c)
                        break;
                    }


                    default:
                        // Проверка на исчерпываемость (should not happen with 'as OpCode')
                        // const _exhaustiveCheck: never = instruction;
                        this.runtimeError(`Unknown opcode ${OpCode[instruction] || instruction}.`);
                        return InterpretResult.RUNTIME_ERROR;
                }
            } catch (e: any) {
                // Если произошла внутренняя ошибка в логике ВМ (например, throw из pop/peek)
                this.runtimeError(`Internal VM Error: ${e.message}`, e.stack);
                return InterpretResult.RUNTIME_ERROR;
            }

            // Обновление frame, если он изменился (после OP_CALL или OP_RETURN, но OP_RETURN уже обновляет)
            // Это нужно в основном после OP_CALL. OP_RETURN сам переключает кадр.
            if (this.frameCount > 0) { // Проверка, что еще есть кадры
                const potentiallyNewFrame = this.currentFrame();
                if (frame !== potentiallyNewFrame) {
                    frame = potentiallyNewFrame;
                }
            } else {
                // Если frameCount стал 0, цикл должен был завершиться через OP_HALT или OP_RETURN из main.
                // Если мы здесь, значит что-то пошло не так.
                // ИСПРАВЛЕНИЕ ОШИБКИ TS2367:
                // Если frameCount === 0, и мы все еще в цикле, это ошибка,
                // так как OP_HALT или OP_RETURN из main должны были завершить выполнение.
                // `instruction` здесь не может быть OP_HALT, так как это бы вызвало return из switch.
                console.error("[VM] Critical: Attempted to run with no active call frames, but not halted.");
                return InterpretResult.RUNTIME_ERROR;
            }
        }
    }
}