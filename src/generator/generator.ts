import {
    ASTNode,
    Program,
    VarDecl,
    FuncDecl,
    Block,
    IfStmt,
    WhileStmt,
    ReturnStmt,
    AssignExpr,
    BinaryExpr,
    UnaryExpr,
    CallExpr,
    Literal,
    Identifier,
    ArrayLiteral,
    ArrayAccess
} from '../ast/entity';

export class CodeGenerator {
    public generate(ast: Program): string {
        return this.visit(ast) as string;
    }

    private visit(node: ASTNode): string | null {
        switch (node.constructor) {
            case Program: return this.visitProgram(node as Program);
            case VarDecl: return this.visitVarDecl(node as VarDecl);
            case AssignExpr: return this.visitAssignExpr(node as AssignExpr);
            case FuncDecl: return this.visitFuncDecl(node as FuncDecl);
            case Block: return this.visitBlock(node as Block);
            case ReturnStmt: return this.visitReturnStmt(node as ReturnStmt);
            case IfStmt: return this.visitIfStmt(node as IfStmt);
            case WhileStmt: return this.visitWhileStmt(node as WhileStmt);
            case CallExpr: return this.visitCallExpr(node as CallExpr);
            case BinaryExpr: return this.visitBinaryExpr(node as BinaryExpr);
            case UnaryExpr: return this.visitUnaryExpr(node as UnaryExpr);
            case Identifier: return this.visitIdentifier(node as Identifier);
            case Literal: return this.visitLiteral(node as Literal);
            case ArrayLiteral: return this.visitArrayLiteral(node as ArrayLiteral);
            case ArrayAccess: return this.visitArrayAccess(node as ArrayAccess);
            default:
                throw new Error(`Unknown AST node type: ${node.constructor.name}`);
        }
    }

    private visitProgram(node: Program): string {
        return node.statements.map(stmt => this.visit(stmt)).join(';\n');
    }

    private visitBlock(node: Block): string {
        return `{\n${node.statements.map(stmt => this.visit(stmt)).join(';\n')}\n}`;
    }

    private visitVarDecl(node: VarDecl): string {
        let jsCode = `let ${node.name}`;
        if (node.initializer) {
            jsCode += ` = ${this.visit(node.initializer)}`;
        }
        return jsCode;
    }

    private visitFuncDecl(node: FuncDecl): string {
        const params = node.params.map(p => p.name).join(', ');
        const body = this.visit(node.body);
        return `function ${node.name}(${params}) ${body}`;
    }

    private visitAssignExpr(node: AssignExpr): string {
        const target = this.visit(node.target);
        const value = this.visit(node.value);
        return `${target} = ${value}`;
    }

    private visitReturnStmt(node: ReturnStmt): string {
        return `return ${this.visit(node.value)}`;
    }

    private visitIfStmt(node: IfStmt): string {
        const condition = this.visit(node.condition);
        const thenBranch = this.visit(node.thenBranch);
        let jsCode = `if (${condition}) ${thenBranch}`;
        if (node.elseBranch) {
            const elseBranch = this.visit(node.elseBranch);
            jsCode += ` else ${elseBranch}`;
        }
        return jsCode;
    }

    private visitWhileStmt(node: WhileStmt): string {
        const condition = this.visit(node.condition);
        const body = this.visit(node.body);
        return `while (${condition}) ${body}`;
    }

    private visitBinaryExpr(node: BinaryExpr): string {
        const left = this.visit(node.left);
        const right = this.visit(node.right);
        return `${left} ${node.operator} ${right}`;
    }

    private visitUnaryExpr(node: UnaryExpr): string {
        const operand = this.visit(node.operand);
        return `${node.operator}${operand}`;
    }

    private visitCallExpr(node: CallExpr): string {
        const args = node.args.map(arg => this.visit(arg)).join(', ');
        return `${node.callee}(${args})`;
    }

    private visitIdentifier(node: Identifier): string {
        return node.name;
    }

    private visitLiteral(node: Literal): string {
        if (typeof node.value === 'string') {
            return `"${node.value}"`;
        }
        return String(node.value);
    }

    private visitArrayLiteral(node: ArrayLiteral): string {
        const elements = node.elements.map(el => this.visit(el)).join(', ');
        return `[${elements}]`;
    }

    private visitArrayAccess(node: ArrayAccess): string {
        const array = this.visit(node.array);
        const index = this.visit(node.index);
        return `${array}[${index}]`;
    }
} 