import { ASTBuilder } from '../builder';
import {
    VarDecl,
    Literal,
    Identifier,
    FuncDecl,
    Param,
    ParamList,
    Block,
    IfStmt,
    BinaryExpr,
    ASTNode,
} from '../entity';
import { Token } from '../../lexer/type';
import { TT } from '../../lexer/constants';
import { GrammarRule } from '../../grammar/types';

describe('ASTBuilder', () => {
    let mockRule: GrammarRule;

    beforeEach(() => {
        // Создаем мок-объект для правила грамматики, так как он требуется для вызова buildNode
        mockRule = { id: 0, nonTerminal: 'mock', production: [] };
    });

    test('should build a VarDecl for a BaseDeclaration', () => {
        const children: (Token | ASTNode)[] = [
            { type: TT.KEYWORD_LET, value: 'let', line: 1, column: 1 },
            { type: TT.IDENTIFIER, value: 'x', line: 1, column: 5 },
            { type: TT.PUNCT_COLON, value: ':', line: 1, column: 7 },
            new Identifier('num'), // Результат редукции <BaseType>
            { type: TT.OP_ASSIGN, value: '=', line: 1, column: 13 },
            new Literal(42),      // Результат редукции <Expression>
            { type: TT.PUNCT_SEMICOLON, value: ';', line: 1, column: 15 },
        ];

        const result = ASTBuilder.buildNode('BaseDeclaration', children, mockRule);

        expect(result).toBeInstanceOf(VarDecl);
        const varDecl = result as VarDecl;
        expect(varDecl.name).toBe('x');
        expect(varDecl.type).toBe('num');
        expect(varDecl.initializer).toEqual(new Literal(42));
    });

    test('should build a FuncDecl for a FunctionDeclaration', () => {
        const children: (Token | ASTNode)[] = [
            { type: TT.KEYWORD_FUNCTION, value: 'function', line: 1, column: 1 },
            { type: TT.IDENTIFIER, value: 'myFunc', line: 1, column: 10 },
            { type: TT.PUNCT_LPAREN, value: '(', line: 1, column: 16 },
            new ParamList([new Param('a', 'num')]), // Результат редукции <Params>
            { type: TT.PUNCT_RPAREN, value: ')', line: 1, column: 27 },
            { type: TT.PUNCT_COLON, value: ':', line: 1, column: 28 },
            new Identifier('void'),                // Результат редукции <Type>
            { type: TT.PUNCT_LBRACE, value: '{', line: 1, column: 34 },
            new Block([]),                         // Результат редукции <Block>
            { type: TT.PUNCT_RBRACE, value: '}', line: 1, column: 35 },
        ];

        const result = ASTBuilder.buildNode('FunctionDeclaration', children, mockRule);

        expect(result).toBeInstanceOf(FuncDecl);
        const funcDecl = result as FuncDecl;
        expect(funcDecl.name).toBe('myFunc');
        expect(funcDecl.returnType).toBe('void');
        expect(funcDecl.params).toHaveLength(1);
        expect(funcDecl.params[0]).toEqual(new Param('a', 'num'));
        expect(funcDecl.body).toBeInstanceOf(Block);
        expect(funcDecl.body.statements).toHaveLength(0);
    });

    test('should build an IfStmt with an else branch', () => {
        const children: (Token | ASTNode)[] = [
            { type: TT.KEYWORD_IF, value: 'if', line: 1, column: 1 },
            { type: TT.PUNCT_LPAREN, value: '(', line: 1, column: 4 },
            new Literal(true),
            { type: TT.PUNCT_RPAREN, value: ')', line: 1, column: 6 },
            { type: TT.PUNCT_LBRACE, value: '{', line: 1, column: 8 },
            new Block([]),
            { type: TT.PUNCT_RBRACE, value: '}', line: 1, column: 9 },
            { type: TT.KEYWORD_ELSE, value: 'else', line: 1, column: 11 },
            { type: TT.PUNCT_LBRACE, value: '{', line: 1, column: 16 },
            new Block([new Identifier('some_statement')]),
            { type: TT.PUNCT_RBRACE, value: '}', line: 1, column: 17 },
        ];
        const result = ASTBuilder.buildNode('IfStatement', children, mockRule);

        expect(result).toBeInstanceOf(IfStmt);
        const ifStmt = result as IfStmt;
        expect(ifStmt.condition).toEqual(new Literal(true));
        expect(ifStmt.thenBranch).toBeInstanceOf(Block);
        expect(ifStmt.thenBranch.statements).toHaveLength(0);
        expect(ifStmt.elseBranch).toBeInstanceOf(Block);
        expect(ifStmt.elseBranch?.statements).toHaveLength(1);
    });

    test('should build a BinaryExpr for an AddExpr', () => {
        const children: (Token | ASTNode)[] = [
            new Literal(1),
            { type: TT.PUNCT_PLUS, value: '+', line: 1, column: 2 },
            new Literal(2),
        ];

        const result = ASTBuilder.buildNode('AddExpr', children, mockRule);

        expect(result).toBeInstanceOf(BinaryExpr);
        const binExpr = result as BinaryExpr;
        expect(binExpr.operator).toBe('+');
        expect(binExpr.left).toEqual(new Literal(1));
        expect(binExpr.right).toEqual(new Literal(2));
    });

    test('should handle pass-through rules like Expression -> AddExpr', () => {
        const addExpr = new BinaryExpr(new Literal(1), '+', new Literal(2));
        const children: (Token | ASTNode)[] = [addExpr];

        const result = ASTBuilder.buildNode('Expression', children, mockRule);
        expect(result).toBe(addExpr);
    });

    test('should correctly flatten nested Block structures', () => {
        const innerStatement = new Identifier('inner');
        const innerBlock = new Block([innerStatement]);
        const outerStatement = new Identifier('outer');
        
        const children: (Token | ASTNode)[] = [
            outerStatement,
            innerBlock
        ];

        const result = ASTBuilder.buildNode('Block', children, mockRule);
        expect(result).toBeInstanceOf(Block);
        const block = result as Block;
        expect(block.statements).toHaveLength(2);
        expect(block.statements[0]).toBe(outerStatement);
        expect(block.statements[1]).toBe(innerStatement);
    });

    test('should return a placeholder for unhandled actions', () => {
        const children: (Token | ASTNode)[] = [];
        const result = ASTBuilder.buildNode('SomeUnknownRule', children, mockRule);

        expect(result).toBeInstanceOf(Identifier);
        const identifier = result as Identifier;
        expect(identifier.name).toBe('UNHANDLED:SomeUnknownRule');
    });
}); 