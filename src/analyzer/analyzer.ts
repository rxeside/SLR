import {
    ASTNode,
    Program,
    VarDecl,
    FuncDecl,
    Block,
    IfStmt,
    WhileStmt,
    ReturnStmt,
    AssignExpr,
    BinaryExpr,
    UnaryExpr,
    CallExpr,
    Literal,
    Identifier,
    ArrayLiteral,
    ArrayAccess,
    ConstDecl
} from '../ast/entity';
import { SymbolTable, SymbolEntry } from '../symbolTable/symbolTable';
import { ErrorHandler, ErrorType } from '../error/error';

export class SemanticAnalyzer {
    private symbolTable: SymbolTable;
    private errorHandler: ErrorHandler;
    private functionStack: SymbolEntry[] = [];

    constructor(symbolTable: SymbolTable, errorHandler?: ErrorHandler) {
        this.symbolTable = symbolTable;
        this.errorHandler = errorHandler;
    }

    private get currentFunction(): SymbolEntry | null {
        return this.functionStack.length > 0 ? this.functionStack[this.functionStack.length - 1] : null;
    }

    public analyze(ast: Program): void {
        this.visit(ast);
    }

    private visit(node: ASTNode): string | null {
        switch (node.constructor) {
            case Program:           this.visitProgram(node as Program); return null;
            case VarDecl:           this.visitVarDecl(node as VarDecl); return null;
            case ConstDecl:         this.visitConstDecl(node as ConstDecl); return null;
            case AssignExpr:        this.visitAssignExpr(node as AssignExpr); return null;
            case FuncDecl:          this.visitFuncDecl(node as FuncDecl); return null;
            case Block:             this.visitBlock(node as Block); return null;
            case ReturnStmt:        this.visitReturnStmt(node as ReturnStmt); return null;
            case IfStmt:            this.visitIfStmt(node as IfStmt); return null;
            case WhileStmt:         this.visitWhileStmt(node as WhileStmt); return null;
            
            // Expressions
            case Literal:           return this.visitLiteral(node as Literal);
            case Identifier:        return this.visitIdentifier(node as Identifier);
            case BinaryExpr:        return this.visitBinaryExpr(node as BinaryExpr);
            case UnaryExpr:         return this.visitUnaryExpr(node as UnaryExpr);
            case CallExpr:          return this.visitCallExpr(node as CallExpr);
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
        const success = this.symbolTable.add(node.name, node.type, undefined, false, undefined, undefined, false, false);
        if (!success) {
            this.errorHandler?.addError(`Symbol '${node.name}' already declared in the current scope`, node.line, node.column, ErrorType.Semantic);
        }

        if (node.initializer) {
            const initializerType = this.visit(node.initializer);
            if (initializerType !== node.type) {
                this.errorHandler?.addError(`Type mismatch: cannot assign '${initializerType}' to '${node.type}'`, node.line, node.column, ErrorType.Semantic);
            }
        }
    }

    private visitConstDecl(node: ConstDecl): void {
        if (!node.value) {
            this.errorHandler?.addError(`Constant '${node.name}' must be initialized.`, node.line, node.column, ErrorType.Semantic);
            return;
        }

        const success = this.symbolTable.add(node.name, node.type, undefined, false, undefined, undefined, false, true);
        if (!success) {
            this.errorHandler?.addError(`Symbol '${node.name}' already declared in the current scope`, node.line, node.column, ErrorType.Semantic);
            return;
        }

        const initializerType = this.visit(node.value);
        if (initializerType !== node.type) {
            this.errorHandler?.addError(`Type mismatch: cannot assign '${initializerType}' to '${node.type}'`, node.line, node.column, ErrorType.Semantic);
        }
    }

    private visitFuncDecl(node: FuncDecl): void {
        const paramTypes = node.params.map(p => p.type);
        const funcEntry = this.symbolTable.add(node.name, 'function', undefined, true, paramTypes, node.returnType, true);
        if (!funcEntry) {
            this.errorHandler?.addError(`Function '${node.name}' already declared.`, node.line, node.column, ErrorType.Semantic);
            return;
        }
        this.functionStack.push(funcEntry);
        this.symbolTable.enterScope();
        for (const param of node.params) {
            this.symbolTable.add(param.name, param.type);
        }
        
        // Directly visit statements in the function body block
        // to avoid creating an extra scope layer from visitBlock.
        if (node.body && node.body.statements) {
            for (const statement of node.body.statements) {
                this.visit(statement);
            }
        }

        this.symbolTable.exitScope();
        this.functionStack.pop();
    }

    private visitBlock(node: Block): void {
        this.symbolTable.enterScope();
        for (const statement of node.statements) {
            this.visit(statement);
        }
        this.symbolTable.exitScope();
    }

    private visitAssignExpr(node: AssignExpr): void {
        const valueType = this.visit(node.value);
        let targetSymbol;
        if (node.target instanceof Identifier) {
            targetSymbol = this.symbolTable.lookup(node.target.name);
        }

        if (targetSymbol && targetSymbol.isConst) {
            this.errorHandler?.addError(`Cannot assign to constant '${targetSymbol.name}'`, node.line, node.column, ErrorType.Semantic);
            return;
        }

        const targetType = this.visit(node.target);

        if (targetType !== valueType) {
            this.errorHandler?.addError(`Type mismatch: cannot assign '${valueType}' to '${targetType}'`, node.line, node.column, ErrorType.Semantic);
        }
    }

    private visitBinaryExpr(node: BinaryExpr): string | null {
        const leftType = this.visit(node.left);
        const rightType = this.visit(node.right);

        if (!leftType || !rightType) {
            return null; // Stop analysis for this branch if children have errors
        }

        switch (node.operator) {
            case '+':
            case '-':
            case '*':
            case '/':
                if (leftType === 'num' && rightType === 'num') return 'num';
                break;
            case '<':
            case '>':
            case '==':
            case '!=':
                if (leftType === 'num' && rightType === 'num') return 'bool';
                break;
        }

        this.errorHandler.addError(`Operator '${node.operator}' cannot be applied to types '${leftType}' and '${rightType}'`, node.line, node.column, ErrorType.Semantic);
        return null;
    }

    private visitUnaryExpr(node: UnaryExpr): string | null {
        return this.visit(node.operand);
    }

    private visitCallExpr(node: CallExpr): string | null {
        if (node.callee === 'print') {
            if (node.args.length !== 1) {
                this.errorHandler.addError(`Function 'print' expects 1 argument, but received ${node.args.length}`, node.line, node.column, ErrorType.Semantic);
            } else {
                this.visit(node.args[0]); // Analyze the argument
            }
            return 'void';
        }

        if (node.callee === 'arrayLength') {
            if (node.args.length !== 1) {
                this.errorHandler.addError(`Function 'arrayLength' expects 1 argument, but received ${node.args.length}`, node.line, node.column, ErrorType.Semantic);
            } else {
                const argType = this.visit(node.args[0]);
                if (argType && !argType.endsWith('[]')) {
                    this.errorHandler.addError(`Argument for 'arrayLength' must be an array, but got '${argType}'`, node.line, node.column, ErrorType.Semantic);
                }
            }
            return 'num';
        }

        const symbol = this.symbolTable.lookup(node.callee);
        if (!symbol || !symbol.isFunction) {
            this.errorHandler.addError(`Function '${node.callee}' not found or not a function`, node.line, node.column, ErrorType.Semantic);
            return null;
        }

        if (symbol.argCount !== node.args.length) {
            this.errorHandler.addError(`Function '${node.callee}' expects ${symbol.argCount} arguments, but received ${node.args.length}`, node.line, node.column, ErrorType.Semantic);
            return symbol.returnType || 'void';
        }

        for (let i = 0; i < node.args.length; i++) {
            const argType = this.visit(node.args[i]);
            const paramType = symbol.paramTypes[i];
            if (argType !== paramType) {
                this.errorHandler.addError(`Type mismatch: Argument ${i + 1} for function '${node.callee}' expects '${paramType}', but received '${argType}'`, node.line, node.column, ErrorType.Semantic);
            }
        }

        return symbol.returnType || 'void';
    }

    private visitArrayAccess(node: ArrayAccess): string | null {
        const arrayType = this.visit(node.array);
        if (!arrayType?.endsWith('[]')) {
            this.errorHandler.addError(`Cannot access index of non-array type '${arrayType}'`, node.line, node.column, ErrorType.Semantic);
            return null;
        }
        
        const indexType = this.visit(node.index);
        if (indexType !== 'num') {
            this.errorHandler.addError(`Array index must be of type 'num', but got '${indexType}'`, node.line, node.column, ErrorType.Semantic);
        }

        return arrayType.slice(0, -2); // returns element type
    }

    private visitArrayLiteral(node: ArrayLiteral): string | null {
        if (node.elements.length === 0) {
            return 'any[]'; // or handle as a special case
        }

        const firstElementType = this.visit(node.elements[0]);
        for (let i = 1; i < node.elements.length; i++) {
            const elementType = this.visit(node.elements[i]);
            if (elementType !== firstElementType) {
                this.errorHandler.addError(`Array elements must have the same type. Found '${firstElementType}' and '${elementType}'`, node.line, node.column, ErrorType.Semantic);
                break;
            }
        }

        return `${firstElementType}[]`;
    }

    private visitReturnStmt(node: ReturnStmt): void {
        if (!this.currentFunction) {
            this.errorHandler.addError("Return statement outside of a function", node.line, node.column, ErrorType.Semantic);
            return;
        }
        
        const returnType = this.visit(node.value);
        const expectedType = this.currentFunction.returnType;

        if (returnType !== expectedType) {
            this.errorHandler.addError(`Type mismatch: cannot return '${returnType}' from a function expecting '${expectedType}'`, node.line, node.column, ErrorType.Semantic);
        }
    }

    private visitLiteral(node: Literal): string {
        if (typeof node.value === 'number') return 'num';
        if (typeof node.value === 'string') return 'string';
        if (typeof node.value === 'boolean') return 'bool';
        return 'unknown';
    }

    private visitIdentifier(node: Identifier): string | null {
        const symbol = this.symbolTable.lookup(node.name);
        if (!symbol) {
            this.errorHandler.addError(`Symbol '${node.name}' not found`, node.line, node.column, ErrorType.Semantic);
            return null;
        }
        return symbol.type;
    }

    private visitIfStmt(node: IfStmt): void {
        const conditionType = this.visit(node.condition);
        if (conditionType !== 'bool') {
            this.errorHandler?.addError(`If statement condition must be a boolean, but got '${conditionType}'`, node.line, node.column, ErrorType.Semantic);
        }
        this.visit(node.thenBranch);
        if (node.elseBranch) {
            this.visit(node.elseBranch);
        }
    }

    private visitWhileStmt(node: WhileStmt): void {
        const conditionType = this.visit(node.condition);
        if (conditionType !== 'bool') {
            this.errorHandler?.addError(`While statement condition must be a boolean, but got '${conditionType}'`, node.line, node.column, ErrorType.Semantic);
        }
        this.visit(node.body);
    }
} 