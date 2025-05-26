import {
    AssignExpr,
    BinaryExpr,
    Block, CallExpr,
    ConstDecl,
    ForStmt,
    FuncDecl, Identifier,
    IfStmt, Literal, ParamList, ParamNode,
    Program, UnaryExpr,
    VarDecl,
    WhileStmt,
} from '@src/ast/entity'

// Посетитель (visitor) для генерации кода или выполнения
type ASTVisitor = {
    visitProgram(node: Program): any;
    visitVarDecl(node: VarDecl): any;
    visitConstDecl(node: ConstDecl): any;
    visitFuncDecl(node: FuncDecl): any;
    visitBlock(node: Block): any;
    visitIfStmt(node: IfStmt): any;
    visitWhileStmt(node: WhileStmt): any;
    visitForStmt(node: ForStmt): any;
    visitAssign(node: AssignExpr): any;
    visitBinaryExpr(node: BinaryExpr): any;
    visitUnaryExpr(node: UnaryExpr): any;
    visitLiteral(node: Literal): any;
    visitIdentifier(node: Identifier): any;
    visitCallExpr(node: CallExpr): any;
    visitAssignExpr(param: AssignExpr): any
    visitParamList(param: ParamList): any
    visitParamNode(param: ParamNode): any
}

export {
    ASTVisitor,
}