import {
    ASTNode, Program, VarDecl, FuncDecl, Block, IfStmt, WhileStmt, ReturnStmt,
    AssignExpr, BinaryExpr, UnaryExpr, CallExpr, Literal, Identifier,
    ArrayLiteral, ArrayAccess, Param
} from '../ast/entity';
import { SymbolTable, SymbolEntry, Scope } from '../symbolTable/symbolTable'; // Импортируем Scope
import { ErrorHandler, ErrorType } from '../error/error';

function typeToString(type: string | null): string {
    return type === null ? 'unknown_type' : type;
}

export class SemanticAnalyzer {
    private symbolTable: SymbolTable;
    private errorHandler: ErrorHandler;
    private currentFunction: SymbolEntry | null = null;

    constructor(symbolTable: SymbolTable, errorHandler: ErrorHandler) {
        this.symbolTable = symbolTable;
        this.errorHandler = errorHandler;
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

    private visitBlock(node: Block): void {
        this.symbolTable.enterScope(`block@${node.line}:${node.column}`);
        for (const statement of node.statements) {
            this.visit(statement);
        }
        this.symbolTable.exitScope();
    }

    private visitProgram(node: Program): void {
        for (const statement of node.statements) {
            this.visit(statement);
        }
    }

    private visitVarDecl(node: VarDecl): void {
        let initializerType: string | null = null;
        if (node.initializer) {
            initializerType = this.visit(node.initializer);
            if (initializerType && initializerType !== node.type) {
                this.errorHandler.addError(
                    `Type mismatch: cannot assign type '${typeToString(initializerType)}' to variable '${node.name}' of type '${node.type}'`,
                    node.line, node.column, ErrorType.Semantic
                );
            }
        }
        const symbol = this.symbolTable.add(node.name, node.type);
        if (!symbol) {
            this.errorHandler.addError(
                `Symbol '${node.name}' already declared in the current scope`,
                node.line, node.column, ErrorType.Semantic
            );
        }
    }

    private visitFuncDecl(node: FuncDecl): void {
        const paramTypes = node.params.map(p => p.type);

        const funcEntry = this.symbolTable.add(node.name, 'function', undefined, true, paramTypes, node.returnType);

        if (!funcEntry) {
            this.errorHandler.addError(`Function '${node.name}' already declared or name conflict.`, node.line, node.column, ErrorType.Semantic);
            return;
        }

        const previousFunction = this.currentFunction;
        this.currentFunction = funcEntry;

        const functionBodyScope = this.symbolTable.enterScope(`function_body_${node.name}`);
        funcEntry.functionBodyScope = functionBodyScope;

        for (const param of node.params) {
            const paramSymbol = this.symbolTable.add(param.name, param.type);
            if (!paramSymbol) {
                // Используем line/column всего объявления функции для ошибки параметра,
                // так как у самого Param нет этой информации.
                this.errorHandler.addError(
                    `Parameter name '${param.name}' is already declared or invalid in function '${node.name}'.`,
                    node.line, // Используем строку всего объявления функции
                    node.column, // Используем колонку всего объявления функции (или можно попытаться найти колонку параметра)
                    ErrorType.Semantic
                );
            }
            // Если нужно точнее, то парсер должен добавлять line/column в AST-узел Param
            // (param as any).resolvedType = param.type; // Это не нужно, т.к. param.type уже есть
        }

        // (node as any).resolvedType = node.returnType; // Это не нужно, тип функции хранится в SymbolEntry

        this.visit(node.body);

        this.symbolTable.exitScope();
        this.currentFunction = previousFunction;
    }

    // ... (остальной код без изменений в этом ответе, предполагаем, что он из предыдущего) ...
    // Убедитесь, что все изменения для visitBinaryExpr и т.д. из предыдущего ответа применены.
    private visitBinaryExpr(node: BinaryExpr): string | null {
        const leftType = this.visit(node.left);
        const rightType = this.visit(node.right);

        if (!leftType || !rightType) {
            // (node as any).resolvedType = null; // Присвоение типа узлу здесь необязательно, если visit возвращает тип
            return null;
        }
        let resultType: string | null = null;

        switch (node.operator) {
            case '+':
            case '-':
            case '*':
                if (leftType === 'num' && rightType === 'num') {
                    resultType = 'num';
                }
                break;
            case '<':
            case '>':
                // >=, <=, && - если вы их добавили в грамматику и хотите поддерживать
                // case '<=':
                // case '>=':
                if (leftType === 'num' && rightType === 'num') {
                    resultType = 'bool';
                }
                break;
            case '==':
            case '!=':
                if (leftType === rightType && (leftType === 'num' || leftType === 'bool' || leftType === 'string')) {
                    resultType = 'bool';
                }
                break;
            // case '&&':
            //     if (leftType === 'bool' && rightType === 'bool') {
            //         resultType = 'bool';
            //     }
            //     break;
        }

        if (resultType) {
            // (node as any).resolvedType = resultType; // Присвоение типа узлу здесь необязательно
            return resultType;
        } else {
            this.errorHandler.addError(
                `Operator '${node.operator}' cannot be applied to types '${typeToString(leftType)}' and '${typeToString(rightType)}'`,
                node.line, node.column, ErrorType.Semantic
            );
            // (node as any).resolvedType = null; // Присвоение типа узлу здесь необязательно
            return null;
        }
    }

    // Убедитесь, что остальные visit-методы обновлены согласно предыдущим рекомендациям
    // и вашей текущей грамматике.
    // Особенно visitUnaryExpr, visitCallExpr, visitReturnStmt.
    // ... (остальные методы visit...)
    // ... (visitLiteral, visitIdentifier, visitIfStmt, visitWhileStmt)
    private visitAssignExpr(node: AssignExpr): void {
        const valueType = this.visit(node.value);
        const targetType = this.visit(node.target);

        if (valueType && targetType && targetType !== valueType) {
            this.errorHandler.addError(
                `Type mismatch: cannot assign type '${typeToString(valueType)}' to target of type '${typeToString(targetType)}'`,
                node.line, node.column, ErrorType.Semantic
            );
        }
        // (node as any).resolvedType = valueType; // Необязательно
    }
    private visitUnaryExpr(node: UnaryExpr): string | null {
        const operandType = this.visit(node.operand);
        if (!operandType) {
            // (node as any).resolvedType = null;
            return null;
        }

        let resultType: string | null = null;
        switch (node.operator) {
            case '-':
                if (operandType === 'num') {
                    resultType = 'num';
                }
                break;
            // case '!': // Если есть в грамматике и поддерживается
            //     if (operandType === 'bool') {
            //         resultType = 'bool';
            //     }
            //     break;
        }

        if (resultType) {
            // (node as any).resolvedType = resultType;
            return resultType;
        } else {
            this.errorHandler.addError(
                `Operator '${node.operator}' cannot be applied to type '${typeToString(operandType)}'`,
                node.line, node.column, ErrorType.Semantic
            );
            // (node as any).resolvedType = null;
            return null;
        }
    }

    private visitCallExpr(node: CallExpr): string | null {
        const symbol = this.symbolTable.lookup(node.callee);
        if (!symbol || !symbol.isFunction) {
            this.errorHandler.addError(
                `'${node.callee}' is not a function or not found`,
                node.line, node.column, ErrorType.Semantic
            );
            // (node as any).resolvedType = null;
            return null;
        }

        const expectedArgCount = symbol.paramTypes?.length || 0;
        if (expectedArgCount !== node.args.length) {
            this.errorHandler.addError(
                `Function '${node.callee}' expects ${expectedArgCount} arguments, but received ${node.args.length}`,
                node.line, node.column, ErrorType.Semantic
            );
        }

        if (symbol.paramTypes) {
            for (let i = 0; i < Math.min(node.args.length, symbol.paramTypes.length); i++) {
                const argType = this.visit(node.args[i]);
                const paramType = symbol.paramTypes[i];
                if (argType && argType !== paramType) {
                    this.errorHandler.addError(
                        `Type mismatch: Argument ${i + 1} for function '${node.callee}' expects type '${paramType}', but received type '${typeToString(argType)}'`,
                        node.args[i].line, node.args[i].column, ErrorType.Semantic
                    );
                }
            }
        }

        const returnType = symbol.returnType || 'void';
        // (node as any).resolvedType = returnType;
        return returnType;
    }

    private visitArrayAccess(node: ArrayAccess): string | null {
        const arrayType = this.visit(node.array);

        if (!arrayType || !arrayType.endsWith('[]')) {
            this.errorHandler.addError(
                `Cannot access index of non-array type '${typeToString(arrayType)}'`,
                node.line, node.column, ErrorType.Semantic
            );
            // (node as any).resolvedType = null;
            return null;
        }

        const indexType = this.visit(node.index);
        if (indexType !== 'num') {
            this.errorHandler.addError(
                `Array index must be of type 'num', but got '${typeToString(indexType)}'`,
                node.index.line, node.index.column, ErrorType.Semantic
            );
        }

        const elementType = arrayType.slice(0, -2);
        // (node as any).resolvedType = elementType;
        return elementType;
    }

    private visitArrayLiteral(node: ArrayLiteral): string | null {
        if (node.elements.length === 0) {
            // (node as any).resolvedType = 'any[]';
            return 'any[]';
        }

        const firstElementType = this.visit(node.elements[0]);
        if (!firstElementType) {
            // (node as any).resolvedType = null;
            return null;
        }

        for (let i = 1; i < node.elements.length; i++) {
            const elementType = this.visit(node.elements[i]);
            if (!elementType || elementType !== firstElementType) {
                this.errorHandler.addError(
                    `Array elements must have a consistent type. Expected '${typeToString(firstElementType)}' but found '${typeToString(elementType)}'`,
                    node.elements[i].line, node.elements[i].column, ErrorType.Semantic
                );
                // (node as any).resolvedType = null;
                return null;
            }
        }
        const arrayType = `${firstElementType}[]`;
        // (node as any).resolvedType = arrayType;
        return arrayType;
    }

    private visitReturnStmt(node: ReturnStmt): void {
        if (!this.currentFunction) {
            this.errorHandler.addError(
                "Return statement outside of a function",
                node.line, node.column, ErrorType.Semantic
            );
            return;
        }

        let returnValueType: string | null = 'void';
        if (node.value) {
            returnValueType = this.visit(node.value);
        }

        const expectedReturnType = this.currentFunction.returnType || 'void';

        if (!returnValueType && node.value) {
            return;
        }

        if (returnValueType !== expectedReturnType) {
            if (expectedReturnType === 'void' && returnValueType !== 'void') {
                this.errorHandler.addError(
                    `Function '${this.currentFunction.name}' expects to return 'void', but found return value of type '${typeToString(returnValueType)}'`,
                    node.line, node.column, ErrorType.Semantic
                );
            }
            else if (expectedReturnType !== 'void' && returnValueType === 'void') {
                this.errorHandler.addError(
                    `Function '${this.currentFunction.name}' expects to return type '${expectedReturnType}', but found empty return (effectively 'void')`,
                    node.line, node.column, ErrorType.Semantic
                );
            }
            else if (expectedReturnType !== 'void' && returnValueType !== 'void') {
                this.errorHandler.addError(
                    `Type mismatch: cannot return type '${typeToString(returnValueType)}' from function '${this.currentFunction.name}' expecting type '${expectedReturnType}'`,
                    node.line, node.column, ErrorType.Semantic
                );
            }
        }
    }

    private visitLiteral(node: Literal): string {
        let type: string;
        if (typeof node.value === 'number') type = 'num';
        else if (typeof node.value === 'string') type = 'string';
        else if (typeof node.value === 'boolean') type = 'bool';
        else type = 'unknown';

        // (node as any).resolvedType = type;
        return type;
    }

    private visitIdentifier(node: Identifier): string | null {
        const symbol = this.symbolTable.lookup(node.name);
        if (!symbol) {
            this.errorHandler.addError(
                `Symbol '${node.name}' not found`,
                node.line, node.column, ErrorType.Semantic
            );
            // (node as any).resolvedType = null;
            return null;
        }
        // (node as any).resolvedType = symbol.type;
        return symbol.type;
    }

    private visitIfStmt(node: IfStmt): void {
        const conditionType = this.visit(node.condition);
        if (conditionType && conditionType !== 'bool') {
            this.errorHandler.addError(
                `If statement condition must be a boolean expression, but got type '${typeToString(conditionType)}'`,
                node.condition.line, node.condition.column, ErrorType.Semantic
            );
        }
        this.visit(node.thenBranch);
        if (node.elseBranch) {
            this.visit(node.elseBranch);
        }
    }

    private visitWhileStmt(node: WhileStmt): void {
        const conditionType = this.visit(node.condition);
        if (conditionType && conditionType !== 'bool') {
            this.errorHandler.addError(
                `While statement condition must be a boolean expression, but got type '${typeToString(conditionType)}'`,
                node.condition.line, node.condition.column, ErrorType.Semantic
            );
        }
        this.visit(node.body);
    }
}