import { ASTNode, Program, VarDecl, FuncDecl, Block, IfStmt, WhileStmt, ReturnStmt, AssignExpr, BinaryExpr, UnaryExpr, CallExpr, Literal, Identifier, ArrayLiteral, ArrayAccess, Param, ParamList, ArgList } from '../ast/entity';
import { SymbolTable, SymbolEntry } from '../symbolTable/symbolTable';
import { SemanticError } from './error';

export class SemanticAnalyzer {
    private symbolTable: SymbolTable;
    private currentFunction: SymbolEntry | null = null;

    constructor(symbolTable: SymbolTable) {
        this.symbolTable = symbolTable;
    }

    public analyze(ast: Program): void {
        this.visit(ast);
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
        const paramTypes = node.params.map(p => p.type);
        const funcEntry = this.symbolTable.add(node.name, 'function', undefined, true, paramTypes, node.returnType, true);
        if (!funcEntry) {
            throw new SemanticError(`Function '${node.name}' already declared.`);
        }
        this.currentFunction = funcEntry;
        this.symbolTable.enterScope();
        for (const param of node.params) {
            this.symbolTable.add(param.name, param.type);
        }
        this.visit(node.body);
        this.symbolTable.exitScope();
        this.currentFunction = null;
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
        const targetType = this.visit(node.target);

        if (targetType !== valueType) {
            throw new SemanticError(`Type mismatch: cannot assign '${valueType}' to '${targetType}'`);
        }
    }

    private visitBinaryExpr(node: BinaryExpr): string {
        const leftType = this.visit(node.left);
        const rightType = this.visit(node.right);

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

        throw new SemanticError(`Operator '${node.operator}' cannot be applied to types '${leftType}' and '${rightType}'`);
    }

    private visitUnaryExpr(node: UnaryExpr): string {
        return this.visit(node.operand);
    }

    private visitCallExpr(node: CallExpr): string {
        const symbol = this.symbolTable.lookup(node.callee);
        if (!symbol || !symbol.isFunction) {
            throw new SemanticError(`Function '${node.callee}' not found or not a function`);
        }

        if (symbol.argCount !== node.args.length) {
            throw new SemanticError(`Function '${node.callee}' expects ${symbol.argCount} arguments, but received ${node.args.length}`);
        }

        for (let i = 0; i < node.args.length; i++) {
            const argType = this.visit(node.args[i]);
            const paramType = symbol.paramTypes[i];
            if (argType !== paramType) {
                throw new SemanticError(`Type mismatch: Argument ${i + 1} for function '${node.callee}' expects '${paramType}', but received '${argType}'`);
            }
        }

        return symbol.returnType || 'void';
    }

    private visitArrayAccess(node: ArrayAccess): string {
        const arrayType = this.visit(node.array);
        if (!arrayType.endsWith('[]')) {
            throw new SemanticError(`Cannot access index of non-array type '${arrayType}'`);
        }
        
        const indexType = this.visit(node.index);
        if (indexType !== 'num') {
            throw new SemanticError(`Array index must be of type 'num', but got '${indexType}'`);
        }

        return arrayType.slice(0, -2); // returns element type
    }

    private visitArrayLiteral(node: ArrayLiteral): string {
        if (node.elements.length === 0) {
            return 'any[]'; // or handle as a special case
        }

        const firstElementType = this.visit(node.elements[0]);
        for (let i = 1; i < node.elements.length; i++) {
            const elementType = this.visit(node.elements[i]);
            if (elementType !== firstElementType) {
                throw new SemanticError(`Array elements must have the same type. Found '${firstElementType}' and '${elementType}'`);
            }
        }

        return `${firstElementType}[]`;
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
        const symbol = this.symbolTable.lookup(node.name);
        if (!symbol) {
            throw new SemanticError(`Symbol '${node.name}' not found`);
        }
        return symbol.type;
    }

    private visitIfStmt(node: IfStmt): void {
        const conditionType = this.visit(node.condition);
        if (conditionType !== 'bool') {
            throw new SemanticError(`If statement condition must be a boolean, but got '${conditionType}'`);
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