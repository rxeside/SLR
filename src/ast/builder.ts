import {ASTNode, BinaryExpr, Identifier, Program} from '@src/ast/entity'
import {GrammarRule, Token} from '@common/types'

class ASTBuilder {
    static buildNode(actionName: string, children: (ASTNode | Token)[], rule: GrammarRule): ASTNode {
        // console.log(`_createASTNode: action=${actionName}, children=`, children.map(c => c instanceof ASTNode ? c.constructor.name : c));
        switch (actionName) {
            case 'Program':
                // Expects an array of statement ASTNodes
                // If <S> is the start symbol for statements
                // And Z -> <S> # ~Program, then children will contain the ASTNode for <S>
                // If Z -> <block_of_statements> # ~Program, children = [BlockNode]
                const statements = children.filter(c => c instanceof ASTNode) as ASTNode[];
                return new Program(statements);

            case 'BinaryExpr':
                // For a rule like <E> -> <E> + <T> ~BinaryExpr
                // children should be [ENode, PlusToken, TNode]
                if (children.length === 3 &&
                    children[0] instanceof ASTNode &&
                    !(children[1] instanceof ASTNode) && // child[1] is a Token (operator)
                    children[2] instanceof ASTNode) {
                    const left = children[0] as ASTNode;
                    const operator = (children[1] as Token).lexeme;
                    const right = children[2] as ASTNode;
                    return new BinaryExpr(left, operator, right);
                }
                    // For a rule like <S> -> id + id ~BinaryExpr
                // children should be [IdentifierNode, PlusToken, IdentifierNode]
                else if (children.length === 3 &&
                    children[0] instanceof Identifier &&
                    !(children[1] instanceof ASTNode) && // Token
                    children[2] instanceof Identifier) {
                    const left = children[0] as Identifier;
                    const operator = (children[1] as Token).lexeme;
                    const right = children[2] as Identifier;
                    return new BinaryExpr(left, operator, right);
                }
                throw new Error(
                    `Invalid children for BinaryExpr action. Rule: ${rule.left} -> ${rule.right.join(' ')}. Children: ${JSON.stringify(children.map(c => c instanceof ASTNode ? c.constructor.name : c))}`
                );

            case 'Ident':
                // For a rule like <T> -> id ~Ident
                // children should be [IdentifierNode] (already created by _handleInsertion)
                if (children.length === 1 && children[0] instanceof Identifier) {
                    return children[0];
                }
                throw new Error(`Invalid children for Ident action. Expected IdentifierNode. Got: ${JSON.stringify(children)}`);

            // Add more cases for other AST node types based on your grammar actions
            // E.g. case 'VarDecl':
            // E.g. case 'Assignment':
            // E.g. case 'IfStatement':

            default:
                throw new Error(`Unknown AST action name: ${actionName}`);
        }
    }
}

export {
    ASTBuilder,
}