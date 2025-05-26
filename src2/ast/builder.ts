import {
    ASTNode,
    Program,
    Block,
    VarDecl,
    ConstDecl,
    FuncDecl,
    Param,
    AssignExpr,
    BinaryExpr,
    UnaryExpr,
    CallExpr,
    Literal,
    Identifier,
    IfStmt,
    WhileStmt,
    ForStmt,
} from './entity'
import {GrammarRule, Token, Lexeme, Position} from '@common/types'
import { SymbolTable } from '../../src2/symbolTable'

// Вспомогательная функция для проверки, является ли объект токеном
function isToken(obj: any): obj is Token {
    return obj && typeof obj === 'object' && 'type' in obj && 'lexeme' in obj && 'position' in obj;
}

class ASTBuilder {
    private static rootSymbolTable: SymbolTable;
    private static currentSymbolTable: SymbolTable;

    static initialize() {
        // Инициализация корневой таблицы символов
        this.rootSymbolTable = new SymbolTable();
        this.currentSymbolTable = this.rootSymbolTable;

        // Добавление системных функций (аналогично C++ версии)
        this.rootSymbolTable.add(
            'iput',
            'function',
            undefined,
            true,
            ['int'],
            'void',
            true
        );

        this.rootSymbolTable.add(
            'iget',
            'function',
            undefined,
            true,
            [],
            'int',
            true
        );
    }

    static buildNode(actionName: string, children: (ASTNode | Token)[], rule: GrammarRule): ASTNode {
        // Инициализируем таблицу символов при первом вызове
        if (!this.rootSymbolTable) {
            this.initialize();
        }

        switch (actionName) {
            case 'Program':
                const programStatements = children.filter(c => c instanceof ASTNode);
                const program = new Program(programStatements as ASTNode[]);
                return program;

            case 'Block':
                // Создаем новую область видимости для блока с уникальным именем
                const blockName = `block_${Math.random().toString(36).substr(2, 9)}`;
                const prevSymbolTable = this.currentSymbolTable;
                this.currentSymbolTable = new SymbolTable();
                this.currentSymbolTable.enterScope(blockName);
                
                const blockStatements = children.filter(c => c instanceof ASTNode);
                const block = new Block(blockStatements as ASTNode[]);
                
                // Возвращаемся в родительскую область видимости
                this.currentSymbolTable = prevSymbolTable;
                return block;

            case 'FuncDecl':
                let funcName: string;
                let funcParams: Param[] = [];
                let funcReturnType = 'void';
                let funcBody: Block;

                // Получаем имя функции
                if (children[0] instanceof Identifier) {
                    funcName = (children[0] as Identifier).name;
                } else if (isToken(children[0]) && children[0].type === Lexeme.IDENTIFIER) {
                    funcName = children[0].lexeme;
                } else {
                    throw new Error("FuncDecl: Ожидался идентификатор имени функции.");
                }

                // Добавляем функцию в глобальную таблицу символов
                const funcEntry = this.rootSymbolTable.add(
                    funcName,
                    'function',
                    undefined,
                    true,
                    [], // Временно пустой массив параметров
                    funcReturnType,
                    true
                );

                if (!funcEntry) {
                    throw new Error(`Функция ${funcName} уже объявлена`);
                }

                // Создаем новую область видимости для функции
                const functionScope = `function_${funcName}`;
                const prevFuncSymbolTable = this.currentSymbolTable;
                this.currentSymbolTable = new SymbolTable();
                this.currentSymbolTable.enterScope(functionScope);

                // Обрабатываем параметры и тело функции
                for (let i = 1; i < children.length; i++) {
                    const child = children[i];
                    if (child instanceof Block) {
                        funcBody = child;
                    } else if (isToken(child) && child.type === Lexeme.IDENTIFIER) {
                        funcReturnType = child.lexeme;
                        // Обновляем тип возврата в записи функции
                        if (funcEntry) {
                            funcEntry.returnType = funcReturnType;
                        }
                    } else if (child instanceof VarDecl) {
                        const param = new Param(child.name, child.type);
                        funcParams.push(param);
                        
                        // Добавляем параметр строго в область видимости функции
                        const paramEntry = this.currentSymbolTable.add(
                            param.name,
                            param.type,
                            undefined,
                            false
                        );

                        if (!paramEntry) {
                            throw new Error(`Параметр ${param.name} уже объявлен в функции`);
                        }
                    }
                }

                // Обновляем информацию о параметрах в записи функции
                if (funcEntry) {
                    funcEntry.paramTypes = funcParams.map(p => p.type);
                    funcEntry.argCount = funcParams.length;
                }

                // Возвращаемся в родительскую область видимости
                this.currentSymbolTable = prevFuncSymbolTable;

                if (!funcBody) {
                    throw new Error("FuncDecl: Ожидался блок для тела функции.");
                }

                return new FuncDecl(funcName, funcParams, funcReturnType, funcBody);

            case 'VarDecl':
                const varName = (children[0] instanceof Identifier) 
                    ? (children[0] as Identifier).name 
                    : (isToken(children[0]) ? children[0].lexeme : '');
                
                const varType = (children[1] instanceof Identifier)
                    ? (children[1] as Identifier).name
                    : (isToken(children[1]) ? children[1].lexeme : '');

                const varInitializer = children[2] instanceof ASTNode ? children[2] : undefined;

                // Добавляем переменную строго в текущую область видимости
                const varEntry = this.currentSymbolTable.add(
                    varName,
                    varType,
                    varInitializer instanceof Literal ? (varInitializer as Literal).value : undefined,
                    false
                );

                if (!varEntry) {
                    throw new Error(`Переменная ${varName} уже объявлена в текущей области видимости`);
                }

                return new VarDecl(varName, varType, varInitializer);

            case 'CallExpr':
                const calleeName = (children[0] instanceof Identifier)
                    ? (children[0] as Identifier).name
                    : (isToken(children[0]) ? children[0].lexeme : '');

                // Проверяем существование функции в глобальной таблице символов
                const funcSymbol = this.rootSymbolTable.lookupGlobal(calleeName);
                if (!funcSymbol || !funcSymbol.isFunction) {
                    throw new Error(`Функция ${calleeName} не объявлена`);
                }

                const args = children.slice(1).filter(c => c instanceof ASTNode) as ASTNode[];

                // Проверяем количество аргументов
                if (funcSymbol.argCount !== undefined && args.length !== funcSymbol.argCount) {
                    throw new Error(`Неверное количество аргументов при вызове функции ${calleeName}. Ожидалось: ${funcSymbol.argCount}, получено: ${args.length}`);
                }

                return new CallExpr(calleeName, args);

            case 'AssignExpr':
                const assignName = (children[0] instanceof Identifier)
                    ? (children[0] as Identifier).name
                    : (isToken(children[0]) ? children[0].lexeme : '');

                // Проверяем существование переменной в текущей области видимости
                const assignSymbol = this.currentSymbolTable.lookup(assignName);
                if (!assignSymbol) {
                    throw new Error(`Переменная ${assignName} не объявлена`);
                }

                const assignValue = children[1] as ASTNode;
                return new AssignExpr(assignName, assignValue);

            case 'BinaryExpr':
                if (children.length === 3 &&
                    children[0] instanceof ASTNode &&
                    isToken(children[1]) &&
                    children[2] instanceof ASTNode) {
                    const left = children[0] as ASTNode;
                    const operator = children[1].lexeme;
                    const right = children[2] as ASTNode;
                    return new BinaryExpr(left, operator, right);
                }
                throw new Error(
                    `Invalid children for BinaryExpr action. Rule: ${rule.left} -> ${rule.right.join(' ')}. Children: ${JSON.stringify(children.map(c => c instanceof ASTNode ? c.constructor.name : (isToken(c) ? c.lexeme : 'unknown')))}`
                );

            case 'UnaryExpr':
                if (children.length === 2 &&
                    isToken(children[0]) &&
                    children[1] instanceof ASTNode) {
                    return new UnaryExpr(children[0].lexeme, children[1] as ASTNode);
                }
                throw new Error(`Invalid children for UnaryExpr action.`);

            case 'Literal':
                if (children.length === 1 && isToken(children[0])) {
                    const token = children[0];
                    if (token.type === Lexeme.INTEGER) return new Literal(parseInt(token.lexeme, 10));
                    if (token.type === Lexeme.FLOAT) return new Literal(parseFloat(token.lexeme));
                    if (token.type === Lexeme.STRING) return new Literal(token.lexeme);
                    if (token.type === Lexeme.TRUE) return new Literal(true);
                    if (token.type === Lexeme.FALSE) return new Literal(false);
                    if (token.lexeme === 'null') return new Literal(null);
                }
                throw new Error(`Invalid children for Literal action. Expected LiteralNode or a value Token. Got: ${JSON.stringify(children)}`);

            case 'Ident':
                if (children.length === 1 && isToken(children[0]) && children[0].type === Lexeme.IDENTIFIER) {
                    return new Identifier(children[0].lexeme);
                }
                throw new Error(`Invalid children for Identifier action. Expected Identifier Token. Got: ${JSON.stringify(children)}`);

            case 'Num':
                if (children.length === 1 && isToken(children[0]) &&
                    (children[0].type === Lexeme.INTEGER || children[0].type === Lexeme.FLOAT)) {
                    const tokenVal = children[0].lexeme;
                    const numVal = children[0].type === Lexeme.INTEGER ? parseInt(tokenVal, 10) : parseFloat(tokenVal);
                    return new Literal(numVal);
                }
                throw new Error(`Invalid children for Num action. Expected LiteralNode or Number Token. Got: ${JSON.stringify(children)}`);

            default:
                throw new Error(`Unknown AST action name: ${actionName}`);
        }
    }

    static getCurrentSymbolTable(): SymbolTable {
        return this.currentSymbolTable;
    }

    static getRootSymbolTable(): SymbolTable {
        if (!this.rootSymbolTable) {
            this.initialize();
        }
        return this.rootSymbolTable;
    }
}

export {
    ASTBuilder,
}