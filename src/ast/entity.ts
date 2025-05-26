import {ASTVisitor} from '@src/ast/visitor'; // Убедитесь, что путь правильный

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
    constructor(public statements: ASTNode[]) { // Может быть пустым для правила <Block> -> { }
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitBlock(this);
    }
}

class Identifier extends ASTNode { // Identifier должен быть определен до его использования
    constructor(public name: string) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitIdentifier(this);
    }
}

class VarDecl extends ASTNode {
    constructor(
        public name: Identifier,       // Имя переменной теперь Identifier узел
        public type: ASTNode,          // Тип теперь ASTNode (например, Literal или другой узел типа)
        public initializer?: ASTNode
    ) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitVarDecl(this);
    }
}

class ConstDecl extends ASTNode {
    constructor(
        public name: Identifier,       // Имя константы теперь Identifier узел
        public type: ASTNode,          // Тип теперь ASTNode
        public value: ASTNode
    ) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitConstDecl(this);
    }
}

// --- Новые и обновленные узлы для функций ---

// ParamNode теперь наследуется от ASTNode
class ParamNode extends ASTNode {
    constructor(
        public name: Identifier, // Имя параметра как Identifier узел
        public type: ASTNode     // Тип параметра как ASTNode
    ) {
        super();
    }

    accept(visitor: ASTVisitor) {
        // Предполагаем, что в ASTVisitor будет метод visitParamNode
        return visitor.visitParamNode(this);
    }
}

class ParamList extends ASTNode {
    constructor(public params: ParamNode[]) { // Массив узлов ParamNode
        super();
    }

    accept(visitor: ASTVisitor) {
        // Предполагаем, что в ASTVisitor будет метод visitParamList
        return visitor.visitParamList(this);
    }
}

class FuncDecl extends ASTNode {
    constructor(
        public name: Identifier,       // Имя функции как Identifier узел
        public params: ParamList,      // Список параметров как узел ParamList
        public returnType: ASTNode,    // Тип возвращаемого значения как ASTNode
        public body: Block             // Тело функции
    ) {
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitFuncDecl(this);
    }
}

// --- Остальные существующие узлы (без изменений в структуре, если они не использовали имя/тип как строку) ---

class AssignExpr extends ASTNode {
    // Если name в AssignExpr должен быть Identifier узлом, а не строкой:
    constructor(public target: Identifier, public value: ASTNode) { // Изменено name на target: Identifier
        super();
    }

    accept(visitor: ASTVisitor) {
        return visitor.visitAssignExpr(this); // Возможно, visitAssign переименуется в visitAssignExpr
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
    // Если callee должен быть Identifier узлом (для возможности разрешения имен и т.д.):
    constructor(public callee: Identifier, public args: ASTNode[]) { // Изменено callee: string на callee: Identifier
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

// Класс Param удален, так как его заменил ParamNode
// Если он все еще где-то нужен как простой объект, его можно оставить,
// но для AST используется ParamNode.

export {
    ASTNode,
    Program,
    Block,
    Identifier, // Экспортируем Identifier
    VarDecl,
    ConstDecl,
    ParamNode,  // Экспортируем ParamNode
    ParamList,  // Экспортируем ParamList
    FuncDecl,
    AssignExpr,
    BinaryExpr,
    UnaryExpr,
    CallExpr,
    Literal,
    IfStmt,
    WhileStmt,
    ForStmt,
    // Param, // Удаляем из экспорта, если не используется независимо
};

// Не забудьте обновить интерфейс ASTVisitor, добавив:
// visitIdentifier(node: Identifier): any;
// visitParamNode(node: ParamNode): any;
// visitParamList(node: ParamList): any;
// И, возможно, переименовать visitAssign в visitAssignExpr, если вы изменили AssignExpr.