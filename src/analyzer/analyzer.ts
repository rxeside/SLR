import { ASTNode, Program, VarDecl, FuncDecl, Block, IfStmt, WhileStmt, ReturnStmt, AssignExpr, BinaryExpr, UnaryExpr, CallExpr, Literal, Identifier, ArrayLiteral, ArrayAccess, Param, ParamList, ArgList, Upvalue } from '../ast/entity';
import { SymbolTable, SymbolEntry } from '../symbolTable/symbolTable';
import { SemanticError } from './error';

export class SemanticAnalyzer {
    private symbolTable: SymbolTable;
    private currentFunction: SymbolEntry | null = null;
    private funcStack: FuncDecl[] = [];

    constructor(symbolTable: SymbolTable) {
        this.symbolTable = symbolTable;
    }

    public analyze(ast: Program): void {
        this.symbolTable.enterScope('__EntryPoint__');
        this.visit(ast);
        this.symbolTable.exitScope();
    }

    private visit(node: ASTNode): string | null {
        switch (node.constructor) {
            case Program:           this.visitProgram(node as Program); return null;
            case VarDecl:           this.visitVarDecl(node as VarDecl); return null;
            case AssignExpr:        this.visitAssignExpr(node as AssignExpr); return null;
            case FuncDecl:          this.visitFuncDecl(node as FuncDecl); return null;
            case Block:             this.visitBlock(node as Block); return null;
            case ReturnStmt:        this.visitReturnStmt(node as ReturnStmt); return null;
            case IfStmt:            this.visitIfStmt(node as IfStmt); return null;
            case WhileStmt:         this.visitWhileStmt(node as WhileStmt); return null;
            
            // Expressions
            case CallExpr:          return this.visitCallExpr(node as CallExpr);
            case Literal:           return this.visitLiteral(node as Literal);
            case Identifier:        return this.visitIdentifier(node as Identifier);
            case BinaryExpr:        return this.visitBinaryExpr(node as BinaryExpr);
            case UnaryExpr:         return this.visitUnaryExpr(node as UnaryExpr);
            case ArrayAccess:       return this.visitArrayAccess(node as ArrayAccess);
            case ArrayLiteral:      return this.visitArrayLiteral(node as ArrayLiteral);

            default:
                return null;
        }
    }

    private visitProgram(node: Program): void {
        for (const statement of node.statements) {
            this.visit(statement);
        }
    }

    private visitVarDecl(node: VarDecl): void {
        if (node.initializer) {
            const initializerType = this.visit(node.initializer);
            if (initializerType !== node.type) {
                throw new SemanticError(`Type mismatch: cannot assign '${initializerType}' to '${node.type}'`);
            }
        }
        const success = this.symbolTable.add(node.name, node.type);
        if (!success) {
            throw new SemanticError(`Symbol '${node.name}' already declared in the current scope`);
        }
    }

    private visitFuncDecl(node: FuncDecl): void {
        if (this.symbolTable.lookupCurrentScope(node.name)) {
            throw new SemanticError(`Function '${node.name}' already declared in this scope.`);
        }
        const paramTypes = node.params.map(p => p.type);
        const funcEntry = this.symbolTable.add(node.name, 'function', undefined, true, paramTypes, node.returnType, true);
        if (!funcEntry) {
            throw new SemanticError(`Function '${node.name}' already declared.`);
        }

        this.currentFunction = funcEntry;
        this.funcStack.push(node);

        this.symbolTable.enterScope(node.name);
        for (const param of node.params) {
            this.symbolTable.add(param.name, param.type);
        }
        for (const statement of node.body.statements) {
            this.visit(statement);
        }
        this.symbolTable.exitScope();

        this.funcStack.pop();
        this.currentFunction = this.funcStack.length > 0
            ? this.symbolTable.lookup(this.funcStack[this.funcStack.length - 1].name) || null
            : null;
    }

    private visitBlock(node: Block): void {
        // this.symbolTable.enterScope();
        for (const statement of node.statements) {
            this.visit(statement);
        }
        // this.symbolTable.exitScope();
    }

    private visitAssignExpr(node: AssignExpr): void {
        const valueType = this.visit(node.value);
        const targetType = this.visit(node.target);

        // A bit of a hack for empty arrays
        if (targetType === 'any[]') return;
        if (valueType === 'any[]') return;

        if (targetType !== valueType) {
            throw new SemanticError(`Type mismatch: cannot assign '${valueType}' to '${targetType}'`);
        }
    }

    private visitBinaryExpr(node: BinaryExpr): string {
        const leftType = this.visit(node.left);
        const rightType = this.visit(node.right);

        switch (node.operator) {
            case '+':
                if (leftType === 'num' && rightType === 'num') return 'num';
                if (leftType === 'string' && rightType === 'string') return 'string';
                if (leftType === 'string' && rightType === 'num') return 'string';
                if (leftType === 'num' && rightType === 'string') return 'string';
                break;
            case '-':
            case '*':
            case '/':
            case '%':
                if (leftType === 'num' && rightType === 'num') return 'num';
                break;
            case '<':
            case '>':
            case '==':
            case '!=':
                if (leftType === 'num' && rightType === 'num') return 'bool';
                break;
        }

        throw new SemanticError(`Operator '${node.operator}' cannot be applied to types '${leftType}' and '${rightType}'`);
    }

    private visitUnaryExpr(node: UnaryExpr): string {
        return this.visit(node.operand);
    }

    private visitCallExpr(node: CallExpr): string {
        const calleeName = node.callee.name;
        this.visit(node.callee); // Visit the identifier to resolve it
        const symbol = this.symbolTable.lookup(calleeName);

        if (!symbol || !symbol.isFunction) {
            throw new SemanticError(`'${calleeName}' is not a function`);
        }

        const paramTypes = symbol.paramTypes || [];
        const args = node.args || [];

        // Special case for functions accepting 'any' type, like 'print'
        if (paramTypes.length === 1 && paramTypes[0] === 'any') {
            // For 'print'-like functions, we just analyze the arguments but don't check count.
            for (const arg of args) {
                this.visit(arg);
            }
            return symbol.returnType || 'void';
        }

        // Strict argument count check for all other functions
        if (paramTypes.length !== args.length) {
            throw new SemanticError(`Function '${calleeName}' expects ${paramTypes.length} arguments, but received ${args.length}`);
        }

        // Type check for each argument
        for (let i = 0; i < args.length; i++) {
            const argNode = args[i];
            const argType = this.visit(argNode);
            const expectedType = paramTypes[i];

            if (argType !== expectedType) {
                throw new SemanticError(`Type mismatch: Argument ${i + 1} for function '${calleeName}' expects '${expectedType}', but received '${argType}'`);
            }
        }

        return symbol.returnType || 'void';
    }

    private visitArrayAccess(node: ArrayAccess): string {
        const arrayType = this.visit(node.array);
        if (!arrayType.endsWith('[]')) {
            throw new SemanticError(`Cannot perform array access on non-array type '${arrayType}'.`);
        }
        
        const indexType = this.visit(node.index);
        if (indexType !== 'num') {
            throw new SemanticError(`Array index must be of type 'num', but got '${indexType}'.`);
        }

        // Return the element type, e.g., 'num' from 'num[]'
        return arrayType.slice(0, -2);
    }

    private visitArrayLiteral(node: ArrayLiteral): string {
        if (node.elements.length === 0) {
            // This is tricky in a statically typed language without generics.
            // For now, we'll call it an 'any[]' and let type checking be loose.
            return 'any[]';
        }

        const firstType = this.visit(node.elements[0]);
        for (let i = 1; i < node.elements.length; i++) {
            const elType = this.visit(node.elements[i]);
            if (elType !== firstType) {
                throw new SemanticError(`All elements in an array literal must have the same type. Found '${firstType}' and '${elType}'.`);
            }
        }
        return `${firstType}[]`;
    }

    private visitReturnStmt(node: ReturnStmt): void {
        if (!this.currentFunction) {
            throw new SemanticError("Return statement outside of a function");
        }
        
        const returnType = this.visit(node.value);
        const expectedType = this.currentFunction.returnType;

        if (returnType !== expectedType) {
            throw new SemanticError(`Type mismatch: cannot return '${returnType}' from a function expecting '${expectedType}'`);
        }
    }

    private visitLiteral(node: Literal): string {
        if (typeof node.value === 'number') return 'num';
        if (typeof node.value === 'string') return 'string';
        if (typeof node.value === 'boolean') return 'bool';
        return 'unknown';
    }

    private visitIdentifier(node: Identifier): string {
        const resolution = this.symbolTable.resolve(node.name);

        if (!resolution) {
            // It might be a built-in function like 'print'
            const globalSymbol = this.symbolTable.lookupGlobal(node.name);
            if (globalSymbol && globalSymbol.isFunction) {
                 node.resolution = { type: 'global', depth: 999, index: -1 }; // Index resolved in generator
                 return globalSymbol.returnType || 'void';
            }
            throw new SemanticError(`Undeclared identifier '${node.name}'`);
        }

        const { entry, depth, scope } = resolution;

        if (depth === 0) { // Local variable
            node.resolution = { type: 'local', depth: 0, index: entry.localIndex };
        } else if (scope === this.symbolTable.getGlobalScope()) { // Global variable
             node.resolution = { type: 'global', depth, index: entry.localIndex };
        } else { // Upvalue
            const upvalueIndex = this.addUpvalue(node.name, this.funcStack.length - 1, depth);
            node.resolution = { type: 'upvalue', depth, index: upvalueIndex };
        }

        return entry.type;
    }

    private addUpvalue(name: string, funcIndex: number, depth: number): number {
        const currentFunc = this.funcStack[funcIndex];

        // First, check if this function already captures this variable
        const existingUpvalue = currentFunc.upvalues.find(up => up.name === name);
        if (existingUpvalue) {
            return currentFunc.upvalues.indexOf(existingUpvalue);
        }

        // If the variable is in the immediate parent scope (depth=1), we capture it directly.
        if (depth === 1) {
             const resolution = this.symbolTable.resolve(name);
             if (!resolution) throw new Error("Resolution failed, should not happen");
            
            const upvalue = new Upvalue(name, resolution.entry.localIndex, true);
            currentFunc.upvalues.push(upvalue);
            return currentFunc.upvalues.length - 1;
        }

        // If the variable is further up, we need to ask our parent to capture it,
        // and then we capture it from our parent.
        const parentUpvalueIndex = this.addUpvalue(name, funcIndex - 1, depth - 1);
        const upvalue = new Upvalue(name, parentUpvalueIndex, false); // isLocal = false
        currentFunc.upvalues.push(upvalue);
        return currentFunc.upvalues.length - 1;
    }

    private visitIfStmt(node: IfStmt): void {
        const conditionType = this.visit(node.condition);
        if (conditionType !== 'bool' && conditionType !== 'num') {
            throw new SemanticError(`If statement condition must be a boolean or a number, but got '${conditionType}'`);
        }
        this.visit(node.thenBranch);
        if (node.elseBranch) {
            this.visit(node.elseBranch);
        }
    }

    private visitWhileStmt(node: WhileStmt): void {
        const conditionType = this.visit(node.condition);
        if (conditionType !== 'bool') {
            throw new SemanticError(`While statement condition must be a boolean, but got '${conditionType}'`);
        }
        this.visit(node.body);
    }
} 