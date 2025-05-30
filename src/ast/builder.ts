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
import {GrammarRule} from '../grammar/types';
import {TT} from '../lexer/constants';
import {Token} from '../lexer/type';

export interface Position {
    line: number;
    column: number;
} 

import {SymbolTable} from '../symbolTable/symbolTable'

// Вспомогательная функция для проверки, является ли объект токеном
function isToken(obj: any): obj is Token {
    return obj && typeof obj === 'object' && 'type' in obj && 'value' in obj && 'line' in obj && 'column' in obj;
}

// Константа для позиции по умолчанию
const DUMMY_POS: Position = { line: 0, column: 0 };

class ASTBuilder {
    private static rootSymbolTable: SymbolTable;
    private static currentSymbolTable: SymbolTable;

    static initialize() {
        // Инициализация корневой таблицы символов
        this.rootSymbolTable = new SymbolTable();
        this.currentSymbolTable = this.rootSymbolTable;

        // Добавление системных функций
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
                // Сбрасываем текущую таблицу символов на глобальную
                this.currentSymbolTable = this.rootSymbolTable;
                const programStatements = children.filter(c => c instanceof ASTNode);
                const program = new Program(programStatements as ASTNode[]);
                return program;

            case 'Block':
                // Создаем новую область видимости для блока с уникальным именем
                const blockName = `block_${Math.random().toString(36).substr(2, 9)}`;
                this.currentSymbolTable.enterScope(blockName);
                
                // Обрабатываем все дочерние узлы в новой области видимости
                const blockStatements = children.filter(c => c instanceof ASTNode).map(child => {
                    if (child instanceof VarDecl) {
                        // Создаем новую VarDecl с теми же параметрами
                        const varDecl = this.buildNode('VarDecl', [
                            { type: TT.IDENTIFIER, value: child.name, line: 0, column: 0 } as Token,
                            { type: TT.IDENTIFIER, value: child.type, line: 0, column: 0 } as Token
                        ], {} as GrammarRule);
                        return varDecl;
                    }
                    return child;
                });
                
                // Создаем блок
                const block = new Block(blockStatements);
                
                // Возвращаемся в родительскую область видимости
                this.currentSymbolTable.exitScope();
                return block;

            case 'VarDecl':
                const varName = (children[0] instanceof Identifier) 
                    ? (children[0] as Identifier).name 
                    : (isToken(children[0]) ? (children[0] as Token).value : '');
                
                const varType = (children[1] instanceof Identifier)
                    ? (children[1] as Identifier).name
                    : (isToken(children[1]) ? (children[1] as Token).value : '');

                const varInitializer = children[2] instanceof ASTNode ? children[2] : undefined;

                // Добавляем переменную в текущую область видимости
                const varEntry = this.currentSymbolTable.add(
                    varName,
                    varType,
                    varInitializer instanceof Literal ? (varInitializer as Literal).value : undefined,
                    false // isFunction = false для переменных
                );

                if (!varEntry) {
                    throw new Error(`Переменная ${varName} уже объявлена в текущей области видимости`);
                }

                return new VarDecl(varName, varType, varInitializer);

            case 'ConstDecl':
                const constName = (children[0] instanceof Identifier)
                    ? (children[0] as Identifier).name
                    : (isToken(children[0]) ? (children[0] as Token).value : '');
                
                const constType = (children[1] instanceof Identifier)
                    ? (children[1] as Identifier).name
                    : (isToken(children[1]) ? (children[1] as Token).value : '');

                const constValue = children[2] as ASTNode;

                // Добавляем константу в текущую область видимости
                const constEntry = this.currentSymbolTable.add(
                    constName,
                    constType,
                    constValue instanceof Literal ? (constValue as Literal).value : undefined,
                    false, // isFunction = false
                    undefined,
                    undefined,
                    true // isConstant = true
                );

                if (!constEntry) {
                    throw new Error(`Константа ${constName} уже объявлена в текущей области видимости`);
                }

                return new ConstDecl(constName, constType, constValue);

            case 'FuncDecl':
                let funcName: string;
                let funcParams: Param[] = [];
                let funcReturnType = 'void';
                let funcBody: Block | undefined;

                // Получаем имя функции
                if (children[0] instanceof Identifier) {
                    funcName = (children[0] as Identifier).name;
                } else if (isToken(children[0]) && children[0].type === TT.IDENTIFIER) {
                    funcName = (children[0] as Token).value;
                } else {
                    throw new Error("FuncDecl: Ожидался идентификатор имени функции.");
                }

                // Добавляем функцию в глобальную таблицу символов
                const funcEntry = this.rootSymbolTable.add(
                    funcName,
                    'function',
                    undefined,
                    true, // isFunction = true
                    [], // Временно пустой массив параметров
                    funcReturnType,
                    true // isFunctionDefined = true
                );

                if (!funcEntry) {
                    throw new Error(`Функция ${funcName} уже объявлена`);
                }

                // Создаем новую область видимости для функции
                const functionScope = `function_${funcName}`;
                this.currentSymbolTable.enterScope(functionScope);

                // Обрабатываем параметры и тело функции
                for (let i = 1; i < children.length; i++) {
                    const child = children[i];
                    if (child instanceof Block) {
                        funcBody = this.buildNode('Block', child.statements, {} as GrammarRule) as Block;
                    } else if (isToken(child) && child.type === TT.IDENTIFIER) {
                        funcReturnType = (child as Token).value;
                        if (funcEntry) {
                            funcEntry.returnType = funcReturnType;
                        }
                    } else if (child instanceof VarDecl) {
                        const param = new Param(child.name, child.type);
                        funcParams.push(param);
                        
                        const paramEntry = this.currentSymbolTable.add(
                            param.name,
                            param.type,
                            undefined,
                            false // isFunction = false для параметров
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
                this.currentSymbolTable.exitScope();

                return new FuncDecl(funcName, funcParams, funcReturnType, funcBody || new Block([]));

            case 'CallExpr':
                const calleeName = (children[0] instanceof Identifier)
                    ? (children[0] as Identifier).name
                    : (isToken(children[0]) ? (children[0] as Token).value : '');

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
                    : (isToken(children[0]) ? (children[0] as Token).value : '');

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
                    const operator = (children[1] as Token).value;
                    const right = children[2] as ASTNode;
                    return new BinaryExpr(left, operator, right);
                }
                throw new Error(
                    `Invalid children for BinaryExpr action. Rule: ${rule.nonTerminal} -> ${rule.production.join(' ')}. Children: ${JSON.stringify(children.map(c => c instanceof ASTNode ? c.constructor.name : (isToken(c) ? (c as Token).value : 'unknown')))}`
                );

            case 'UnaryExpr':
                if (children.length === 2 &&
                    isToken(children[0]) &&
                    children[1] instanceof ASTNode) {
                    return new UnaryExpr((children[0] as Token).value, children[1] as ASTNode);
                }
                throw new Error(`Invalid children for UnaryExpr action.`);

            case 'Literal':
                if (children.length === 1 && isToken(children[0])) {
                    const token = children[0] as Token;
                    if (token.type === TT.NUMBER) return new Literal(parseInt(token.value, 10));
                    if (token.type === TT.NUMBER) return new Literal(parseFloat(token.value));
                    if (token.type === TT.STRING) return new Literal(token.value);
                    if (token.type === TT.KEYWORD_TRUE) return new Literal(true);
                    if (token.type === TT.KEYWORD_FALSE) return new Literal(false);
                    if (token.value === 'null') return new Literal(null);
                }
                throw new Error(`Invalid children for Literal action. Expected LiteralNode or a value Token. Got: ${JSON.stringify(children)}`);

            case 'Ident':
                if (children.length === 1 && isToken(children[0]) && children[0].type === TT.IDENTIFIER) {
                    return new Identifier((children[0] as Token).value);
                }
                throw new Error(`Invalid children for Identifier action. Expected Identifier Token. Got: ${JSON.stringify(children)}`);

            case 'IfStmt':
                if (children.length < 2) {
                    throw new Error('IfStmt: Недостаточно аргументов');
                }

                const condition = children[0] as ASTNode;
                const thenBranch = children[1] as Block;
                const elifBranches: { condition: ASTNode, block: Block }[] = [];
                let elseBranch: Block | undefined;

                // Обработка elif и else веток
                let i = 2;
                while (i < children.length) {
                    if (children[i] instanceof ASTNode && children[i + 1] instanceof Block) {
                        elifBranches.push({
                            condition: children[i] as ASTNode,
                            block: children[i + 1] as Block
                        });
                        i += 2;
                    } else if (children[i] instanceof Block) {
                        elseBranch = children[i] as Block;
                        break;
                    }
                }

                return new IfStmt(condition, thenBranch, elifBranches, elseBranch);

            case 'WhileStmt':
                if (children.length !== 2 || !(children[0] instanceof ASTNode) || !(children[1] instanceof Block)) {
                    throw new Error('WhileStmt: Неверные аргументы');
                }

                return new WhileStmt(children[0] as ASTNode, children[1] as Block);

            case 'ForStmt':
                if (children.length !== 4) {
                    throw new Error('ForStmt: Неверное количество аргументов');
                }

                const init = children[0] instanceof ASTNode ? children[0] as ASTNode : null;
                const forCondition = children[1] instanceof ASTNode ? children[1] as ASTNode : null;
                const update = children[2] instanceof ASTNode ? children[2] as ASTNode : null;
                const forBody = children[3] as Block;

                return new ForStmt(init, forCondition, update, forBody);

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