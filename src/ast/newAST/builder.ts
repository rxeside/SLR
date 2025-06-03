// src/ast/builder.ts
import { Token } from '@src/lexer/type'; // Убедитесь, что путь корректен
import { TT } from '@src/lexer/constants'; // Убедитесь, что путь корректен
import { GrammarRule } from '@src/grammar/types'; // Убедитесь, что путь корректен
import {
    AstNode, ProgramNode, StatementNode, ExpressionNode, DeclarationNode,
    VariableDeclarationNode, FunctionDeclarationNode, ParameterDeclarationNode,
    BlockNode, IfStatementNode, WhileStatementNode, ReturnStatementNode,
    AssignmentStatementNode, ExpressionStatementNode,
    BinaryExpressionNode, CallExpressionNode, ArrayAccessExpressionNode, GroupedExpressionNode,
    IdentifierNode, NumberLiteralNode, StringLiteralNode, BooleanLiteralNode, ArrayLiteralNode,
    TypeAnnotationNode, SemanticValue, UnaryExpressionNode
} from './nodes';

export class AstBuilder {
    private static getToken(child: SemanticValue, expectedValue?: string | string[] | null, expectedType?: string | string[] | null): Token {
        if (!(child instanceof Token)) {
            throw new Error(`ASTB: Ожидался Token, получен ${child?.constructor.name} (${JSON.stringify(child)})`);
        }
        if (expectedValue !== undefined && expectedValue !== null) {
            const values = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
            if (!values.includes(child.value)) {
                throw new Error(`ASTB: Ожидался токен со значением '${values.join('/')}', получен '${child.value}' (тип ${child.type})`);
            }
        }
        if (expectedType !== undefined && expectedType !== null) {
            const types = Array.isArray(expectedType) ? expectedType : [expectedType];
            if (!types.includes(child.type)) {
                throw new Error(`ASTB: Ожидался токен с типом '${types.join('/')}', получен '${child.type}' (значение ${child.value})`);
            }
        }
        return child;
    }

    // Измененный getNode: теперь принимает конструктор базового типа (для instanceof)
    // и опционально конкретный kind для более точной проверки.
    private static getNode<TBase extends AstNode, TSpecific extends TBase = TBase>(
        child: SemanticValue,
        baseNodeType: { new(...args: any[]): TBase }, // Например, StatementNode, ExpressionNode
        specificKind?: TSpecific['kind'] // Например, 'IfStatement', 'VariableDeclaration'
    ): TSpecific {
        if (!(child instanceof baseNodeType)) {
            const childDesc = child instanceof AstNode ? child.kind : child?.constructor.name;
            throw new Error(`ASTB: Ожидался узел, являющийся экземпляром ${baseNodeType.name}, получен ${childDesc}`);
        }
        if (specificKind && child.kind !== specificKind) {
            throw new Error(`ASTB: Ожидался узел с kind '${specificKind}', получен '${child.kind}'`);
        }
        return child as TSpecific;
    }

    // Измененный getNodeArray: аналогично getNode
    private static getNodeArray<TBase extends AstNode, TSpecific extends TBase = TBase>(
        child: SemanticValue,
        baseNodeType: { new(...args: any[]): TBase },
        specificItemKind?: TSpecific['kind'] // Если все элементы должны быть одного конкретного типа
    ): TSpecific[] {
        if (!Array.isArray(child)) {
            throw new Error(`ASTB: Ожидался массив, получен ${child?.constructor.name}`);
        }
        for (const item of child) {
            if (!(item instanceof baseNodeType)) {
                const itemDesc = item instanceof AstNode ? item.kind : item?.constructor.name;
                throw new Error(`ASTB: Ожидался массив узлов, являющихся экземплярами ${baseNodeType.name}, но найден элемент ${itemDesc}`);
            }
            if (specificItemKind && item.kind !== specificItemKind) {
                throw new Error(`ASTB: Ожидался массив узлов с kind '${specificItemKind}', но найден элемент с kind '${item.kind}'`);
            }
        }
        return child as TSpecific[];
    }

    public static buildNode(
        actionName: string | undefined,
        children: SemanticValue[],
        rule: GrammarRule,
        defaultToken: Token
    ): SemanticValue {
        // ... (логика для !actionName как раньше) ...
        if (!actionName) {
            if (rule.production.length === 0 || (rule.production.length === 1 && rule.production[0] === 'ε')) return null;
            if (rule.production.length === 1 && children.length === 1) return children[0];

            const firstMeaningfulChild = children.find(c => c instanceof AstNode || c instanceof Token);
            if (firstMeaningfulChild) return firstMeaningfulChild;

            console.warn(`ASTB: Нет действия для правила ${rule.id}: ${rule.nonTerminal} -> ${rule.production.join(' ')} (дети: ${children.length}). Возвращается null.`);
            return null;
        }

        const currentStartTokenOrNode = children.find(c => c instanceof AstNode || c instanceof Token);
        let effectiveStartToken: Token;
        if (currentStartTokenOrNode instanceof AstNode) {
            effectiveStartToken = currentStartTokenOrNode.startToken;
        } else if (currentStartTokenOrNode instanceof Token) {
            effectiveStartToken = currentStartTokenOrNode;
        } else {
            effectiveStartToken = defaultToken;
        }


        try {
            switch (actionName) {
                // === PROGRAM ===
                case "Program_PrependStatement": {
                    const stmt = this.getNode(children[0], StatementNode); // Проверяем, что это StatementNode или его наследник
                    const prog = this.getNode(children[1], ProgramNode, 'Program'); // Конкретный kind
                    return new ProgramNode([stmt, ...prog.statements], stmt.startToken);
                }
                case "Program_SingleStatement": {
                    const stmt = this.getNode(children[0], StatementNode);
                    return new ProgramNode([stmt], stmt.startToken);
                }

                // === STATEMENTS ===
                case "Stmt_Passthrough": return children[0];
                case "Stmt_PassthroughToExprStmt": {
                    const callExpr = this.getNode(children[0], CallExpressionNode, 'CallExpression');
                    return new ExpressionStatementNode(callExpr);
                }
                case "Stmt_MakeReturn": {
                    const retTok = this.getToken(children[0], TT.KEYWORD_RETURN);
                    const expr = this.getNode(children[1], ExpressionNode);
                    this.getToken(children[2], TT.PUNCT_SEMICOLON);
                    return new ReturnStatementNode(retTok, expr);
                }
                case "Stmt_MakeAssignmentToIdent": {
                    const idTok = this.getToken(children[0], null, TT.IDENTIFIER);
                    const opTok = this.getToken(children[1], '=', TT.OPERATOR_ASSIGN);
                    const val = this.getNode(children[2], ExpressionNode);
                    this.getToken(children[3], ';', TT.PUNCT_SEMICOLON);
                    return new AssignmentStatementNode(new IdentifierNode(idTok), opTok, val);
                }
                case "Stmt_MakeAssignmentToArrayAccess": {
                    const target = this.getNode(children[0], ArrayAccessExpressionNode, 'ArrayAccessExpression');
                    const opTok = this.getToken(children[1], '=', TT.OPERATOR_ASSIGN);
                    const val = this.getNode(children[2], ExpressionNode);
                    this.getToken(children[3], ';', TT.PUNCT_SEMICOLON);
                    return new AssignmentStatementNode(target, opTok, val);
                }
                case "Stmt_MakeIf": {
                    const ifTok = this.getToken(children[0], TT.KEYWORD_IF);
                    const cond = this.getNode(children[2], ExpressionNode);
                    const lBrace = this.getToken(children[4], TT.PUNCT_LBRACE);
                    const blockStmts = this.getNodeArray(children[5], StatementNode); // Массив любых StatementNode
                    this.getToken(children[6], TT.PUNCT_RBRACE); // Проверяем закрывающую скобку
                    return new IfStatementNode(ifTok, cond, new BlockNode(blockStmts, lBrace));
                }
                case "Stmt_MakeIfElse": {
                    const ifTok = this.getToken(children[0], TT.KEYWORD_IF);
                    const cond = this.getNode(children[2], ExpressionNode);
                    const thenLBrace = this.getToken(children[4], TT.PUNCT_LBRACE);
                    const thenStmts = this.getNodeArray(children[5], StatementNode);
                    this.getToken(children[6], TT.PUNCT_RBRACE);
                    this.getToken(children[7], TT.KEYWORD_ELSE);
                    const elseLBrace = this.getToken(children[8], TT.PUNCT_LBRACE);
                    const elseStmts = this.getNodeArray(children[9], StatementNode);
                    this.getToken(children[10], TT.PUNCT_RBRACE);
                    return new IfStatementNode(ifTok, cond, new BlockNode(thenStmts, thenLBrace), new BlockNode(elseStmts, elseLBrace));
                }
                case "Stmt_MakeWhile": {
                    const whileTok = this.getToken(children[0], TT.KEYWORD_WHILE);
                    const cond = this.getNode(children[2], ExpressionNode);
                    const lBrace = this.getToken(children[4], TT.PUNCT_LBRACE);
                    const blockStmts = this.getNodeArray(children[5], StatementNode);
                    this.getToken(children[6], TT.PUNCT_RBRACE);
                    return new WhileStatementNode(whileTok, cond, new BlockNode(blockStmts, lBrace));
                }

                // === DECLARATIONS ===
                case "Decl_Passthrough": return children[0];
                case "Decl_MakeVariable": {
                    const letTok = this.getToken(children[0], TT.KEYWORD_LET);
                    const idTok = this.getToken(children[1], null, TT.IDENTIFIER);
                    this.getToken(children[2],':');
                    const typeAnn = this.getNode(children[3], TypeAnnotationNode, 'TypeAnnotation');
                    this.getToken(children[4],'=');
                    const initializer = this.getNode(children[5], ExpressionNode);
                    this.getToken(children[6],';');
                    return new VariableDeclarationNode(letTok, new IdentifierNode(idTok), typeAnn, initializer);
                }
                case "Decl_MakeFunction": {
                    const funcTok = this.getToken(children[0], TT.KEYWORD_FUNCTION);
                    const idTok = this.getToken(children[1], null, TT.IDENTIFIER);
                    const paramsList = this.getNodeArray(children[3], ParameterDeclarationNode, 'ParameterDeclaration'); // Конкретный kind
                    const retType = this.getNode(children[6], TypeAnnotationNode, 'TypeAnnotation');
                    const lBrace = this.getToken(children[7], TT.PUNCT_LBRACE);
                    const bodyStmts = this.getNodeArray(children[8], StatementNode);
                    this.getToken(children[9], TT.PUNCT_RBRACE);
                    return new FunctionDeclarationNode(funcTok, new IdentifierNode(idTok), paramsList, retType, new BlockNode(bodyStmts, lBrace));
                }

                // === BLOCK === (возвращает StatementNode[])
                case "Block_PrependStatement": {
                    const stmt = this.getNode(children[0], StatementNode);
                    const stmts = this.getNodeArray(children[1], StatementNode);
                    return [stmt, ...stmts];
                }
                case "Block_SingleStatement": {
                    const stmt = this.getNode(children[0], StatementNode);
                    return [stmt];
                }
                case "Block_MakeEmpty": return [];

                // === PARAMS === (возвращает ParameterDeclarationNode[])
                case "Params_StartList": {
                    const idTok = this.getToken(children[0], null, TT.IDENTIFIER);
                    this.getToken(children[1],':');
                    const typeAnn = this.getNode(children[2], TypeAnnotationNode, 'TypeAnnotation');
                    const more = this.getNodeArray(children[3], ParameterDeclarationNode, 'ParameterDeclaration');
                    const param = new ParameterDeclarationNode(new IdentifierNode(idTok), typeAnn);
                    return [param, ...more];
                }
                case "Params_AppendToList": {
                    this.getToken(children[0],',');
                    const idTok = this.getToken(children[1], null, TT.IDENTIFIER);
                    this.getToken(children[2],':');
                    const typeAnn = this.getNode(children[3], TypeAnnotationNode, 'TypeAnnotation');
                    const more = this.getNodeArray(children[4], ParameterDeclarationNode, 'ParameterDeclaration');
                    const param = new ParameterDeclarationNode(new IdentifierNode(idTok), typeAnn);
                    return [param, ...more];
                }
                case "Params_MakeEmptyList":
                case "Params_MakeEmptyMoreList": return [];

                // === ARGS === (возвращает ExpressionNode[])
                case "Args_StartList": {
                    const expr = this.getNode(children[0], ExpressionNode);
                    const more = this.getNodeArray(children[1], ExpressionNode);
                    return [expr, ...more];
                }
                case "Args_AppendToList": {
                    this.getToken(children[0],',');
                    const expr = this.getNode(children[1], ExpressionNode);
                    const more = this.getNodeArray(children[2], ExpressionNode);
                    return [expr, ...more];
                }
                case "Args_MakeEmptyList":
                case "Args_MakeEmptyMoreList": return [];

                // === TYPES === (возвращает TypeAnnotationNode)
                case "Type_Passthrough": return children[0];
                case "Type_MakeBase": {
                    const typeTok = this.getToken(children[0], null, TT.IDENTIFIER);
                    if (!['bool', 'num', 'string'].includes(typeTok.value)) throw new Error(`Invalid base type token: ${typeTok.value}`);
                    return new TypeAnnotationNode(typeTok, 0, typeTok);
                }
                case "Type_ArrayFromBase": {
                    const baseType = this.getNode(children[0], TypeAnnotationNode, 'TypeAnnotation');
                    this.getToken(children[1], '[');
                    this.getToken(children[2], ']');
                    if (baseType.dimensions !== 0) throw new Error("Expected base type for array creation");
                    return new TypeAnnotationNode(baseType.baseNameToken, 1, baseType.startToken);
                }
                case "Type_IncrementDim": {
                    const arrayType = this.getNode(children[0], TypeAnnotationNode, 'TypeAnnotation');
                    this.getToken(children[1], '[');
                    this.getToken(children[2], ']');
                    if (arrayType.dimensions === 0) throw new Error("Expected array type to increment dimension");
                    return new TypeAnnotationNode(arrayType.baseNameToken, arrayType.dimensions + 1, arrayType.startToken);
                }

                // === EXPRESSIONS ===
                case "Expr_Passthrough": return children[0];
                case "Expr_MakeBinary": {
                    const left = this.getNode(children[0], ExpressionNode);
                    const opTok = this.getToken(children[1]);
                    const right = this.getNode(children[2], ExpressionNode);
                    return new BinaryExpressionNode(left, opTok, right);
                }
                case "Expr_MakeIdentifier": {
                    const idTok = this.getToken(children[0], null, TT.IDENTIFIER);
                    return new IdentifierNode(idTok);
                }
                case "Expr_MakeCall": {
                    const idTok = this.getToken(children[0], null, TT.IDENTIFIER);
                    const lParen = this.getToken(children[1], '(');
                    const argsList = this.getNodeArray(children[2], ExpressionNode);
                    this.getToken(children[3], ')');
                    return new CallExpressionNode(new IdentifierNode(idTok), lParen, argsList);
                }
                case "Expr_MakeCallAndWrapToStmt": {
                    const idTok = this.getToken(children[0], null, TT.IDENTIFIER);
                    const lParen = this.getToken(children[1], '(');
                    const argsList = this.getNodeArray(children[2], ExpressionNode);
                    this.getToken(children[3], ')');
                    this.getToken(children[4], ';');
                    const callExpr = new CallExpressionNode(new IdentifierNode(idTok), lParen, argsList);
                    return new ExpressionStatementNode(callExpr);
                }
                case "Expr_MakeInitialArrayAccess": {
                    const idTok = this.getToken(children[0], null, TT.IDENTIFIER);
                    const lBracket = this.getToken(children[1], '[');
                    const indexExpr = this.getNode(children[2], ExpressionNode);
                    this.getToken(children[3], ']');
                    return new ArrayAccessExpressionNode(new IdentifierNode(idTok), lBracket, indexExpr);
                }
                case "Expr_ChainArrayAccess": {
                    const targetExpr = this.getNode(children[0], ExpressionNode);
                    const lBracket = this.getToken(children[1], '[');
                    const indexExpr = this.getNode(children[2], ExpressionNode);
                    this.getToken(children[3], ']');
                    return new ArrayAccessExpressionNode(targetExpr, lBracket, indexExpr);
                }
                case "Expr_MakeGrouped": {
                    const lParen = this.getToken(children[0], '(');
                    const expr = this.getNode(children[1], ExpressionNode);
                    this.getToken(children[2], ')');
                    return new GroupedExpressionNode(lParen, expr);
                }
                case "Expr_MakeNumberLiteral": {
                    const numTok = this.getToken(children[0], null, TT.LITERAL_NUMBER); // Используем TT.LITERAL_NUMBER
                    return new NumberLiteralNode(numTok);
                }
                case "Expr_MakeStringLiteral": {
                    const strTok = this.getToken(children[0], null, TT.LITERAL_STRING); // Используем TT.LITERAL_STRING
                    return new StringLiteralNode(strTok);
                }
                case "Expr_MakeBooleanLiteral": {
                    // Терминалы 'true' или 'false' в грамматике должны соответствовать TT.LITERAL_BOOLEAN_TRUE/FALSE
                    const boolTokValue = children[0] instanceof Token ? children[0].value : '';
                    let boolType: string;
                    if (boolTokValue === 'true') boolType = TT.LITERAL_BOOLEAN_TRUE;
                    else if (boolTokValue === 'false') boolType = TT.LITERAL_BOOLEAN_FALSE;
                    else throw new Error (`Unexpected boolean literal value: ${boolTokValue}`);

                    const boolTok = this.getToken(children[0], boolTokValue, boolType);
                    return new BooleanLiteralNode(boolTok);
                }
                case "Expr_MakeArrayLiteral": {
                    const lBracket = this.getToken(children[0], '[');
                    const elements = this.getNodeArray(children[1], ExpressionNode);
                    this.getToken(children[2], ']');
                    return new ArrayLiteralNode(lBracket, elements);
                }

                // === ARRAY ELEMENTS === (возвращает ExpressionNode[])
                case "ArrayElements_StartList": {
                    const member = this.getNode(children[0], ExpressionNode);
                    const more = this.getNodeArray(children[1], ExpressionNode);
                    return [member, ...more];
                }
                case "ArrayElements_AppendToList": {
                    this.getToken(children[0],',');
                    const member = this.getNode(children[1], ExpressionNode);
                    const more = this.getNodeArray(children[2], ExpressionNode);
                    return [member, ...more];
                }
                case "ArrayElements_MakeEmptyList":
                case "ArrayElements_MakeEmptyMoreList": return [];

                default:
                    throw new Error(`ASTB: Неизвестное семантическое действие: '${actionName}' для правила ${rule.nonTerminal} -> ${rule.production.join(' ')}`);
            }
        } catch (e: any) {
            // ... (логика обработки ошибок как раньше) ...
            const errTokenInfo = children.find(c => c instanceof Token) as Token || effectiveStartToken;
            const errLine = errTokenInfo.line;
            const errCol = errTokenInfo.column;
            const errVal = errTokenInfo.value;

            console.error(
                `ASTB Ошибка: ${e.message}\n` +
                `  Действие: ${actionName}, Правило: ${rule.id} (${rule.nonTerminal} -> ${rule.production.join(' ')})\n` +
                `  В районе токена: '${errVal}' (строка ${errLine}, колонка ${errCol})\n` +
                `  Дети (${children.length}): ${children.map(c => c instanceof Token ? `{v:'${c.value}',t:'${c.type}'}` : (c instanceof AstNode ? c.kind : (Array.isArray(c) ? `Array[${c.length}] of ${c.length > 0 ? (c[0] instanceof AstNode ? c[0].kind : c[0]?.constructor.name) : '?'}` : c?.constructor.name))).join(', ')}`
            );
            throw e;
        }
    }
}