import { ASTBuilder } from './builder';
import {
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
} from './entity';
import { Token, Lexeme, GrammarRule, Position } from '@common/types';

describe('AST Builder', () => {
    const DUMMY_POS: Position = { line: 0, column: 0 };

    beforeEach(() => {
        // Сбрасываем состояние ASTBuilder перед каждым тестом
        ASTBuilder.initialize();
    });

    describe('Базовые узлы AST', () => {
        test('должен создавать Program', () => {
            const stmt1 = new VarDecl('x', 'int');
            const stmt2 = new VarDecl('y', 'int');
            const node = ASTBuilder.buildNode('Program', [stmt1, stmt2], {} as GrammarRule);

            expect(node).toBeInstanceOf(Program);
            expect((node as Program).statements).toHaveLength(2);
            expect((node as Program).statements[0]).toBe(stmt1);
            expect((node as Program).statements[1]).toBe(stmt2);
        });

        test('должен создавать Block с новой областью видимости', () => {
            const stmt = new VarDecl('x', 'int');
            const node = ASTBuilder.buildNode('Block', [stmt], {} as GrammarRule);

            expect(node).toBeInstanceOf(Block);
            expect((node as Block).statements).toHaveLength(1);
            expect((node as Block).statements[0]).toBe(stmt);
        });

        test('должен создавать Literal', () => {
            const token: Token = {
                type: Lexeme.INTEGER,
                lexeme: '42',
                position: DUMMY_POS
            };
            const node = ASTBuilder.buildNode('Literal', [token], {} as GrammarRule);

            expect(node).toBeInstanceOf(Literal);
            expect((node as Literal).value).toBe(42);
        });

        test('должен создавать Identifier', () => {
            const token: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'myVar',
                position: DUMMY_POS
            };
            const node = ASTBuilder.buildNode('Ident', [token], {} as GrammarRule);

            expect(node).toBeInstanceOf(Identifier);
            expect((node as Identifier).name).toBe('myVar');
        });
    });

    describe('Области видимости', () => {
        beforeEach(() => {
            ASTBuilder.initialize();
        });

        test('должен правильно обрабатывать вложенные области видимости', () => {
            // Глобальная область
            const globalVar: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'global',
                position: DUMMY_POS
            };
            const typeToken: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'int',
                position: DUMMY_POS
            };
            ASTBuilder.buildNode('VarDecl', [globalVar, typeToken], {} as GrammarRule);

            // Создаем блок с локальной переменной
            const localVar: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'local',
                position: DUMMY_POS
            };
            const localVarDecl = ASTBuilder.buildNode('VarDecl', [localVar, typeToken], {} as GrammarRule);
            const blockNode = ASTBuilder.buildNode('Block', [localVarDecl], {} as GrammarRule);

            // Проверяем видимость переменных
            expect(ASTBuilder.getRootSymbolTable().lookupGlobal('global')).toBeDefined();
            expect(ASTBuilder.getRootSymbolTable().lookupGlobal('local')).toBeUndefined();
        });

        test('должен правильно обрабатывать области видимости функций', () => {
            // Объявляем функцию
            const funcNameToken: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'test',
                position: DUMMY_POS
            };
            
            // Создаем параметр как узел AST
            const paramName: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'param',
                position: DUMMY_POS
            };
            const paramType: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'int',
                position: DUMMY_POS
            };
            const param = ASTBuilder.buildNode('VarDecl', [paramName, paramType], {} as GrammarRule);

            const returnTypeToken: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'void',
                position: DUMMY_POS
            };
            
            // Локальная переменная внутри функции
            const localVar: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'local',
                position: DUMMY_POS
            };
            const typeToken: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'int',
                position: DUMMY_POS
            };
            const localVarDecl = ASTBuilder.buildNode('VarDecl', [localVar, typeToken], {} as GrammarRule);
            const bodyNode = new Block([localVarDecl]);

            const funcNode = ASTBuilder.buildNode('FuncDecl', [
                funcNameToken,
                param,
                returnTypeToken,
                bodyNode
            ], {} as GrammarRule);

            // Проверяем, что параметр и локальная переменная не видны в глобальной области
            expect(ASTBuilder.getRootSymbolTable().lookupGlobal('param')).toBeUndefined();
            expect(ASTBuilder.getRootSymbolTable().lookupGlobal('local')).toBeUndefined();
            
            // Но функция видна
            expect(ASTBuilder.getRootSymbolTable().lookupGlobal('test')).toBeDefined();
        });
    });

    describe('Системные функции', () => {
        test('должны быть доступны системные функции iput и iget', () => {
            const iput = ASTBuilder.getRootSymbolTable().lookup('iput');
            const iget = ASTBuilder.getRootSymbolTable().lookup('iget');

            expect(iput).toBeDefined();
            expect(iput?.isFunction).toBe(true);
            expect(iput?.paramTypes).toEqual(['int']);

            expect(iget).toBeDefined();
            expect(iget?.isFunction).toBe(true);
            expect(iget?.paramTypes).toEqual([]);
        });

        test('должен правильно обрабатывать вызовы системных функций', () => {
            // Вызов iput
            const iputToken: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'iput',
                position: DUMMY_POS
            };
            const argToken: Token = {
                type: Lexeme.INTEGER,
                lexeme: '42',
                position: DUMMY_POS
            };
            const argNode = ASTBuilder.buildNode('Literal', [argToken], {} as GrammarRule);

            const node = ASTBuilder.buildNode('CallExpr', [iputToken, argNode], {} as GrammarRule);

            expect(node).toBeInstanceOf(CallExpr);
            expect((node as CallExpr).callee).toBe('iput');
            expect((node as CallExpr).args).toHaveLength(1);
        });
    });
}); 