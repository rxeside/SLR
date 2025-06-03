import {Token} from '@src/lexer/type'
import {SymbolEntry} from '@src/symbolTable/symbolTable'

export interface AstVisitor<TResult = any> {
    visitProgram(node: ProgramNode): TResult;
    visitBlock(node: BlockNode): TResult;

    // Declarations
    visitVariableDeclaration(node: VariableDeclarationNode): TResult;
    visitFunctionDeclaration(node: FunctionDeclarationNode): TResult;
    visitParameterDeclaration(node: ParameterDeclarationNode): TResult;

    // Statements
    visitIfStatement(node: IfStatementNode): TResult;
    visitWhileStatement(node: WhileStatementNode): TResult;
    visitReturnStatement(node: ReturnStatementNode): TResult;
    visitAssignmentStatement(node: AssignmentStatementNode): TResult;
    visitExpressionStatement(node: ExpressionStatementNode): TResult;

    // Expressions
    visitBinaryExpression(node: BinaryExpressionNode): TResult;
    visitUnaryExpression?(node: UnaryExpressionNode): TResult; // Опционально, если нет унарных операций
    visitCallExpression(node: CallExpressionNode): TResult;
    visitArrayAccessExpression(node: ArrayAccessExpressionNode): TResult;
    visitGroupedExpression(node: GroupedExpressionNode): TResult;

    // Literals & Identifiers
    visitIdentifier(node: IdentifierNode): TResult;
    visitNumberLiteral(node: NumberLiteralNode): TResult;
    visitStringLiteral(node: StringLiteralNode): TResult;
    visitBooleanLiteral(node: BooleanLiteralNode): TResult;
    visitArrayLiteral(node: ArrayLiteralNode): TResult;

    // Types
    visitTypeAnnotation(node: TypeAnnotationNode): TResult;
}

// --- Базовые классы ---
export abstract class AstNode {
    public abstract readonly kind: string;
    public readonly startToken: Token;

    constructor(startToken: Token) {
        this.startToken = startToken;
    }

    get line(): number { return this.startToken.line; }
    get column(): number { return this.startToken.column; }

    abstract accept<TResult>(visitor: AstVisitor<TResult>): TResult;
}

export abstract class StatementNode extends AstNode {}
export abstract class ExpressionNode extends AstNode {
    public inferredType?: TypeAnnotationNode;
}
export abstract class DeclarationNode extends StatementNode {
    public abstract readonly name: IdentifierNode;
    public symbolEntry?: SymbolEntry;
}

// --- Узлы программы и блоков ---
export class ProgramNode extends AstNode {
    public readonly kind = 'Program';
    constructor(public readonly statements: StatementNode[], startToken: Token) {
        super(startToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitProgram(this); }
}

export class BlockNode extends StatementNode {
    public readonly kind = 'Block';
    constructor(public readonly statements: StatementNode[], startToken: Token /* '{' */) {
        super(startToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitBlock(this); }
}

// --- Типы ---
export class TypeAnnotationNode extends AstNode {
    public readonly kind = 'TypeAnnotation';
    constructor(
        public readonly baseNameToken: Token,
        public readonly dimensions: number,
        startToken: Token
    ) {
        super(startToken);
    }
    get baseTypeName(): string { return this.baseNameToken.value; }
    get fullTypeName(): string { return this.baseTypeName + '[]'.repeat(this.dimensions); }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitTypeAnnotation(this); }
}

// --- Объявления ---
export class VariableDeclarationNode extends DeclarationNode {
    public readonly kind = 'VariableDeclaration';
    constructor(
        public readonly keywordToken: Token,
        public readonly name: IdentifierNode,
        public readonly typeAnnotation: TypeAnnotationNode,
        public readonly initializer?: ExpressionNode
    ) {
        super(keywordToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitVariableDeclaration(this); }
}

export class ParameterDeclarationNode extends AstNode { // Не наследуется от StatementNode, но похож на DeclarationNode
    public readonly kind = 'ParameterDeclaration';
    public symbolEntry?: SymbolEntry;
    constructor(
        public readonly name: IdentifierNode,
        public readonly typeAnnotation: TypeAnnotationNode,
    ) {
        super(name.startToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitParameterDeclaration(this); }
}

export class FunctionDeclarationNode extends DeclarationNode {
    public readonly kind = 'FunctionDeclaration';
    constructor(
        public readonly keywordToken: Token,
        public readonly name: IdentifierNode,
        public readonly parameters: ParameterDeclarationNode[],
        public readonly returnType: TypeAnnotationNode,
        public readonly body: BlockNode
    ) {
        super(keywordToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitFunctionDeclaration(this); }
}

// --- Инструкции (Statements) ---
export class IfStatementNode extends StatementNode {
    public readonly kind = 'IfStatement';
    constructor(
        public readonly keywordToken: Token,
        public readonly condition: ExpressionNode,
        public readonly thenBranch: BlockNode,
        public readonly elseBranch?: BlockNode
    ) {
        super(keywordToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitIfStatement(this); }
}

export class WhileStatementNode extends StatementNode {
    public readonly kind = 'WhileStatement';
    constructor(
        public readonly keywordToken: Token,
        public readonly condition: ExpressionNode,
        public readonly body: BlockNode
    ) {
        super(keywordToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitWhileStatement(this); }
}

export class ReturnStatementNode extends StatementNode {
    public readonly kind = 'ReturnStatement';
    constructor(
        public readonly keywordToken: Token,
        public readonly expression?: ExpressionNode
    ) {
        super(keywordToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitReturnStatement(this); }
}

export class AssignmentStatementNode extends StatementNode {
    public readonly kind = 'AssignmentStatement';
    constructor(
        public readonly target: IdentifierNode | ArrayAccessExpressionNode,
        public readonly operatorToken: Token,
        public readonly value: ExpressionNode,
    ) {
        super(target.startToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitAssignmentStatement(this); }
}

export class ExpressionStatementNode extends StatementNode {
    public readonly kind = 'ExpressionStatement';
    constructor(public readonly expression: CallExpressionNode) {
        super(expression.startToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitExpressionStatement(this); }
}

// --- Выражения (Expressions) ---
export class IdentifierNode extends ExpressionNode {
    public readonly kind = 'Identifier';
    public symbolEntry?: SymbolEntry;
    constructor(public readonly nameToken: Token) {
        super(nameToken);
    }
    get name(): string { return this.nameToken.value; }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitIdentifier(this); }
}

export class NumberLiteralNode extends ExpressionNode {
    public readonly kind = 'NumberLiteral';
    public readonly value: number;
    constructor(public readonly literalToken: Token) {
        super(literalToken);
        this.value = parseFloat(literalToken.value);
        if (isNaN(this.value)) {
            // В реальном приложении лучше выбрасывать кастомную ошибку парсинга/лексинга
            console.error(`Invalid number literal: ${literalToken.value} at line ${literalToken.line}`);
            this.value = 0; // или NaN, чтобы ошибка всплыла позже
        }
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitNumberLiteral(this); }
}

export class StringLiteralNode extends ExpressionNode {
    public readonly kind = 'StringLiteral';
    public readonly value: string;
    constructor(public readonly literalToken: Token) {
        super(literalToken);
        this.value = literalToken.value.slice(1, -1)
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t'); // Добавим еще пару escape
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitStringLiteral(this); }
}

export class BooleanLiteralNode extends ExpressionNode {
    public readonly kind = 'BooleanLiteral';
    public readonly value: boolean;
    constructor(public readonly literalToken: Token) {
        super(literalToken);
        this.value = literalToken.value === 'true';
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitBooleanLiteral(this); }
}

export class ArrayLiteralNode extends ExpressionNode {
    public readonly kind = 'ArrayLiteral';
    constructor(
        public readonly lBracketToken: Token,
        public readonly elements: ExpressionNode[]
    ) {
        super(lBracketToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitArrayLiteral(this); }
}

export class BinaryExpressionNode extends ExpressionNode {
    public readonly kind = 'BinaryExpression';
    constructor(
        public readonly left: ExpressionNode,
        public readonly operatorToken: Token,
        public readonly right: ExpressionNode
    ) {
        super(left.startToken);
    }
    get operator(): string { return this.operatorToken.value; }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitBinaryExpression(this); }
}

export class UnaryExpressionNode extends ExpressionNode {
    public readonly kind = 'UnaryExpression';
    constructor(
        public readonly operatorToken: Token,
        public readonly operand: ExpressionNode
    ) {
        super(operatorToken);
    }
    get operator(): string { return this.operatorToken.value; }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult {
        if (visitor.visitUnaryExpression) {
            return visitor.visitUnaryExpression(this);
        }
        throw new Error("Visitor does not support UnaryExpressionNode");
    }
}

export class CallExpressionNode extends ExpressionNode {
    public readonly kind = 'CallExpression';
    constructor(
        public readonly callee: IdentifierNode,
        public readonly lParenToken: Token,
        public readonly argumentsList: ExpressionNode[]
    ) {
        super(callee.startToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitCallExpression(this); }
}

export class ArrayAccessExpressionNode extends ExpressionNode {
    public readonly kind = 'ArrayAccessExpression';
    constructor(
        public readonly arrayExpr: ExpressionNode,
        public readonly lBracketToken: Token,
        public readonly indexExpr: ExpressionNode
    ) {
        super(arrayExpr.startToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitArrayAccessExpression(this); }
}

export class GroupedExpressionNode extends ExpressionNode {
    public readonly kind = 'GroupedExpression';
    constructor(
        public readonly lParenToken: Token,
        public readonly expression: ExpressionNode
    ) {
        super(lParenToken);
    }
    accept<TResult>(visitor: AstVisitor<TResult>): TResult { return visitor.visitGroupedExpression(this); }
}

export type SemanticValue = Token | AstNode | AstNode[] | ParameterDeclarationNode[] | ExpressionNode[] | null;