import {
    ASTNode, Program, VarDecl, FuncDecl, Block, IfStmt, WhileStmt, ReturnStmt,
    AssignExpr, BinaryExpr, UnaryExpr, CallExpr, Literal, Identifier, ArrayLiteral, ArrayAccess,
} from '../ast/entity';
import { SymbolTable, SymbolEntry } from '../symbolTable/symbolTable';
import { OpCode } from '../vm/opcodes';
import { Chunk } from '../vm/chunk';
import { ValueType, VMValue, numValue, boolValue, voidValue, CompiledFunction, objectValue, VMString } from '../vm/value';

interface LoopContext {
    startLabel: number; // Адрес начала цикла (для JUMP назад)
    exitPatches: number[]; // Список адресов JUMP_IF_FALSE, которые нужно будет "запатчить" при выходе из цикла
}

export class BytecodeGenerator {
    private currentChunk: Chunk;
    private symbolTable: SymbolTable;
    private functions: CompiledFunction[]; // Список всех скомпилированных функций
    private currentFunction: CompiledFunction | null; // Текущая компилируемая функция
    private loopStack: LoopContext[]; // Стек для отслеживания вложенных циклов

    constructor(symbolTable: SymbolTable) {
        this.symbolTable = symbolTable;
        this.functions = [];
        this.currentFunction = null;
        this.loopStack = [];
        // Главный "чанк" для скрипта
        this.currentChunk = this.beginFunctionCompilation("<script>", 0);
    }

    // Добавлен публичный getter для доступа к списку функций
    public getCompiledFunctions(): ReadonlyArray<CompiledFunction> {
        return this.functions;
    }

    private beginFunctionCompilation(name: string, arity: number): Chunk {
        const funcName = name;
        const newChunk = new Chunk();

        // Создаем объект функции
        // numLocals будет обновляться по мере обнаружения локальных переменных
        const compiledFunc: CompiledFunction = {
            type: ValueType.FUNCTION_OBJ,
            name: funcName,
            arity: arity,
            numLocals: 0, // Начнем с 0, параметры добавят это число
            chunk: newChunk,
        };

        this.functions.push(compiledFunc); // Добавляем в глобальный список функций
        this.currentFunction = compiledFunc;
        this.currentChunk = newChunk; // Это чанк текущей функции

        // Для функций (не для <script>) параметры являются первыми локальными переменными
        // Их numLocals увеличится при обработке параметров в visitFuncDecl
        // Слот 0 в кадре стека функции обычно резервируется для самой функции (для рекурсии или методов)
        // Но для простоты пока не будем это делать, если не планируются замыкания.
        // Или можно просто сказать, что локальные переменные начинаются с индекса arity.
        // Сейчас SymbolTable сама корректно назначает localIndex для параметров и переменных.

        return newChunk;
    }

    private endFunctionCompilation(): CompiledFunction {
        if (!this.currentFunction) {
            // Этого не должно произойти, если beginFunctionCompilation был вызван правильно
            throw new Error("endFunctionCompilation called without an active function.");
        }
        // Не добавляем неявный OP_RETURN, если последняя инструкция уже была OP_RETURN
        const lastOp = this.currentChunk.code.length > 0 ? this.currentChunk.code[this.currentChunk.code.length -1] : null;
        if (lastOp !== OpCode.OP_RETURN) {
            this.emitOp(OpCode.OP_PUSH_VOID, 0); // Возвращаем void по умолчанию
            this.emitOp(OpCode.OP_RETURN, 0); // Неявный return в конце функции
                                              // TODO: нужна линия для этого return
        }

        const func = this.currentFunction!;
        // Здесь можно было бы вывести отладочную информацию о скомпилированной функции
        // console.log(`Compiled function ${func.name}:`);
        // console.log(`  Arity: ${func.arity}, Locals: ${func.numLocals}`);
        // console.log(`  Constants: `, func.chunk.constants);
        // console.log(`  Code: `, func.chunk.code);

        // Восстанавливаем контекст предыдущей функции, если это был вложенный вызов
        // (в нашем случае мы компилируем функции последовательно, не рекурсивно вызывая compile для тела)
        // Поэтому this.currentFunction и this.currentChunk будут установлены заново при начале новой функции.
        // Для глобального скрипта:
        if (this.functions.length > 0 && func.name === "<script>") {
            // this.currentFunction = null; // Завершили компиляцию скрипта. Не нужно, т.к. compile возвращает и все
        }
        return func;
    }


    public compile(program: Program): CompiledFunction { // Возвращает главную функцию-скрипт
        this.visit(program);
        return this.endFunctionCompilation(); // Завершаем компиляцию главного чанка <script>
    }

    // --- Утилиты для генерации байт-кода ---
    private emitByte(byte: number, line: number): void {
        this.currentChunk.writeByte(byte, line);
    }

    private emitBytes(byte1: number, byte2: number, line: number): void {
        this.emitByte(byte1, line);
        this.emitByte(byte2, line);
    }

    private emitShort(short: number, line: number): void {
        this.currentChunk.writeShort(short, line);
    }

    private emitOp(op: OpCode, line: number): void {
        this.emitByte(op, line);
    }

    private emitConstant(value: VMValue, line: number): void {
        const constIndex = this.currentChunk.addConstant(value);
        if (constIndex > 65535) {
            throw new Error("Too many constants in one chunk."); // TODO: Error handling
        }
        this.emitByte(OpCode.OP_PUSH_CONST, line);
        this.emitShort(constIndex, line);
    }

    // Для JUMP инструкций
    private emitJump(instruction: OpCode, line: number): number {
        this.emitOp(instruction, line);
        this.emitByte(0xFF, line); // Placeholder для смещения (2 байта)
        this.emitByte(0xFF, line);
        return this.currentChunk.code.length - 2; // Возвращаем адрес этого placeholder'а
    }

    private patchJump(offsetPlaceholder: number): void {
        // -2 потому что смещение отсчитывается от *конца* инструкции JUMP
        const jump = this.currentChunk.code.length - offsetPlaceholder - 2;
        if (jump > 32767 || jump < -32768) { // i16 range
            throw new Error("Too far to jump."); // TODO: Error handling
        }
        this.currentChunk.code[offsetPlaceholder] = (jump >> 8) & 0xFF;
        this.currentChunk.code[offsetPlaceholder + 1] = jump & 0xFF;
    }

    private emitLoop(loopStart: number, line: number): void {
        this.emitOp(OpCode.OP_JUMP, line); // Безусловный JUMP
        // Смещение относительно адреса *начала* операнда JUMP
        const offset = loopStart - (this.currentChunk.code.length + 2); // +2 для байтов смещения
        if (offset > 0 || offset < -32768) { // Должно быть отрицательным и в пределах i16
            throw new Error("Loop too large or invalid offset.");
        }
        // Записываем отрицательное смещение (как знаковое 16-битное число)
        this.emitShort(offset, line);
    }


    // --- Методы Visit ---
    private visit(node: ASTNode): void {
        // console.log(`Visiting ${node.constructor.name}`); // Для отладки
        switch (node.constructor) {
            case Program:           this.visitProgram(node as Program); break;
            case VarDecl:           this.visitVarDecl(node as VarDecl); break;
            case AssignExpr:        this.visitAssignExpr(node as AssignExpr); break;
            case FuncDecl:          this.visitFuncDecl(node as FuncDecl); break;
            case Block:             this.visitBlock(node as Block); break;
            case ReturnStmt:        this.visitReturnStmt(node as ReturnStmt); break;
            case IfStmt:            this.visitIfStmt(node as IfStmt); break;
            case WhileStmt:         this.visitWhileStmt(node as WhileStmt); break;
            case CallExpr:          this.visitCallExpr(node as CallExpr); break;
            case BinaryExpr:        this.visitBinaryExpr(node as BinaryExpr); break;
            case UnaryExpr:         this.visitUnaryExpr(node as UnaryExpr); break;
            case Identifier:        this.visitIdentifier(node as Identifier); break;
            case Literal:           this.visitLiteral(node as Literal); break;
            case ArrayLiteral:      this.visitArrayLiteral(node as ArrayLiteral); break;
            case ArrayAccess:       this.visitArrayAccess(node as ArrayAccess); break;
            default:
                throw new Error(`BytecodeGenerator: Unknown AST node type: ${node.constructor.name}`);
        }
    }

    private visitProgram(node: Program): void {
        for (const statement of node.statements) {
            this.visit(statement);
            // Если statement это выражение (например, AssignExpr, CallExpr), его результат остается на стеке.
            // Для верхнеуровневых выражений результат обычно не нужен, поэтому добавим POP.
            if (statement instanceof AssignExpr || statement instanceof CallExpr /* или другие выражения-стейтменты */) {
                // Убираем результат выражения со стека, если это statement
                // (кроме VarDecl, который сам обрабатывает свой POP)
                if (!(statement instanceof VarDecl)) { // VarDecl уже делает POP
                    // CallExpr может возвращать void, в таком случае POP не нужен (или PUSH_VOID + POP)
                    // TODO: Более умная обработка POP для выражений-стейтментов (например, если функция void)
                    this.emitOp(OpCode.OP_POP, statement.line);
                }
            }
        }
    }

    private visitBlock(node: Block): void {
        this.symbolTable.enterScope(`block@${node.line}:${node.column}`);
        for (const statement of node.statements) {
            this.visit(statement);
            // Аналогично Program, обрабатываем выражения-стейтменты внутри блока
            if (statement instanceof AssignExpr || statement instanceof CallExpr) {
                if (!(statement instanceof VarDecl)) {
                    this.emitOp(OpCode.OP_POP, statement.line);
                }
            }
        }
        this.symbolTable.exitScope();
    }

    private visitFuncDecl(node: FuncDecl): void {
        // 1. Получаем SymbolEntry для функции (он должен содержать ссылку на functionBodyScope)
        const funcSymbolEntry = this.symbolTable.lookup(node.name);
        if (!funcSymbolEntry || !funcSymbolEntry.isFunction) {
            throw new Error(`Codegen: Function symbol '${node.name}' not found or is not a function.`);
        }
        if (!funcSymbolEntry.functionBodyScope) {
            throw new Error(`Codegen: functionBodyScope not set for function '${node.name}' in SymbolTable entry. Semantic analysis might have failed or is incomplete.`);
        }

        // 2. Сохраняем контекст компиляции внешней функции (если есть)
        const enclosingFunction = this.currentFunction;
        const enclosingChunk = this.currentChunk;
        const originalSymbolTableScope = this.symbolTable.currentScope;

        // 3. Начинаем компиляцию новой функции в BytecodeGenerator
        this.beginFunctionCompilation(node.name, node.params.length);

        if(this.currentFunction) {
            this.currentFunction.numLocals = node.params.length;
        }


        // 4. Устанавливаем ТЕКУЩУЮ ОБЛАСТЬ SymbolTable на ту, что была создана для тела функции SemanticAnalyzer'ом
        this.symbolTable.currentScope = funcSymbolEntry.functionBodyScope;

        this.visit(node.body);

        const compiledFuncObject = this.endFunctionCompilation();

        // 6. Восстанавливаем контекст
        this.currentFunction = enclosingFunction;
        this.currentChunk = enclosingChunk;
        this.symbolTable.currentScope = originalSymbolTableScope; // Восстанавливаем исходную область SymbolTable

        // 7. Добавляем скомпилированный объект функции как константу
        const funcConstIndex = this.currentChunk.addConstant(objectValue(compiledFuncObject));

        // 8. Определяем переменную, которая будет хранить эту функцию
        if (funcSymbolEntry.definedInScope === this.symbolTable.globalScope) {
            const nameStrConstIdx = this.currentChunk.addConstant(objectValue({ type: ValueType.STRING_OBJ, value: node.name } as VMString));
            this.emitOp(OpCode.OP_PUSH_CONST, node.line);
            this.emitShort(funcConstIndex, node.line);
            this.emitOp(OpCode.OP_DEFINE_GLOBAL, node.line);
            this.emitShort(nameStrConstIdx, node.line);
            this.emitOp(OpCode.OP_POP, node.line);
        } else {
            if (funcSymbolEntry.localIndex === undefined) {
                throw new Error(`Codegen: Local function declaration '${node.name}' has no localIndex in its defining scope.`);
            }
            if (!this.currentFunction) throw new Error("Codegen: Trying to define local function not inside another Compiling function context");

            this.currentFunction.numLocals = Math.max(this.currentFunction.numLocals, funcSymbolEntry.localIndex + 1);

            this.emitOp(OpCode.OP_PUSH_CONST, node.line);
            this.emitShort(funcConstIndex, node.line);
            this.emitOp(OpCode.OP_STORE_LOCAL, node.line);
            this.emitByte(funcSymbolEntry.localIndex, node.line);
            this.emitOp(OpCode.OP_POP, node.line);
        }
    }

    // Исправления для definedInScope вместо scope
    private visitVarDecl(node: VarDecl): void {
        const symbol = this.symbolTable.lookup(node.name); // Ищем в текущей или родительских
        if (!symbol) {
            throw new Error(`Symbol ${node.name} not found during codegen (should have been caught by analyzer).`);
        }

        if (node.initializer) {
            this.visit(node.initializer);
        } else {
            this.emitOp(OpCode.OP_PUSH_VOID, node.line);
        }

        if (symbol.definedInScope === this.symbolTable.globalScope) { // <--- ИЗМЕНЕНИЕ
            const nameConstIndex = this.currentChunk.addConstant(
                objectValue({ type: ValueType.STRING_OBJ, value: node.name } as VMString)
            );
            this.emitOp(OpCode.OP_DEFINE_GLOBAL, node.line);
            this.emitShort(nameConstIndex, node.line);
            this.emitOp(OpCode.OP_POP, node.line);
        } else {
            if (!this.currentFunction) throw new Error("Defining local variable outside a function context.");
            if (symbol.localIndex === undefined) throw new Error(`Local symbol ${symbol.name} has no localIndex for codegen.`);

            this.currentFunction.numLocals = Math.max(this.currentFunction.numLocals, symbol.localIndex + 1);

            this.emitOp(OpCode.OP_STORE_LOCAL, node.line);
            this.emitByte(symbol.localIndex, node.line);
            this.emitOp(OpCode.OP_POP, node.line);
        }
    }

    private visitAssignExpr(node: AssignExpr): void {
        if (node.target instanceof Identifier) {
            const symbol = this.symbolTable.lookup(node.target.name);
            if (!symbol) throw new Error(`Symbol ${node.target.name} not found for assignment.`);

            this.visit(node.value);

            if (symbol.definedInScope === this.symbolTable.globalScope) { // <--- ИЗМЕНЕНИЕ
                const nameConstIndex = this.currentChunk.addConstant(
                    objectValue({ type: ValueType.STRING_OBJ, value: node.target.name } as VMString)
                );
                this.emitOp(OpCode.OP_STORE_GLOBAL, node.line);
                this.emitShort(nameConstIndex, node.line);
            } else {
                if (symbol.localIndex === undefined) throw new Error(`Local symbol ${symbol.name} has no localIndex for assignment.`);
                this.emitOp(OpCode.OP_STORE_LOCAL, node.line);
                this.emitByte(symbol.localIndex, node.line);
            }
        } else if (node.target instanceof ArrayAccess) {
            // ... (остается как было)
            this.visit(node.target.array);
            this.visit(node.target.index);
            this.visit(node.value);
            this.emitOp(OpCode.OP_ARRAY_SET, node.line);
        } else {
            throw new Error("Invalid assignment target");
        }
    }

    private visitIdentifier(node: Identifier): void {
        const symbol = this.symbolTable.lookup(node.name);
        if (!symbol) {
            throw new Error(`Identifier '${node.name}' not found during codegen.`);
        }

        if (symbol.definedInScope === this.symbolTable.globalScope) {
            const nameConstIndex = this.currentChunk.addConstant(
                objectValue({ type: ValueType.STRING_OBJ, value: node.name } as VMString)
            );
            this.emitOp(OpCode.OP_LOAD_GLOBAL, node.line);
            this.emitShort(nameConstIndex, node.line);
        } else {
            if (symbol.localIndex === undefined) {
                throw new Error(`Local symbol '${node.name}' missing localIndex.`);
            }
            this.emitOp(OpCode.OP_LOAD_LOCAL, node.line);
            this.emitByte(symbol.localIndex, node.line);
        }
    }
    private visitLiteral(node: Literal): void {
        switch (typeof node.value) {
            case 'number':
                this.emitConstant(numValue(node.value as number), node.line);
                break;
            case 'boolean':
                this.emitOp(node.value ? OpCode.OP_PUSH_TRUE : OpCode.OP_PUSH_FALSE, node.line);
                break;
            case 'string':
                this.emitConstant(
                    objectValue({ type: ValueType.STRING_OBJ, value: node.value as string } as VMString),
                    node.line
                );
                break;
            default:
                if (node.value == null) {
                    this.emitOp(OpCode.OP_PUSH_VOID, node.line);
                } else {
                    throw new Error(`Unsupported literal type: ${typeof node.value}`);
                }
        }
    }

    private visitBinaryExpr(node: BinaryExpr): void {
        if (node.operator === '&&' || node.operator === '||') {
            this.compileAndOr(node, node.operator === '&&');
            return;
        }

        this.visit(node.left);
        this.visit(node.right);

        switch (node.operator) {
            case '+': this.emitOp(OpCode.OP_ADD, node.line); break;
            case '-': this.emitOp(OpCode.OP_SUBTRACT, node.line); break;
            case '*': this.emitOp(OpCode.OP_MULTIPLY, node.line); break;
            case '/': this.emitOp(OpCode.OP_DIVIDE, node.line); break;
            case '==': this.emitOp(OpCode.OP_EQUAL, node.line); break;
            case '!=': this.emitOp(OpCode.OP_NOT_EQUAL, node.line); break;
            case '<': this.emitOp(OpCode.OP_LESS, node.line); break;
            case '>': this.emitOp(OpCode.OP_GREATER, node.line); break;
            // TODO: <=, >=
            default:
                throw new Error(`Unsupported binary operator: ${node.operator}`);
        }
    }

    private compileAndOr(node: BinaryExpr, isAnd: boolean): void {
        this.visit(node.left);
        // Для 'a && b':  visit(a); JUMP_IF_FALSE skip_right; POP_left; visit(b); skip_right:
        // Для 'a || b':  visit(a); JUMP_IF_TRUE  skip_right; POP_left; visit(b); skip_right:
        const jumpInstruction = isAnd ? OpCode.OP_JUMP_IF_FALSE : OpCode.OP_JUMP_IF_TRUE;
        const endJump = this.emitJump(jumpInstruction, node.line);

        this.emitOp(OpCode.OP_POP, node.line);
        this.visit(node.right);


        this.patchJump(endJump);
    }


    private visitUnaryExpr(node: UnaryExpr): void {
        this.visit(node.operand);
        switch (node.operator) {
            case '-': this.emitOp(OpCode.OP_NEGATE, node.line); break;
            case '!': this.emitOp(OpCode.OP_NOT, node.line); break;
            default:
                throw new Error(`Unsupported unary operator: ${node.operator}`);
        }
    }

    private visitIfStmt(node: IfStmt): void {
        this.visit(node.condition);
        const elseJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE, node.line);

        this.emitOp(OpCode.OP_POP, node.line);
        this.visit(node.thenBranch);

        let endJump: number | null = null;
        if (node.elseBranch) {
            endJump = this.emitJump(OpCode.OP_JUMP, node.line);
        }

        this.patchJump(elseJump);
        this.emitOp(OpCode.OP_POP, node.line);

        if (node.elseBranch) {
            this.visit(node.elseBranch);
            this.patchJump(endJump!);
        }
    }

    private visitWhileStmt(node: WhileStmt): void {
        const loopStart = this.currentChunk.code.length;
        this.loopStack.push({ startLabel: loopStart, exitPatches: [] });

        this.visit(node.condition); // Условие на стек
        const exitJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE, node.line);

        this.emitOp(OpCode.OP_POP, node.line);
        this.visit(node.body);
        this.emitLoop(loopStart, node.line);

        this.patchJump(exitJump);
        this.emitOp(OpCode.OP_POP, node.line);

        this.loopStack.pop();
    }


    private visitCallExpr(node: CallExpr): void {
        const funcSymbol = this.symbolTable.lookup(node.callee);
        if (!funcSymbol || !funcSymbol.isFunction) {
            throw new Error(`Codegen: Function '${node.callee}' not found or not a function.`);
        }

        const targetCompiledFunction = this.functions.find(f => f.name === node.callee);
        if (!targetCompiledFunction) {
            throw new Error(`Codegen: CompiledFunction object for '${node.callee}' not found. Ensure it was processed by visitFuncDecl first, or that the functions list is correctly populated.`);
        }
        const funcConstIndex = this.currentChunk.addConstant(objectValue(targetCompiledFunction));

        for (const arg of node.args) {
            this.visit(arg);
        }

        this.emitOp(OpCode.OP_CALL, node.line);
        this.emitShort(funcConstIndex, node.line);
        this.emitByte(node.args.length, node.line);
    }

    private visitReturnStmt(node: ReturnStmt): void {
        if (!this.currentFunction) {
            throw new Error("Codegen: Return statement outside of a function.");
        }
        if (node.value) {
            this.visit(node.value);
        } else {
            this.emitOp(OpCode.OP_PUSH_VOID, node.line);
        }
        this.emitOp(OpCode.OP_RETURN, node.line);
    }

    private visitArrayLiteral(node: ArrayLiteral): void {
        for (const element of node.elements) {
            this.visit(element);
        }
        this.emitOp(OpCode.OP_NEW_ARRAY, node.line);
        this.emitShort(node.elements.length, node.line);
    }

    private visitArrayAccess(node: ArrayAccess): void {
        this.visit(node.array);
        this.visit(node.index);
        this.emitOp(OpCode.OP_ARRAY_GET, node.line);
    }
}