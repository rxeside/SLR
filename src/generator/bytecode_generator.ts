import {
    ASTNode, Program, VarDecl, FuncDecl, Block, IfStmt, WhileStmt, ReturnStmt,
    AssignExpr, BinaryExpr, UnaryExpr, CallExpr, Literal, Identifier, ArrayLiteral, ArrayAccess,
} from '../ast/entity';
import {SymbolTable, SymbolEntry, Scope} from '../symbolTable/symbolTable';
import { OpCode } from '../vm/opcodes';
import { Chunk } from '../vm/chunk';
import { ValueType, VMValue, numValue, boolValue, voidValue, CompiledFunction, objectValue, VMString } from '../vm/value';

interface LoopContext {
    startLabel: number;
    exitPatches: number[];
}

export class BytecodeGenerator {
    private currentChunk: Chunk;
    private symbolTable: SymbolTable;
    private functions: CompiledFunction[];
    private currentFunction: CompiledFunction | null;
    private loopStack: LoopContext[];

    constructor(symbolTable: SymbolTable) {
        this.symbolTable = symbolTable;
        this.functions = [];
        this.currentFunction = null;
        this.loopStack = [];
        this.currentChunk = this.beginFunctionCompilation("<script>", 0);
    }

    public getCompiledFunctions(): ReadonlyArray<CompiledFunction> {
        return this.functions;
    }

    private beginFunctionCompilation(name: string, arity: number): Chunk {
        const funcName = name;
        const newChunk = new Chunk();

        const compiledFunc: CompiledFunction = {
            type: ValueType.FUNCTION_OBJ,
            name: funcName,
            arity: arity,
            numLocals: 0,
            chunk: newChunk,
        };

        this.functions.push(compiledFunc);
        this.currentFunction = compiledFunc;
        this.currentChunk = newChunk;

        return newChunk;
    }

    private endFunctionCompilation(): CompiledFunction {
        if (!this.currentFunction) {
            throw new Error("endFunctionCompilation called without an active function.");
        }

        const lastOp = this.currentChunk.code.length > 0 ? this.currentChunk.code[this.currentChunk.code.length -1] : null;
        if (lastOp !== OpCode.OP_RETURN) {
            this.emitOp(OpCode.OP_PUSH_VOID, 0);
            this.emitOp(OpCode.OP_RETURN, 0);
        }

        const func = this.currentFunction!;

        if (this.functions.length > 0 && func.name === "<script>") {
        }
        return func;
    }

    public compile(program: Program): CompiledFunction {
        this.visit(program);
        return this.endFunctionCompilation();
    }

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
            throw new Error("Too many constants in one chunk.");
        }
        this.emitByte(OpCode.OP_PUSH_CONST, line);
        this.emitShort(constIndex, line);
    }

    private emitJump(instruction: OpCode, line: number): number {
        this.emitOp(instruction, line);
        this.emitByte(0xFF, line);
        this.emitByte(0xFF, line);
        return this.currentChunk.code.length - 2;
    }

    private patchJump(offsetPlaceholder: number): void {
        const jump = this.currentChunk.code.length - offsetPlaceholder - 2;
        if (jump > 32767 || jump < -32768) {
            throw new Error("Too far to jump.");
        }
        this.currentChunk.code[offsetPlaceholder] = (jump >> 8) & 0xFF;
        this.currentChunk.code[offsetPlaceholder + 1] = jump & 0xFF;
    }

    private emitLoop(loopStart: number, line: number): void {
        this.emitOp(OpCode.OP_JUMP, line);
        const offset = loopStart - (this.currentChunk.code.length + 2);
        if (offset > 0 || offset < -32768) {
            throw new Error("Loop too large or invalid offset.");
        }
        this.emitShort(offset, line);
    }

    private visit(node: ASTNode): void {
        console.log(`[BCG] Visiting node type: ${node?.constructor?.name}, node content:`, node);
        if (!node || !node.constructor) {
            console.error("[BCG] Error: Visiting a null or malformed node!");
            throw new Error("Malformed AST node encountered in BytecodeGenerator.");
        }
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
            if (statement instanceof AssignExpr || statement instanceof CallExpr) {
                if (!(statement instanceof VarDecl)) {
                    this.emitOp(OpCode.OP_POP, statement.line);
                }
            }
        }
    }

    private visitBlock(node: Block): void {
        const blockNodeWithScope = node as (Block & { scope?: Scope });
        if (!blockNodeWithScope.scope) {
            throw new Error(`Codegen: AST Block node at ${node.line}:${node.column} is missing scope.`);
        }

        const originalSymbolTableScope = this.symbolTable.currentScope;
        this.symbolTable.currentScope = blockNodeWithScope.scope;

        for (const statement of node.statements) {
            this.visit(statement);
            if (statement instanceof AssignExpr || statement instanceof CallExpr) {
                this.emitOp(OpCode.OP_POP, statement.line);
            }
        }
        this.symbolTable.currentScope = originalSymbolTableScope;
    }

    private visitFuncDecl(node: FuncDecl): void {
        const funcSymbolEntry = this.symbolTable.lookup(node.name);
        if (!funcSymbolEntry || !funcSymbolEntry.isFunction) {
            throw new Error(`Codegen: Function symbol '${node.name}' not found or is not a function.`);
        }
        if (!funcSymbolEntry.functionBodyScope) {
            throw new Error(`Codegen: functionBodyScope not set for function '${node.name}' in SymbolTable entry. Semantic analysis might have failed or is incomplete.`);
        }

        const enclosingFunction = this.currentFunction;
        const enclosingChunk = this.currentChunk;
        const originalSymbolTableScope = this.symbolTable.currentScope;

        this.beginFunctionCompilation(node.name, node.params.length);

        if(this.currentFunction) {
            this.currentFunction.numLocals = node.params.length;
        }

        this.symbolTable.currentScope = funcSymbolEntry.functionBodyScope;

        this.visit(node.body);

        const compiledFuncObject = this.endFunctionCompilation();

        this.currentFunction = enclosingFunction;
        this.currentChunk = enclosingChunk;
        this.symbolTable.currentScope = originalSymbolTableScope;

        const funcConstIndex = this.currentChunk.addConstant(objectValue(compiledFuncObject));

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

    private visitVarDecl(node: VarDecl): void {
        const symbol = this.symbolTable.lookup(node.name);
        if (!symbol) {
            console.error(`[BCG] visitVarDecl: Symbol '${node.name}' NOT FOUND. Current scope: '${this.symbolTable.currentScope.name}'`);
            this.symbolTable.print();
            throw new Error(`Symbol ${node.name} not found during codegen (it was expected to be found by lookup).`);
        }

        if (node.initializer) {
            this.visit(node.initializer);
        } else {
            this.emitOp(OpCode.OP_PUSH_VOID, node.line);
        }

        if (symbol.definedInScope === this.symbolTable.globalScope) {
            const nameConstIndex = this.currentChunk.addConstant(objectValue({ type: ValueType.STRING_OBJ, value: node.name } as VMString));
            this.emitOp(OpCode.OP_DEFINE_GLOBAL, node.line);
            this.emitShort(nameConstIndex, node.line);
            this.emitOp(OpCode.OP_POP, node.line);
        } else {
            if (!this.currentFunction) throw new Error("Codegen: Local variable '${node.name}' defined outside a function.");
            if (symbol.localIndex === undefined) {
                throw new Error(`Codegen: Local symbol '${symbol.name}' (defined in ${symbol.definedInScope.name}) has no localIndex.`);
            }

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

            if (symbol.definedInScope === this.symbolTable.globalScope) {
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

        console.log(
            `[BCG] visitIdentifier: Compiling access to 'arr' inside 'bubbleSort'. Symbol name: ${symbol.name}, type: ${symbol.type}, localIndex: ${symbol.localIndex}, definedInScope: ${symbol.definedInScope.name}`
        );

        if (symbol.definedInScope === this.symbolTable.globalScope) {
            const nameConstIndex = this.currentChunk.addConstant(
                objectValue({ type: ValueType.STRING_OBJ, value: node.name } as VMString)
            );
            this.emitOp(OpCode.OP_LOAD_GLOBAL, node.line);
            this.emitShort(nameConstIndex, node.line);
        } else {
            if (symbol.localIndex === undefined) {
                console.error(`[BCG] visitIdentifier ERROR: Local symbol '${node.name}' (type: ${symbol.type}, definedIn: ${symbol.definedInScope.name}) missing localIndex.`);
                this.symbolTable.print();
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
            default:
                throw new Error(`Unsupported binary operator: ${node.operator}`);
        }
    }

    private compileAndOr(node: BinaryExpr, isAnd: boolean): void {
        this.visit(node.left);
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

        this.visit(node.condition);
        const exitJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE, node.line);

        this.emitOp(OpCode.OP_POP, node.line);
        this.visit(node.body);
        this.emitLoop(loopStart, node.line);

        this.patchJump(exitJump);
        this.emitOp(OpCode.OP_POP, node.line);

        this.loopStack.pop();
    }

    private visitCallExpr(node: CallExpr): void {
        this.visit(new Identifier(node.callee, node.line, node.column));

        for (const arg of node.args) {
            this.visit(arg);
        }

        this.emitOp(OpCode.OP_CALL, node.line);
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