import {
    ASTNode,
    Program,
    Block,
    VarDecl,
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
    ReturnStmt,
    ArrayLiteral,
    ArrayAccess,
    ParamList,
    ArgList,
} from './entity'
import {GrammarRule} from '../grammar/types';
import {TT} from '../lexer/constants';
import {Token} from '../lexer/type';

export interface Position {
    line: number;
    column: number;
}

// Вспомогательная функция для проверки, является ли объект токеном
function isToken(obj: any): obj is Token {
    return obj && typeof obj === 'object' && 'type' in obj;
}

// Константа для позиции по умолчанию
const DUMMY_POS: Position = { line: 0, column: 0 };

class ASTBuilder {
    static buildNode(actionName: string, children: (ASTNode | Token)[], rule: GrammarRule): ASTNode {
        const flatten = (arr: any[]): any[] =>
            arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);

        switch (actionName) {
            // Meta rules
            case 'Program': {
                const statements = children.flatMap(s => s instanceof Program ? s.statements : (s instanceof ASTNode ? [s] : []));
                return new Program(statements);
            }
            case 'Block': {
                const statements = children.flatMap(c => {
                    if (c instanceof Block) {
                        return c.statements;
                    }
                    if (c instanceof ASTNode) {
                        return [c];
                    }
                    return [];
                });
                return new Block(statements);
            }

            // Pass-through rules that just select the real node
            case 'Statement':
            case 'Declaration':
            case 'Expression':
            case 'ArrayIndex':
            case 'ArrayMember':
            case 'E':
            case 'T':
            case 'F':
                return children[0] as ASTNode;

            case 'LogicExpr':
            case 'EqualityExpr':
            case 'RelExpr':
            case 'AddExpr':
            case 'MulExpr': {
                if (children.length === 1) return children[0] as ASTNode;
                const [left, op, right] = children;
                return new BinaryExpr(left as ASTNode, (op as Token).value, right as ASTNode);
            }

            // Statement Rules
            case 'BaseDeclaration': { // let id : <BaseType> = <Expression> ;
                const nameToken = children[1] as Token;
                const typeNode = children[3] as Identifier;
                const initializerNode = children[5] as ASTNode;

                const varName = nameToken.value;
                const varType = typeNode.name;

                return new VarDecl(varName, varType, initializerNode);
            }
            case 'ArrayDeclaration': { // let id : <ArrayType> = <ArrayLiteral> ;
                const nameToken = children[1] as Token;
                const typeNode = children[3] as Identifier; // From ArrayType rule
                const initializerNode = children[5] as ArrayLiteral;

                const varName = nameToken.value;
                const varType = typeNode.name;

                return new VarDecl(varName, varType, initializerNode);
            }
            case 'ReturnStatement': { // return <Expression> ;
                return new ReturnStmt(children[1] as ASTNode);
            }
            case 'Assignment': { // id = <Expression> ; or <ArrayAccess> = <Expression> ;
                const left = children[0] as Identifier | ArrayAccess;
                const value = children[2] as ASTNode;
                return new AssignExpr(left, value);
            }
            case 'IfStatement': {
                const condition = children[2] as ASTNode;
                const thenBranch = children[5] as Block;
                const elseBranch = children.length > 7 ? (children[9] as Block) : undefined;
                return new IfStmt(condition, thenBranch, [], elseBranch);
            }
            case 'WhileStatement': {
                const condition = children[2] as ASTNode;
                const body = children[5] as Block;
                return new WhileStmt(condition, body);
            }
            case 'FunctionCall': { // id ( <Args> ) ;
                const nameToken = children[0] as Token;
                const argsNode = children[2] as ArgList | undefined;
                const args = argsNode ? argsNode.args : [];
                const funcName = nameToken.value;
                return new CallExpr(funcName, args);
            }
            case 'FunctionDeclaration': {
                const nameToken = children[1] as Token;
                const paramList = (children[3] as ParamList | undefined)?.params || [];
                const returnTypeIdentifier = children[6] as Identifier;
                const body = children[8] as Block;

                const funcName = nameToken.value;
                const returnType = returnTypeIdentifier.name;

                return new FuncDecl(funcName, paramList, returnType, body);
            }
            case 'Params': {
                if (children.length === 0) return new ParamList([]);
                const name = (children[0] as Token).value;
                const type = (children[2] as Identifier).name;
                const thisParam = new Param(name, type);
                const otherParams = children.length > 3 && children[3] instanceof ParamList ? (children[3] as ParamList).params : [];
                return new ParamList([thisParam, ...otherParams]);
            }
            case 'MoreParams': {
                if (children.length === 0) return new ParamList([]);
                const name = (children[1] as Token).value;
                const type = (children[3] as Identifier).name;
                const thisParam = new Param(name, type);
                const otherParams = children.length > 4 && children[4] instanceof ParamList ? (children[4] as ParamList).params : [];
                return new ParamList([thisParam, ...otherParams]);
            }
            case 'Args': {
                if (children.length === 0) return new ArgList([]);
                const firstArg = children[0] as ASTNode;
                const otherArgs = children.length > 1 && children[1] instanceof ArgList ? (children[1] as ArgList).args : [];
                return new ArgList([firstArg, ...otherArgs]);
            }
            case 'MoreArgs': {
                if (children.length === 0) return new ArgList([]);
                const firstArg = children[1] as ASTNode;
                const otherArgs = children.length > 2 && children[2] instanceof ArgList ? (children[2] as ArgList).args : [];
                return new ArgList([firstArg, ...otherArgs]);
            }

            // Expression Rules
            case 'Factor': {
                const first = children[0];

                if (first instanceof ASTNode) { // Rule: <Factor> -> <ArrayAccess>
                    return first;
                }

                if (isToken(first)) {
                    switch (first.type) {
                        case TT.IDENTIFIER:
                            // Rule: <Factor> -> id or <Factor> -> id ( <Args> )
                            if (children.length > 1 && isToken(children[1]) && children[1].type === TT.PUNCT_LPAREN) {
                                const callee = first.value;
                                const argsNode = children[2] as ArgList | undefined;
                                const args = argsNode ? argsNode.args : [];
                                return new CallExpr(callee, args);
                            }
                            return new Identifier(first.value);

                        case TT.PUNCT_LPAREN:
                            // Rule: <Factor> -> ( <Expression> )
                            return children[1] as ASTNode;

                        case TT.PUNCT_MINUS:
                            // Rule: <Factor> -> - <Factor>
                            return new UnaryExpr('-', children[1] as ASTNode);

                        case TT.NUMBER:
                        case TT.STRING:
                        case TT.KEYWORD_TRUE:
                        case TT.KEYWORD_FALSE: {
                            // Rule: <Factor> -> literal
                            let value: any = first.value;
                            if (first.type === TT.NUMBER) value = Number(value);
                            else if (first.type === TT.KEYWORD_TRUE) value = true;
                            else if (first.type === TT.KEYWORD_FALSE) value = false;
                            else if (first.type === TT.STRING) value = value.slice(1, -1);
                            return new Literal(value);
                        }
                    }
                }

                throw new Error(`Unhandled Factor: ${JSON.stringify(children)}`);
            }

            // Type Rules
            case 'Type':
                return children[0] as ASTNode;
            case 'BaseType':
                return new Identifier((children[0] as Token).value);
            case 'ArrayType':
                const baseType = (children[0] as Identifier).name;
                return new Identifier(`${baseType}[]`);

            // Literal / Identifier from Token
            case 'Literal': // A generic case for building literals from single tokens
                const token = children[0] as Token;
                if (token.type === TT.IDENTIFIER) return new Identifier(token.value);

                let value: any;
                switch (token.type) {
                    case TT.NUMBER: value = Number(token.value); break;
                    case TT.STRING: value = token.value.slice(1, -1); break; // remove quotes
                    case TT.KEYWORD_TRUE: value = true; break;
                    case TT.KEYWORD_FALSE: value = false; break;
                    default: value = token.value;
                }
                return new Literal(value);

            // Array Rules
            case 'ArrayAccess': {
                const arrayIdentifier = children[0] as Token;
                const index = children[2] as ASTNode;
                return new ArrayAccess(new Identifier(arrayIdentifier.value), index);
            }
            case 'ArrayLiteral': {
                const elementsNode = children[1] as ArrayLiteral | undefined;
                return elementsNode || new ArrayLiteral([]);
            }
            case 'ArrayElements': {
                if (children.length === 0) return new ArrayLiteral([]);
                const firstEl = children[0] as ASTNode;
                const otherEls = (children.length > 1) ? (children[1] as ArrayLiteral).elements : [];
                return new ArrayLiteral([firstEl, ...otherEls]);
            }
            case 'MoreArrayElements': {
                if (children.length === 0) return new ArrayLiteral([]);
                const firstEl = children[1] as ASTNode;
                const otherEls = (children.length > 2) ? (children[2] as ArrayLiteral).elements : [];
                return new ArrayLiteral([firstEl, ...otherEls]);
            }
            case 'ArrayMember': {
                return children[0] as ASTNode;
            }

            default:
                // For rules like <E> -> <T> etc.
                if (children.length === 1 && children[0] instanceof ASTNode) {
                    return children[0];
                }
                console.warn(`Unhandled AST action: ${actionName}`);
                // Instead of throwing, we return a placeholder or the first child if it's a node
                // This helps to pinpoint grammar issues without crashing
                return children[0] instanceof ASTNode ? children[0] : new Identifier(`UNHANDLED:${actionName}`);
        }
    }
}

export {
    ASTBuilder,
}