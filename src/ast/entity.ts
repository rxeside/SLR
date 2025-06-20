import {ASTVisitor} from '@src/ast/visitor'

// Базовый узел AST
abstract class ASTNode {
    public type: string;
    public line: number;
    public column: number;

    constructor(line: number = 0, column: number = 0) {
        this.type = this.constructor.name;
        this.line = line;
        this.column = column;
    }

    abstract accept(visitor: ASTVisitor): any;
}

class Program extends ASTNode {
    constructor(public statements: ASTNode[], line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitProgram(this);
    }
}

class Block extends ASTNode {
    constructor(public statements: ASTNode[], line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitBlock(this);
    }
}

class VarDecl extends ASTNode {
    constructor(public name: string, public type: string, public initializer?: ASTNode, line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitVarDecl(this);
    }
}

class ConstDecl extends ASTNode {
    constructor(public name: string, public type: string, public value: ASTNode, line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitConstDecl(this);
    }
}

class FuncDecl extends ASTNode {
    constructor(
        public name: string,
        public params: Param[] = [],
        public returnType: string,
        public body: Block,
        line?: number, column?: number
    ) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitFuncDecl(this);
    }
}

class Param {
    constructor(public name: string, public type: string) {}
}

class AssignExpr extends ASTNode {
    constructor(public target: Identifier | ArrayAccess, public value: ASTNode, line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitAssign(this);
    }
}

class BinaryExpr extends ASTNode {
    constructor(public left: ASTNode, public operator: string, public right: ASTNode, line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitBinaryExpr(this);
    }
}

class UnaryExpr extends ASTNode {
    constructor(public operator: string, public operand: ASTNode, line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitUnaryExpr(this);
    }
}

class CallExpr extends ASTNode {
    constructor(public callee: string, public args: ASTNode[], line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitCallExpr(this);
    }
}

class Literal extends ASTNode {
    constructor(public value: string | number | boolean | null, line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitLiteral(this);
    }
}

class Identifier extends ASTNode {
    constructor(public name: string, line?: number, column?: number) {
        super(line, column);
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
        public elseBranch?: Block,
        line?: number, column?: number
    ) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitIfStmt(this);
    }
}

class WhileStmt extends ASTNode {
    constructor(public condition: ASTNode, public body: Block, line?: number, column?: number) {
        super(line, column);
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
        public body: Block,
        line?: number, column?: number
    ) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitForStmt(this);
    }
}

class ReturnStmt extends ASTNode {
    constructor(public value: ASTNode, line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitReturnStmt(this);
    }
}

class ArrayLiteral extends ASTNode {
    constructor(public elements: ASTNode[], line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitArrayLiteral(this);
    }
}

class ArrayAccess extends ASTNode {
    constructor(public array: ASTNode, public index: ASTNode, line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitArrayAccess(this);
    }
}

class ParamList extends ASTNode {
    constructor(public params: Param[], line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor) {
        throw new Error("Method not implemented.");
    }
}

class ArgList extends ASTNode {
    constructor(public args: ASTNode[], line?: number, column?: number) {
        super(line, column);
    }

    accept(visitor: ASTVisitor): any {
        throw new Error("Method not implemented.");
    }
}

export {
    ASTNode,
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
    ReturnStmt,
    ArrayLiteral,
    ArrayAccess,
    ParamList,
    ArgList,
}