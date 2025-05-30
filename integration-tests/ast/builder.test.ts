import { ASTBuilder } from '../../src/ast/builder';
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
} from '../../src/ast/entity';
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
            const varToken: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'x',
                position: DUMMY_POS
            };
            const typeToken: Token = {
                type: Lexeme.IDENTIFIER,
                lexeme: 'int',
                position: DUMMY_POS
            };
            const stmt = ASTBuilder.buildNode('VarDecl', [varToken, typeToken], {} as GrammarRule);
            const node = ASTBuilder.buildNode('Block', [stmt], {} as GrammarRule);

            expect(node).toBeInstanceOf(Block);
            expect((node as Block).statements).toHaveLength(1);
            expect((node as Block).statements[0]).toBeInstanceOf(VarDecl);
            expect((node as Block).statements[0].constructor.name).toBe('VarDecl');
            expect(((node as Block).statements[0] as VarDecl).name).toBe('x');
            expect(((node as Block).statements[0] as VarDecl).type).toBe('int');
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

            // Создаем блок и добавляем в него локальную переменную
            const blockNode = ASTBuilder.buildNode('Block', [
                ASTBuilder.buildNode('VarDecl', [localVar, typeToken], {} as GrammarRule)
            ], {} as GrammarRule);

            // Проверяем видимость переменных
            expect(ASTBuilder.getRootSymbolTable().lookupGlobal('global')).toBeDefined();
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

            // Создаем функцию с параметром
            const funcNode = ASTBuilder.buildNode('FuncDecl', [
                funcNameToken,
                ASTBuilder.buildNode('VarDecl', [paramName, paramType], {} as GrammarRule)
            ], {} as GrammarRule);

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