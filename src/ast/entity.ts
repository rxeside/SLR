import {ASTVisitor} from '@src/ast/visitor'

// Базовый узел AST
abstract class ASTNode {
    abstract accept(visitor: ASTVisitor): any;
}

class Program extends ASTNode {
    constructor(public statements: ASTNode[]) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitProgram(this);
    }
}

class Block extends ASTNode {
    constructor(public statements: ASTNode[]) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitBlock(this);
    }
}

class VarDecl extends ASTNode {
    constructor(public name: string, public type: string, public initializer?: ASTNode) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitVarDecl(this);
    }
}

class ConstDecl extends ASTNode {
    constructor(public name: string, public type: string, public value: ASTNode) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitConstDecl(this);
    }
}

class FuncDecl extends ASTNode {
    constructor(
        public name: string,
        public params: Param[],
        public returnType: string,
        public body: Block
    ) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitFuncDecl(this);
    }
}

class Param {
    constructor(public name: string, public type: string) {}
}

class AssignExpr extends ASTNode {
    constructor(public name: string, public value: ASTNode) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitAssign(this);
    }
}

class BinaryExpr extends ASTNode {
    constructor(public left: ASTNode, public operator: string, public right: ASTNode) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitBinaryExpr(this);
    }
}

class UnaryExpr extends ASTNode {
    constructor(public operator: string, public operand: ASTNode) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitUnaryExpr(this);
    }
}

class CallExpr extends ASTNode {
    constructor(public callee: string, public args: ASTNode[]) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitCallExpr(this);
    }
}

class Literal extends ASTNode {
    constructor(public value: string | number | boolean | null) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitLiteral(this);
    }
}

class Identifier extends ASTNode {
    constructor(public name: string) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitIdentifier(this);
    }
}

class IfStmt extends ASTNode {
    constructor(
        public condition: ASTNode,
        public thenBranch: Block,
        public elifBranches: { condition: ASTNode, block: Block }[] = [],
        public elseBranch?: Block
    ) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitIfStmt(this);
    }
}

class WhileStmt extends ASTNode {
    constructor(public condition: ASTNode, public body: Block) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitWhileStmt(this);
    }
}

class ForStmt extends ASTNode {
    constructor(
        public init: ASTNode | null,
        public condition: ASTNode | null,
        public update: ASTNode | null,
        public body: Block
    ) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitForStmt(this);
    }
}

export {
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
}