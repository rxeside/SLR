import {
    ASTNode, AssignExpr, BinaryExpr, Block, CallExpr, FuncDecl, Identifier,
    IfStmt, Literal, Param, Program, ReturnStmt, VarDecl, WhileStmt
} from "../ast/entity";

interface FunctionContext {
    name: string;
    argc: number;
    locals: number;
    constants: any[];
    code: string[];
    // We will need a way to track local variables vs globals. For now, this is a placeholder.
    // A more advanced implementation would have a proper symbol table per function.
    local_vars: Map<string, number>; 
}

export class PvmCodeGenerator {
    private functions: FunctionContext[] = [];
    private currentFunction: FunctionContext | null = null;
    
    // A global map for function declarations
    private functionDeclarations: Map<string, FuncDecl> = new Map();

    private get currentConstants() {
        if (!this.currentFunction) throw new Error("No current function");
        return this.currentFunction.constants;
    }

    private get currentCode() {
        if (!this.currentFunction) throw new Error("No current function");
        return this.currentFunction.code;
    }

    generate(ast: Program): string {
        this.visit(ast);
        return this.functions.map(func => this.serializeFunction(func)).join('\n\n');
    }

    private visit(node: ASTNode): void {
        if (node instanceof Program) this.visitProgram(node);
        else if (node instanceof VarDecl) this.visitVarDecl(node);
        else if (node instanceof FuncDecl) this.visitFuncDecl(node);
        else if (node instanceof CallExpr) this.visitCallExpr(node);
        else if (node instanceof Literal) this.visitLiteral(node);
        else if (node instanceof Identifier) this.visitIdentifier(node);
        else if (node instanceof BinaryExpr) this.visitBinaryExpr(node);
        else if (node instanceof AssignExpr) this.visitAssignExpr(node);
        else if (node instanceof IfStmt) this.visitIfStmt(node);
        else if (node instanceof WhileStmt) this.visitWhileStmt(node);
        else if (node instanceof Block) this.visitBlock(node);
        else if (node instanceof ReturnStmt) this.visitReturnStmt(node);
        else if (node instanceof Param) { /* Handled in visitFuncDecl */ }
        else {
            console.error(`Unknown AST node type: ${node.constructor.name}`);
        }
    }

    private visitProgram(program: Program): void {
        // First pass: collect all function declarations
        for (const stmt of program.statements) {
            if (stmt instanceof FuncDecl) {
                this.functionDeclarations.set(stmt.name, stmt);
            }
        }
        
        // Second pass: compile functions
        for (const stmt of program.statements) {
            if (stmt instanceof FuncDecl) {
                this.visit(stmt);
            }
        }

        // Third pass: compile the main entry point
        this.startFunction("__EntryPoint__", 0);
        for (const stmt of program.statements) {
            // When we see a function declaration in the main scope,
            // we just need to create a global variable for it.
            // The actual function code has already been generated.
            if (stmt instanceof FuncDecl) {
                const nameIndex = this.addConstant(stmt.name);
                this.emitInstruction('def_global', nameIndex);
            } else {
                this.handleStatement(stmt);
            }
        }
        this.emitInstruction('return');
        this.endFunction();
    }

    private handleStatement(stmt: ASTNode) {
        this.visit(stmt);
        // If the statement was a call expression, its result is unused and must be popped.
        if (stmt instanceof CallExpr) {
            this.emitInstruction('pop');
        }
    }

    private startFunction(name: string, argc: number, localsCount: number = 0): void {
        const func: FunctionContext = {
            name,
            argc,
            locals: localsCount,
            constants: [],
            code: [],
            local_vars: new Map()
        };
        this.currentFunction = func;
        this.functions.push(func);
    }

    private endFunction(): void {
        // Ensure every function ends with a return, even if implicit.
        const lastInstruction = this.currentCode[this.currentCode.length - 1];
        if (!lastInstruction || !lastInstruction.startsWith('return')) {
            this.emitInstruction('return');
        }
        this.currentFunction = null;
    }

    private emitInstruction(opcode: string, ...args: (string | number)[]): void {
        if (!this.currentFunction) throw new Error("No current function context");
        // The address is not part of the instruction string itself in the final output.
        // The VM calculates it. We use the length of the code array as the "current address".
        const instruction = [opcode, ...args].join(' ');
        this.currentCode.push(instruction);
    }

    private addConstant(value: any): number {
        // Constants are per-function
        const index = this.currentConstants.findIndex(c => c === value);
        if (index !== -1) {
            return index;
        }
        this.currentConstants.push(value);
        return this.currentConstants.length - 1;
    }

    private backpatch(patchAddr: number, targetAddr: number) {
        const instructionLine = this.currentCode[patchAddr];
        if (!instructionLine) {
            throw new Error(`Backpatch error: No instruction at address ${patchAddr}`);
        }
        const parts = instructionLine.split(' ');
        // The jump offset is relative to the instruction's own address.
        // In our simple model, the instruction is at `patchAddr`. The target is `targetAddr`.
        const jumpOffset = targetAddr - patchAddr;
        parts[1] = jumpOffset.toString();
        this.currentCode[patchAddr] = parts.join(' ');
    }

    private serializeFunction(func: FunctionContext): string {
        const constantsSection = func.constants.length > 0
            ? '.constants\n' + func.constants.map(c => {
                if (typeof c === 'string') return `string "${c}"`; // PVM strings are quoted
                if (typeof c === 'number') return `number ${c}`;
                return '';
            }).join('\n')
            : '.constants';

        // Add addresses to code lines
        const codeWithAddresses = func.code.map((line, index) => `${index} ${line}`);
        
        const codeSection = codeWithAddresses.length > 0
            ? '.code\n' + codeWithAddresses.join('\n')
            : '.code';

        return `
.def
.argc ${func.argc}
.locals ${func.locals}
.name ${func.name}
${constantsSection}
${codeSection}
.end_def
`.trim();
    }

    private visitIfStmt(stmt: IfStmt): void {
        this.visit(stmt.condition);
        const thenJumpAddr = this.currentCode.length;
        this.emitInstruction('jmp_if_false', 0); // Placeholder

        this.visit(stmt.thenBranch);

        if (stmt.elseBranch) {
            const elseJumpAddr = this.currentCode.length;
            this.emitInstruction('jmp', 0); // Placeholder
            this.backpatch(thenJumpAddr, this.currentCode.length);
            this.visit(stmt.elseBranch);
            this.backpatch(elseJumpAddr, this.currentCode.length);
        } else {
            this.backpatch(thenJumpAddr, this.currentCode.length);
        }
    }
    
    private visitWhileStmt(stmt: WhileStmt): void {
        const loopStartAddr = this.currentCode.length;
        this.visit(stmt.condition);

        const exitJumpAddr = this.currentCode.length;
        this.emitInstruction('jmp_if_false', 0); // Placeholder for jump to end of loop

        this.visit(stmt.body);

        const loopBackJumpAddr = this.currentCode.length;
        const offset = loopStartAddr - loopBackJumpAddr;
        this.emitInstruction('jmp', offset);

        // Now we know where the loop ends
        this.backpatch(exitJumpAddr, this.currentCode.length);
    }

    private visitReturnStmt(node: ReturnStmt): void {
        this.visit(node.value);
        this.emitInstruction('return');
    }
    
    private visitFuncDecl(node: FuncDecl): void {
        this.startFunction(node.name, node.params.length);
        
        // Register params as local variables
        node.params.forEach((param, index) => {
            this.currentFunction!.local_vars.set(param.name, index);
        });

        this.visit(node.body);
        this.endFunction();
    }

    private visitBlock(block: Block): void {
        block.statements.forEach(stmt => this.handleStatement(stmt));
    }

    private visitVarDecl(node: VarDecl): void {
        if (node.initializer) {
            this.visit(node.initializer);
        } else {
             this.visit(new Literal(0));
        }
        const nameIndex = this.addConstant(node.name);
        this.emitInstruction('def_global', nameIndex);
    }

    private visitIdentifier(node: Identifier): void {
        // Check if it's a local variable first
        if (this.currentFunction && this.currentFunction.local_vars.has(node.name)) {
            const localIndex = this.currentFunction.local_vars.get(node.name)!;
            this.emitInstruction('get_local', localIndex);
            return;
        }

        // Otherwise, assume it's a global
        const nameIndex = this.addConstant(node.name);
        this.emitInstruction('get_global', nameIndex);
    }
    
    private visitAssignExpr(node: AssignExpr): void {
        this.visit(node.value);
        if (node.target instanceof Identifier) {
            // Check if it's a local variable first
            if (this.currentFunction && this.currentFunction.local_vars.has(node.target.name)) {
                const localIndex = this.currentFunction.local_vars.get(node.target.name)!;
                this.emitInstruction('set_local', localIndex);
                return;
            }

            const nameIndex = this.addConstant(node.target.name);
            this.emitInstruction('set_global', nameIndex);
        } else {
            throw new Error('Assignment to non-identifier targets is not yet supported.');
        }
    }

    private visitBinaryExpr(node: BinaryExpr): void {
        this.visit(node.left);
        this.visit(node.right);

        const opMap: { [key: string]: string } = {
            '+': 'add', '-': 'sub', '*': 'mul', '/': 'div',
            '>': 'cgt', '<': 'clt', '==': 'ceq'
        };

        const opcode = opMap[node.operator];
        if (opcode) {
            this.emitInstruction(opcode);
        } else {
            throw new Error(`Unsupported binary operator: ${node.operator}`);
        }
    }
    
    private visitLiteral(node: Literal): void {
        const constIndex = this.addConstant(node.value);
        this.emitInstruction('const', constIndex);
    }
    
    private visitCallExpr(node: CallExpr): void {
        for (const arg of node.args) {
            this.visit(arg);
        }
        const funcNameIndex = this.addConstant(node.callee);
        this.emitInstruction('get_global', funcNameIndex);
        this.emitInstruction('call', node.args.length);
        // DO NOT pop the result. The caller should do it if the result is unused.
    }
} 