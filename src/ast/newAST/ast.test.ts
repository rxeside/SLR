// tests/astBuilder.test.ts
import { AstBuilder } from '@src/ast/newAST/builder';
import {
    ProgramNode, VariableDeclarationNode, IdentifierNode, TypeAnnotationNode,
    NumberLiteralNode, ExpressionNode, StatementNode, BlockNode,
    IfStatementNode, FunctionDeclarationNode, ParameterDeclarationNode,
    ReturnStatementNode, AssignmentStatementNode, BinaryExpressionNode,
    CallExpressionNode, ArrayLiteralNode, ArrayAccessExpressionNode,
    StringLiteralNode, BooleanLiteralNode, GroupedExpressionNode,
    ExpressionStatementNode, AstNode
} from '@src/ast/newAST/nodes';
import { TT } from '@src/lexer/constants'; // Убедитесь, что путь корректен
import { Token } from '@src/lexer/type'; // Убедитесь, что путь корректен
import { GrammarRule } from '@src/grammar/types'; // Убедитесь, что путь корректен

// --- Утилиты для тестов ---
const DUMMY_TOKEN: Token = { type: 'DUMMY', value: 'dummy', line: 0, column: 0 };
const EOF_TOKEN: Token = { type: TT.EOF, value: '$', line: 1, column: 1 };

const tok = (type: string, value: string, line = 1, column = 1): Token => ({ type, value, line, column });

const makeRule = (actionName: string | undefined, nonTerminal: string, production: string[]): GrammarRule => ({
    id: Math.floor(Math.random() * 10000), nonTerminal, production, actionName
});

// Общая функция для вызова AstBuilder.buildNode с дефолтным токеном
const build = (actionName: string | undefined, children: (Token | AstNode | any[])[], ruleNonTerm: string, ruleProd: string[]) => {
    const firstTok = children.find(c => c instanceof Token) as Token ||
        (children.find(c => c instanceof AstNode) as AstNode)?.startToken ||
        DUMMY_TOKEN;
    return AstBuilder.buildNode(actionName, children, makeRule(actionName, ruleNonTerm, ruleProd), firstTok);
};

describe('AstBuilder Full', () => {

    // ==================== Literals & Identifiers ====================
    describe('Literals and Identifiers', () => {
        it('Expr_MakeIdentifier', () => {
            const idToken = tok(TT.IDENTIFIER, 'myVar');
            const node = build('Expr_MakeIdentifier', [idToken], '<Factor>', ['id']) as IdentifierNode;
            expect(node.kind).toBe('Identifier');
            expect(node.name).toBe('myVar');
            expect(node.startToken).toBe(idToken);
        });
        it('Expr_MakeNumberLiteral', () => {
            const numToken = tok(TT.NUMBER, '42.5');
            const node = build('Expr_MakeNumberLiteral', [numToken], '<Factor>', ['number']) as NumberLiteralNode;
            expect(node.kind).toBe('NumberLiteral');
            expect(node.value).toBe(42.5);
        });
        it('Expr_MakeStringLiteral', () => {
            const strToken = tok(TT.STRING_LITERAL, '"hello"');
            const node = build('Expr_MakeStringLiteral', [strToken], '<Factor>', ['string']) as StringLiteralNode;
            expect(node.kind).toBe('StringLiteral');
            expect(node.value).toBe('hello');
        });
        it('Expr_MakeBooleanLiteral (true)', () => {
            const boolToken = tok(TT.KEYWORD_TRUE || TT.KEYWORD_FALSE, 'true');
            const node = build('Expr_MakeBooleanLiteral', [boolToken], '<Factor>', ['true']) as BooleanLiteralNode; // или 'bool' если терминал один
            expect(node.kind).toBe('BooleanLiteral');
            expect(node.value).toBe(true);
        });
        it('Expr_MakeBooleanLiteral (false)', () => {
            const boolToken = tok(TT.KEYWORD_TRUE || TT.KEYWORD_FALSE, 'false');
            const node = build('Expr_MakeBooleanLiteral', [boolToken], '<Factor>', ['false']) as BooleanLiteralNode;
            expect(node.kind).toBe('BooleanLiteral');
            expect(node.value).toBe(false);
        });
    });

    // ==================== Types ====================
    describe('Types', () => {
        it('Type_MakeBase', () => {
            const typeNameToken = tok(TT.IDENTIFIER, 'num');
            const node = build('Type_MakeBase', [typeNameToken], '<BaseType>', ['num']) as TypeAnnotationNode;
            expect(node.kind).toBe('TypeAnnotation');
            expect(node.baseTypeName).toBe('num');
            expect(node.dimensions).toBe(0);
        });
        it('Type_ArrayFromBase', () => {
            const baseT = new TypeAnnotationNode(tok(TT.IDENTIFIER, 'string'), 0, tok(TT.IDENTIFIER, 'string'));
            const node = build('Type_ArrayFromBase', [baseT, tok(TT.PUNCT_LBRACKET, '['), tok(TT.PUNCT_RBRACKET, ']')], '<ArrayType>', ['<BaseType>','[',']']) as TypeAnnotationNode;
            expect(node.dimensions).toBe(1);
            expect(node.baseTypeName).toBe('string');
        });
        it('Type_IncrementDim', () => {
            const arrT = new TypeAnnotationNode(tok(TT.IDENTIFIER, 'bool'), 1, tok(TT.IDENTIFIER, 'bool'));
            const node = build('Type_IncrementDim', [arrT, tok(TT.PUNCT_LBRACKET, '['), tok(TT.PUNCT_RBRACKET, ']')], '<ArrayType>', ['<ArrayType>','[',']']) as TypeAnnotationNode;
            expect(node.dimensions).toBe(2);
            expect(node.baseTypeName).toBe('bool');
        });
    });

    // ==================== Expressions ====================
    describe('Expressions', () => {
        const x = new IdentifierNode(tok(TT.IDENTIFIER, 'x'));
        const y = new IdentifierNode(tok(TT.IDENTIFIER, 'y'));
        const num5 = new NumberLiteralNode(tok(TT.NUMBER, '5'));

        it('Expr_MakeBinary', () => {
            const plusToken = tok(TT.OPERATOR_PLUS, '+');
            const node = build('Expr_MakeBinary', [x, plusToken, y], '<AddExpr>', ['<MulExpr>','+','<AddExpr>']) as BinaryExpressionNode;
            expect(node.kind).toBe('BinaryExpression');
            expect(node.left).toBe(x);
            expect(node.operator).toBe('+');
            expect(node.right).toBe(y);
        });
        it('Expr_MakeGrouped', () => {
            const lParen = tok(TT.PUNCT_LPAREN, '(');
            const node = build('Expr_MakeGrouped', [lParen, x, tok(TT.PUNCT_RPAREN, ')')], '<Factor>', ['(','<Expression>',')']) as GroupedExpressionNode;
            expect(node.kind).toBe('GroupedExpression');
            expect(node.expression).toBe(x);
            expect(node.startToken).toBe(lParen);
        });
        it('Expr_MakeCall', () => {
            const funcIdToken = tok(TT.IDENTIFIER, 'foo');
            const lParen = tok(TT.PUNCT_LPAREN, '(');
            const argsList: ExpressionNode[] = [num5, x];
            const rParen = tok(TT.PUNCT_RPAREN, ')');
            const node = build('Expr_MakeCall', [funcIdToken, lParen, argsList, rParen], '<Factor>', ['id','(','<Args>',')']) as CallExpressionNode;
            expect(node.kind).toBe('CallExpression');
            expect(node.callee.name).toBe('foo');
            expect(node.argumentsList).toEqual(argsList);
        });
        it('Expr_MakeInitialArrayAccess', () => {
            const arrIdToken = tok(TT.IDENTIFIER, 'myArr');
            const lBracket = tok(TT.PUNCT_LBRACKET, '[');
            const rBracket = tok(TT.PUNCT_RBRACKET, ']');
            const node = build('Expr_MakeInitialArrayAccess', [arrIdToken, lBracket, num5, rBracket], '<ArrayAccess>', ['id','[','<ArrayIndex>',']']) as ArrayAccessExpressionNode;
            expect(node.kind).toBe('ArrayAccessExpression');
            expect((node.arrayExpr as IdentifierNode).name).toBe('myArr');
            expect(node.indexExpr).toBe(num5);
        });
        it('Expr_ChainArrayAccess', () => {
            const prevAccess = new ArrayAccessExpressionNode(x, tok(TT.PUNCT_LBRACKET, '['), num5);
            const lBracket = tok(TT.PUNCT_LBRACKET, '[');
            const rBracket = tok(TT.PUNCT_RBRACKET, ']');
            const node = build('Expr_ChainArrayAccess', [prevAccess, lBracket, y, rBracket], '<ArrayAccess>', ['<ArrayAccess>','[','<ArrayIndex>',']']) as ArrayAccessExpressionNode;
            expect(node.arrayExpr).toBe(prevAccess);
            expect(node.indexExpr).toBe(y);
        });
    });

    // ==================== Array Literals ====================
    describe('Array Literals & Elements', () => {
        it('Expr_MakeArrayLiteral (empty)', () => {
            const lBracket = tok(TT.PUNCT_LBRACKET, '[');
            const rBracket = tok(TT.PUNCT_RBRACKET, ']');
            const node = build('Expr_MakeArrayLiteral', [lBracket, [], rBracket], '<ArrayLiteral>', ['[','<ArrayElements>',']']) as ArrayLiteralNode;
            expect(node.kind).toBe('ArrayLiteral');
            expect(node.elements).toEqual([]);
        });
        it('Expr_MakeArrayLiteral (with elements)', () => {
            const lBracket = tok(TT.PUNCT_LBRACKET, '[');
            const elements = [new NumberLiteralNode(tok(TT.NUMBER, '1')), new NumberLiteralNode(tok(TT.NUMBER, '2'))];
            const rBracket = tok(TT.PUNCT_RBRACKET, ']');
            const node = build('Expr_MakeArrayLiteral', [lBracket, elements, rBracket], '<ArrayLiteral>', ['[','<ArrayElements>',']']) as ArrayLiteralNode;
            expect(node.elements).toEqual(elements);
        });
        it('ArrayElements_StartList', () => {
            const member1 = new StringLiteralNode(tok(TT.STRING_LITERAL, '"a"'));
            const more: ExpressionNode[] = []; // <MoreArrayElements> -> ε
            const list = build('ArrayElements_StartList', [member1, more], '<ArrayElements>', ['<ArrayMember>','<MoreArrayElements>']) as ExpressionNode[];
            expect(list).toEqual([member1]);
        });
        it('ArrayElements_AppendToList', () => {
            const comma = tok(TT.PUNCT_COMMA, ',');
            const member2 = new BooleanLiteralNode(tok(TT.KEYWORD_TRUE || TT.KEYWORD_FALSE, 'true'));
            const more: ExpressionNode[] = []; // <MoreArrayElements> -> ε
            const list = build('ArrayElements_AppendToList', [comma, member2, more], '<MoreArrayElements>', [',','<ArrayMember>','<MoreArrayElements>']) as ExpressionNode[];
            expect(list).toEqual([member2]);
        });
        it('ArrayElements_MakeEmptyList / MakeEmptyMoreList', () => {
            expect(build('ArrayElements_MakeEmptyList', [], '<ArrayElements>', [])).toEqual([]);
            expect(build('ArrayElements_MakeEmptyMoreList', [], '<MoreArrayElements>', [])).toEqual([]);
        });
    });

    // ==================== Declarations ====================
    describe('Declarations', () => {
        const letToken = tok(TT.KEYWORD_LET, 'let');
        const varNameToken = tok(TT.IDENTIFIER, 'count');
        const colonToken = tok(TT.PUNCT_COLON, ':');
        const numTypeToken = tok(TT.IDENTIFIER, 'num');
        const numTypeNode = new TypeAnnotationNode(numTypeToken, 0, numTypeToken);
        const equalToken = tok(TT.OPERATOR_ASSIGN, '=');
        const numLiteralToken = tok(TT.NUMBER, '0');
        const numLiteralNode = new NumberLiteralNode(numLiteralToken);
        const semicolonToken = tok(TT.PUNCT_SEMICOLON, ';');

        it('Decl_MakeVariable (Base)', () => {
            const children = [letToken, varNameToken, colonToken, numTypeNode, equalToken, numLiteralNode, semicolonToken];
            const node = build('Decl_MakeVariable', children, '<BaseDeclaration>', ['let','id',':','<BaseType>','=','<Expression>',';']) as VariableDeclarationNode;
            expect(node.kind).toBe('VariableDeclaration');
            expect(node.name.name).toBe('count');
            expect(node.typeAnnotation.fullTypeName).toBe('num');
            expect(node.initializer).toBe(numLiteralNode);
        });

        // Тест для Decl_MakeFunction
        it('Decl_MakeFunction', () => {
            const funcToken = tok(TT.KEYWORD_FUNCTION, 'function');
            const funcNameToken = tok(TT.IDENTIFIER, 'add');
            const lParen = tok(TT.PUNCT_LPAREN, '(');
            // Params: (a: num, b: num)
            const paramA = new ParameterDeclarationNode(new IdentifierNode(tok(TT.IDENTIFIER, 'a')), new TypeAnnotationNode(tok(TT.IDENTIFIER,'num'),0,tok(TT.IDENTIFIER,'num')));
            const paramB = new ParameterDeclarationNode(new IdentifierNode(tok(TT.IDENTIFIER, 'b')), new TypeAnnotationNode(tok(TT.IDENTIFIER,'num'),0,tok(TT.IDENTIFIER,'num')));
            const paramsList: ParameterDeclarationNode[] = [paramA, paramB];
            const rParen = tok(TT.PUNCT_RPAREN, ')');
            const colon = tok(TT.PUNCT_COLON, ':');
            const returnType = new TypeAnnotationNode(tok(TT.IDENTIFIER, 'num'), 0, tok(TT.IDENTIFIER, 'num'));
            const lBrace = tok(TT.PUNCT_LBRACE, '{');
            // Body: return a + b;
            const returnStmt = new ReturnStatementNode(
                tok(TT.KEYWORD_RETURN, 'return'),
                new BinaryExpressionNode(
                    new IdentifierNode(tok(TT.IDENTIFIER, 'a')),
                    tok(TT.OPERATOR_PLUS, '+'),
                    new IdentifierNode(tok(TT.IDENTIFIER, 'b'))
                )
            );
            const bodyStmts: StatementNode[] = [returnStmt];
            const rBrace = tok(TT.PUNCT_RBRACE, '}');

            const children = [funcToken, funcNameToken, lParen, paramsList, rParen, colon, returnType, lBrace, bodyStmts, rBrace];
            const node = build('Decl_MakeFunction', children, '<FunctionDeclaration>', ['function','id','(','<Params>',')',':','<Type>','{','<Block>','}']) as FunctionDeclarationNode;

            expect(node.kind).toBe('FunctionDeclaration');
            expect(node.name.name).toBe('add');
            expect(node.parameters.length).toBe(2);
            expect(node.parameters[0].name.name).toBe('a');
            expect(node.returnType.fullTypeName).toBe('num');
            expect(node.body.statements.length).toBe(1);
            expect(node.body.statements[0].kind).toBe('ReturnStatement');
        });
    });

    // ==================== Statements ====================
    describe('Statements', () => {
        // ... тесты для If, While, Return, Assignment, ExpressionStatement ...
        it('Stmt_MakeAssignmentToIdent', () => {
            const idTok = tok(TT.IDENTIFIER, 'x');
            const eqTok = tok(TT.OPERATOR_ASSIGN, '=');
            const valNode = new NumberLiteralNode(tok(TT.NUMBER, '100'));
            const semiTok = tok(TT.PUNCT_SEMICOLON, ';');
            const node = build('Stmt_MakeAssignmentToIdent', [idTok, eqTok, valNode, semiTok], '<Assignment>', ['id','=','<Expression>',';']) as AssignmentStatementNode;
            expect(node.kind).toBe('AssignmentStatement');
            expect((node.target as IdentifierNode).name).toBe('x');
            expect(node.value).toBe(valNode);
        });
    });

    // ==================== Program & Block ====================
    describe('Program and Block', () => {
        const dummyStmt = new ReturnStatementNode(tok(TT.KEYWORD_RETURN, 'return'));

        it('Program_SingleStatement', () => {
            const node = build('Program_SingleStatement', [dummyStmt], '<Program>', ['<Statement>']) as ProgramNode;
            expect(node.kind).toBe('Program');
            expect(node.statements).toEqual([dummyStmt]);
        });

        it('Block_MakeEmpty', () => {
            const stmts = build('Block_MakeEmpty', [], '<Block>', []) as StatementNode[];
            expect(stmts).toEqual([]);
        });

        it('Block_SingleStatement (returns array)', () => {
            const stmts = build('Block_SingleStatement', [dummyStmt], '<Block>', ['<Statement>']) as StatementNode[];
            expect(stmts).toEqual([dummyStmt]);
        });
    });

    // ==================== Passthrough & Error ====================
    describe('Passthrough and Errors', () => {
        it('Stmt_Passthrough', () => {
            const innerNode = new IfStatementNode(tok(TT.KEYWORD_IF,'if'), new BooleanLiteralNode(tok(TT.KEYWORD_TRUE || TT.KEYWORD_FALSE,'true')), new BlockNode([], tok(TT.PUNCT_LBRACE,'{')));
            const result = build('Stmt_Passthrough', [innerNode], '<Statement>', ['<IfStatement>']);
            expect(result).toBe(innerNode);
        });

        it('should throw for unknown action', () => {
            expect(() => build('UnknownAction', [], '<X>', [])).toThrow(/Неизвестное семантическое действие: 'UnknownAction'/);
        });
        it('should handle rule without action (passthrough first child)', () => {
            const child1 = new NumberLiteralNode(tok(TT.NUMBER, '1'));
            const child2 = new StringLiteralNode(tok(TT.STRING_LITERAL, '"s"'));
            // null actionName
            const result = build(undefined, [child1, child2], '<Expr>', ['<Term>', '<SomethingElse>']);
            expect(result).toBe(child1); // Default behavior: return first child
        });
        it('should handle rule without action (empty production returns null)', () => {
            const result = build(undefined, [], '<EmptyRule>', []);
            expect(result).toBeNull();
        });
    });
});