import {
    ASTNode, Program, Block, VarDecl, FuncDecl, Param, AssignExpr, BinaryExpr, UnaryExpr,
    CallExpr, Literal, Identifier, IfStmt, WhileStmt, ReturnStmt, ArrayLiteral,
    ArrayAccess, ParamList, ArgList
} from './entity';
import { GrammarRule } from '../grammar/types';
import { TT } from '../lexer/constants';
import { Token } from '../lexer/type';

export interface Position {
    line: number;
    column: number;
}

function isToken(obj: any): obj is Token {
    return obj && typeof obj === 'object' && 'type' in obj;
}

function getFirstPosition(children: (ASTNode | Token)[]): Position {
    for (const child of children) {
        if (isToken(child) && child.line > 0) {
            return { line: child.line, column: child.column };
        }
        if (child instanceof ASTNode && child.line > 0) {
            return { line: child.line, column: child.column };
        }
    }
    return DUMMY_POS;
}

const DUMMY_POS: Position = { line: 0, column: 0 };

class ASTBuilder {
    static buildNode(actionName: string, children: (ASTNode | Token)[], rule: GrammarRule): ASTNode {
        const pos = getFirstPosition(children);
        const flatten = (arr: any[]): any[] =>
            arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);

        switch (actionName) {
            case 'Program': {
                const statements = children.flatMap(s => s instanceof Program ? s.statements : (s instanceof ASTNode ? [s] : []));
                return new Program(statements, pos.line, pos.column);
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
                return new Block(statements, pos.line, pos.column);
            }

            case 'Statement':
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
                return new BinaryExpr(left as ASTNode, (op as Token).value, right as ASTNode, pos.line, pos.column);
            }

            case 'BaseDeclaration':
            case 'Declaration': {
                const nameToken = children[1] as Token;
                const typeNode = children[3] as Identifier;
                const initializerNode = children[5] as ASTNode;
                const varName = nameToken.value;
                const varType = typeNode.name;
                return new VarDecl(varName, varType, initializerNode, pos.line, pos.column);
            }
            case 'ReturnStatement': {
                return new ReturnStmt(children[1] as ASTNode, pos.line, pos.column);
            }
            case 'Assignment': {
                const left = children[0];
                const value = children[2] as ASTNode;

                if (left instanceof Identifier || left instanceof ArrayAccess) {
                    return new AssignExpr(left, value, pos.line, pos.column);
                }
                if (isToken(left) && left.type === 'id') {
                    return new AssignExpr(new Identifier(left.value, left.line, left.column), value, pos.line, pos.column);
                }
                throw new Error(`Invalid assignment target: ${JSON.stringify(left)}`);
            }
            case "IfStatement": {
                console.log("[ASTBuilder] Reducing IfStatement. Rule RHS:", rule.production.join(' '));
                console.log("[ASTBuilder] Children for IfStatement:", children.map(c => ({ type: (c as any).type, constructorName: c?.constructor?.name, value: (c as Token)?.value }) ));

                const condition = children[2] as ASTNode;
                const thenBranch = children[5] as Block;

                if (!(thenBranch instanceof Block)) {
                    console.error("[ASTBuilder] CRITICAL: thenBranch is NOT a Block!", thenBranch);
                }

                let elseBranch: Block | undefined = undefined;
                if (rule.production.join(' ') === 'if ( <Expression> ) { <Block> } else { <Block> }') {
                    if (children.length >= 10) {
                        const potentialElseBlock = children[9];
                        console.log("[ASTBuilder] Potential elseBranch raw child[9]:", potentialElseBlock);
                        if (potentialElseBlock instanceof Block) {
                            elseBranch = potentialElseBlock;
                        } else {
                            console.error("[ASTBuilder] CRITICAL: children[9] for elseBranch is NOT a Block! It is:", potentialElseBlock?.constructor?.name, potentialElseBlock);
                        }
                    } else {
                        console.error("[ASTBuilder] CRITICAL: Not enough children for IfStmt with else rule. Expected 11, got:", children.length);
                    }
                }

                return new IfStmt(condition, thenBranch, [], elseBranch, pos.line, pos.column);
            }
            case 'WhileStatement': {
                const condition = children[2] as ASTNode;
                const body = children[5] as Block;
                return new WhileStmt(condition, body, pos.line, pos.column);
            }
            case 'FunctionCall': {
                const nameToken = children[0] as Token;
                const argsNode = children[2] as ArgList | undefined;
                const args = argsNode ? argsNode.args : [];
                const funcName = nameToken.value;
                return new CallExpr(funcName, args, pos.line, pos.column);
            }
            case 'FunctionDeclaration': {
                const nameToken = children[1] as Token;
                let paramList: Param[];
                let returnTypeIdentifier: Identifier;
                let body: Block;

                if (children[3] instanceof ParamList) {
                    paramList = (children[3] as ParamList).params;
                    returnTypeIdentifier = children[6] as Identifier;
                    body = children[8] as Block;
                } else {
                    paramList = [];
                    returnTypeIdentifier = children[5] as Identifier;
                    body = children[7] as Block;
                }
                const funcName = nameToken.value;
                const returnType = returnTypeIdentifier.name;
                return new FuncDecl(funcName, paramList, returnType, body, pos.line, pos.column);
            }
            case 'Params': {
                if (children.length === 0) return new ParamList([], pos.line, pos.column);
                const name = (children[0] as Token).value;
                const type = (children[2] as Identifier).name;
                const thisParam = new Param(name, type);
                const otherParams = children.length > 3 && children[3] instanceof ParamList ? (children[3] as ParamList).params : [];
                return new ParamList([thisParam, ...otherParams], pos.line, pos.column);
            }
            case 'MoreParams': {
                if (children.length === 0) return new ParamList([], pos.line, pos.column);
                const name = (children[1] as Token).value;
                const type = (children[3] as Identifier).name;
                const thisParam = new Param(name, type);
                const otherParams = children.length > 4 && children[4] instanceof ParamList ? (children[4] as ParamList).params : [];
                return new ParamList([thisParam, ...otherParams], pos.line, pos.column);
            }
            case 'Args': {
                if (children.length === 0) return new ArgList([], pos.line, pos.column);
                const firstArg = children[0] as ASTNode;
                const otherArgs = children.length > 1 && children[1] instanceof ArgList ? (children[1] as ArgList).args : [];
                return new ArgList([firstArg, ...otherArgs], pos.line, pos.column);
            }
            case 'MoreArgs': {
                if (children.length === 0) return new ArgList([], pos.line, pos.column);
                const firstArg = children[1] as ASTNode;
                const otherArgs = children.length > 2 && children[2] instanceof ArgList ? (children[2] as ArgList).args : [];
                return new ArgList([firstArg, ...otherArgs], pos.line, pos.column);
            }
            case 'Factor': {
                const first = children[0];
                if (first instanceof ASTNode) {
                    return first;
                }
                if (isToken(first)) {
                    switch (first.type) {
                        case TT.IDENTIFIER:
                            if (children.length > 1 && isToken(children[1]) && children[1].type === TT.PUNCT_LPAREN) {
                                const callee = first.value;
                                const argsNode = children[2] as ArgList | undefined;
                                const args = argsNode ? argsNode.args : [];
                                return new CallExpr(callee, args, first.line, first.column);
                            }
                            return new Identifier(first.value, first.line, first.column);
                        case TT.PUNCT_LPAREN:
                            return children[1] as ASTNode;
                        case TT.PUNCT_MINUS:
                            return new UnaryExpr('-', children[1] as ASTNode, first.line, first.column);
                        case TT.NUMBER:
                        case TT.STRING:
                        case TT.KEYWORD_TRUE:
                        case TT.KEYWORD_FALSE: {
                            let value: any = first.value;
                            if (first.type === TT.NUMBER) value = Number(value);
                            else if (first.type === TT.KEYWORD_TRUE) value = true;
                            else if (first.type === TT.KEYWORD_FALSE) value = false;
                            else if (first.type === TT.STRING) value = value.slice(1, -1);
                            return new Literal(value, first.line, first.column);
                        }
                        case TT.PUNCT_LBRACKET:
                            console.log('Factor -> [');
                            return new ArrayLiteral([], pos.line, pos.column);
                    }
                }

                if (children[0] instanceof ArrayLiteral) {
                    return children[0];
                }
                console.log('Unhandled Factor:', JSON.stringify(children, null, 2));
                throw new Error(`Unhandled Factor: ${JSON.stringify(children)}`);
            }
            case 'Type':
                return children[0] as ASTNode;
            case 'BaseType':
                const baseTypeToken = children[0] as Token;
                return new Identifier(baseTypeToken.value, baseTypeToken.line, baseTypeToken.column);
            case 'ArrayType':
                const baseType = (children[0] as Identifier).name;
                const arrayToken = children[1] as Token;
                return new Identifier(`${baseType}[]`, arrayToken.line, arrayToken.column);
            case 'Literal':
                const token = children[0] as Token;
                if (token.type === TT.IDENTIFIER) return new Identifier(token.value, token.line, token.column);
                let value: any;
                switch (token.type) {
                    case TT.NUMBER: value = Number(token.value); break;
                    case TT.STRING: value = token.value.slice(1, -1); break;
                    case TT.KEYWORD_TRUE: value = true; break;
                    case TT.KEYWORD_FALSE: value = false; break;
                    default: value = token.value;
                }
                return new Literal(value, token.line, token.column);
            case 'ArrayLiteral': {
                if (children.length === 2) {
                    return new ArrayLiteral([], pos.line, pos.column);
                }
                const elementsNode = children[1] as ArgList;
                return new ArrayLiteral(elementsNode.args, pos.line, pos.column);
            }
            case 'ArrayElements': {
                const first = children[0] as ASTNode;
                const others = children.length > 1 ? (children[1] as ArgList).args : [];
                return new ArgList([first, ...others], pos.line, pos.column);
            }
            case 'MoreArrayElements': {
                if (children.length === 0) return new ArgList([], pos.line, pos.column);
                const first = children[1] as ASTNode;
                const others = children.length > 2 ? (children[2] as ArgList).args : [];
                return new ArgList([first, ...others], pos.line, pos.column);
            }
            case 'ArrayAccess': {
                const arrayIdentifier = children[0] as Token;
                const index = children[2] as ASTNode;
                return new ArrayAccess(new Identifier(arrayIdentifier.value, arrayIdentifier.line, arrayIdentifier.column), index, pos.line, pos.column);
            }
            case 'ArrayMember': {
                return children[0] as ASTNode;
            }
            default:
                if (children.length === 1 && children[0] instanceof ASTNode) {
                    return children[0];
                }
                console.warn(`Unhandled AST action: ${actionName}`);
                return children[0] instanceof ASTNode ? children[0] : new Identifier(`UNHANDLED:${actionName}`, pos.line, pos.column);
        }
    }
}

export {
    isToken,
    DUMMY_POS,
    ASTBuilder,
}