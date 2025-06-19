import {
    ASTNode,
    Program,
    VarDecl,
    FuncDecl,
    Block,
    IfStmt,
    WhileStmt,
    ForStmt,
    ReturnStmt,
    AssignExpr,
    BinaryExpr,
    CallExpr,
    Literal,
    Identifier,
    Upvalue,
    ArrayLiteral,
    ArrayAccess
} from '../ast/entity';
import { SymbolTable, SymbolEntry } from '../symbolTable/symbolTable';

class FunctionBytecode {
    public instructions: { line: number, text: string }[] = [];
    public constants: any[] = [];
    
    constructor(
        public name: string,
        public arity: number,
        public localsCount: number,
        public upvalues: Upvalue[] = []
    ) {}

    emit(instruction: string, line: number = 1) {
        // Don't emit line number for labels
        if (instruction.endsWith(':')) {
             this.instructions.push({ line: 0, text: instruction });
        } else {
             this.instructions.push({ line, text: instruction });
        }
    }

    addConstant(value: any): number {
        const index = this.constants.findIndex(c => c === value);
        if (index > -1) return index;
        this.constants.push(value);
        return this.constants.length - 1;
    }
}

export class CodeGenerator {
    private symbolTable: SymbolTable;
    private functions: FunctionBytecode[] = [];
    private main!: FunctionBytecode;
    private currentFunction!: FunctionBytecode;
    private functionStack: FunctionBytecode[] = [];
    private functionMap: Map<string, number> = new Map();
    private _programNode!: Program;
    private loopCounter = 0;

    constructor(symbolTable: SymbolTable) {
        this.symbolTable = symbolTable;
    }

    public generate(programNode: Program): string {
        this._programNode = programNode;
        const functionDeclarations = programNode.statements.filter(s => s instanceof FuncDecl) as FuncDecl[];
        const mainStatements = programNode.statements.filter(s => !(s instanceof FuncDecl));

        // 0. Initialize main function container so it's available for context.
        const mainLocalsCount = this.countLocals(programNode, true);
        this.main = new FunctionBytecode('__EntryPoint__', 0, mainLocalsCount);
        this.currentFunction = this.main;

        // Pre-populate main's constants with global built-in functions
        this.symbolTable.getGlobalScope().symbols.forEach((symbol) => {
            if (symbol.isFunction) {
                this.main.addConstant(symbol.name);
            }
        });

        // 1. Register all function names so `load_fn` knows about them ahead of time.
        functionDeclarations.forEach((node, i) => {
            this.functionMap.set(node.name, i + 1); // PVM is 1-indexed for functions
        });
        
        // 2. Compile each function's body. This will populate the `this.functions` array.
        // This is done before compiling main so that upvalue analysis is correct.
        functionDeclarations.forEach(node => this.compileFunction(node));
        
        // 3. Now compile the main entry point.
        this.currentFunction = this.main; // Switch context back to main
        
        this.symbolTable.enterScope('__EntryPoint__');
        
        // Add top-level declarations to the main symbol table scope
        programNode.statements.forEach(stmt => {
            if (stmt instanceof VarDecl) {
                this.symbolTable.add(stmt.name, stmt.type);
            } else if (stmt instanceof FuncDecl) {
                // Functions are already compiled, but we need their symbol in the main scope
                // to be able to call them.
                this.symbolTable.add(stmt.name, 'function', undefined, true, [], stmt.returnType);
            }
        });
        
        // Process variable initializers in main
        mainStatements.forEach(stmt => {
            if (stmt instanceof VarDecl) {
                this.visit(stmt);
            }
        });

        // Hoist functions: create closures and store them in local variables.
        functionDeclarations.forEach(node => {
            this.hoistFunction(node);
        });

        // Visit the rest of the main statements (e.g., calls)
        mainStatements.forEach(stmt => {
            if (!(stmt instanceof VarDecl)) {
                this.visit(stmt);
                if (stmt instanceof CallExpr) {
                    this.currentFunction.emit('pop');
                }
            }
        });

        this.emitReturnIfNeeded(this.main);
        
        this.symbolTable.exitScope();
        return this.serialize();
    }

    private hoistFunction(node: FuncDecl) {
        const funcIndex = this.functionMap.get(node.name)!;
        this.currentFunction.emit(`load_fn ${funcIndex}`);
        if (node.upvalues.length > 0) {
            this.currentFunction.emit('closure');
        }
        const symbol = this.symbolTable.lookupCurrentScope(node.name);
        if (symbol) {
            this.currentFunction.emit(`set_local ${symbol.localIndex}`);
        }
    }

    private compileFunction(node: FuncDecl) {
        // Create the bytecode container BEFORE visiting, so `currentFunction` is correct.
        const localsCount = this.countLocals(node.body);
        const func = new FunctionBytecode(node.name, node.params.length, localsCount, node.upvalues);
        this.functions.push(func);

        this.functionStack.push(this.currentFunction); // Save current context
        this.currentFunction = func;
        
        this.symbolTable.enterScope(node.name);
        
        node.params.forEach(p => this.symbolTable.add(p.name, p.type));
        node.body.statements.forEach(s => {
            if (s instanceof VarDecl) this.symbolTable.add(s.name, s.type);
        })

        this.visit(node.body);
        this.emitReturnIfNeeded(func);
        this.symbolTable.exitScope();

        this.currentFunction = this.functionStack.pop()!; // Restore previous context
    }

    private emitReturnIfNeeded(func: FunctionBytecode) {
        if (!func) return; // Guard against main not being initialized
        const lastInstruction = func.instructions[func.instructions.length - 1];
        if (!lastInstruction || !lastInstruction.text.includes('return')) {
            this.currentFunction.emit('return');
        }
    }

    private countLocals(node: Program | Block, countFunctionsAsLocals = false): number {
        let count = 0;
        for (const stmt of node.statements) {
            if (stmt instanceof VarDecl) {
                count++;
            } else if (countFunctionsAsLocals && stmt instanceof FuncDecl) {
                count++;
            }
        }
        return count;
    }
    
    private visit(node: ASTNode): void {
        const visitorName = `visit${node.constructor.name}`;
        const visitor = (this as any)[visitorName];
        if (visitor) {
            visitor.call(this, node);
        } else {
            throw new Error(`CodeGenerator: No visitor for ${node.constructor.name}`);
        }
    }
    
    private visitProgram(node: Program) {
        node.statements.forEach(stmt => this.visit(stmt));
    }

    private visitBlock(node: Block) {
        node.statements.forEach(s => {
            this.visit(s);
            if (s instanceof CallExpr) {
                this.currentFunction.emit('pop');
            }
        });
    }

    private visitVarDecl(node: VarDecl) {
        if (node.initializer) {
            this.visit(node.initializer);
            const symbol = this.symbolTable.lookupCurrentScope(node.name);
            if (symbol) {
                this.currentFunction.emit(`set_local ${symbol.localIndex}`);
            }
        }
    }

    private visitReturnStmt(node: ReturnStmt) {
        if (node.value) {
            this.visit(node.value);
        } else {
            this.currentFunction.emit('const_null');
        }
        this.currentFunction.emit('return');
    }

    private visitAssignExpr(node: AssignExpr) {
        this.visit(node.value);

        if (node.target instanceof Identifier) {
            const res = node.target.resolution;
            if (!res) throw new Error(`unresolved assignment target ${node.target.name}`);
            
            if (res.type === 'local') this.currentFunction.emit(`set_local ${res.index}`);
            else if (res.type === 'global') this.currentFunction.emit(`set_global ${this.currentFunction.addConstant(node.target.name)}`);
            else if (res.type === 'upvalue') this.currentFunction.emit(`set_upvalue ${res.index}`);
        } else if (node.target instanceof ArrayAccess) {
            this.visitArrayAccess(node.target, true); // Pass true for isLhs
            this.currentFunction.emit('set_property');
            this.currentFunction.emit('pop'); // set_property might leave a value
        }
    }

    private visitArrayLiteral(node: ArrayLiteral) {
        node.elements.forEach(element => this.visit(element));
        this.currentFunction.emit(`create_arr ${node.elements.length}`);
    }

    private visitArrayAccess(node: ArrayAccess, isLhs: boolean = false) {
        this.visit(node.array);
        this.visit(node.index);
        if (!isLhs) {
            this.currentFunction.emit('get_property');
        }
    }

    private visitCallExpr(node: CallExpr) {
        // Push arguments ONTO the stack FIRST
        if (node.args) {
            node.args.forEach(arg => this.visit(arg));
        }

        // Then, push the function/closure to be called by visiting its identifier
        this.visit(node.callee);

        // Finally, emit the call instruction
        const argCount = node.args ? node.args.length : 0;
        this.currentFunction.emit(`call ${argCount}`);
    }

    private visitIdentifier(node: Identifier) {
        const res = node.resolution;
        if (!res) {
            // Probably a built-in function like 'print'
            const global = this.symbolTable.lookupGlobal(node.name);
            if (global?.isFunction) {
                const constIndex = this.currentFunction.addConstant(node.name);
                this.currentFunction.emit(`get_global ${constIndex}`);
                return;
            }
            throw new Error(`unresolved identifier ${node.name}`);
        }
        
        if (res.type === 'local') this.currentFunction.emit(`get_local ${res.index}`);
        else if (res.type === 'global') this.currentFunction.emit(`get_global ${this.currentFunction.addConstant(node.name)}`);
        else if (res.type === 'upvalue') this.currentFunction.emit(`get_upvalue ${res.index}`);
    }

    private visitLiteral(node: Literal) {
        const constIndex = this.currentFunction.addConstant(node.value);
        this.currentFunction.emit(`const ${constIndex}`);
    }

    private visitBinaryExpr(node: BinaryExpr) {
        this.visit(node.left);
        this.visit(node.right);

        const opMap: { [key: string]: string } = {
            '+': 'add',
            '-': 'sub',
            '*': 'mul',
            '/': 'div',
            '%': 'mod',
            '<': 'clt',
            '>': 'cgt',
            '<=': 'clte',
            '>=': 'cgte',
            '==': 'ceq',
            '!=': 'cneq',
            '&&': 'and',
            '||': 'or',
        };

        if (opMap[node.operator]) {
            this.currentFunction.emit(opMap[node.operator]);
        }
    }

    private visitIfStmt(node: IfStmt): void {
        const ifId = this.loopCounter++;
        const endIfLabel = `endif${ifId}`;
        const elseLabel = `else_${this.functions.length}_${this.currentFunction.instructions.length}`;
        const endLabel = `endif_${this.functions.length}_${this.currentFunction.instructions.length}`;

        this.visit(node.condition);
        this.currentFunction.emit(`jmp_false ${elseLabel}`);
        
        this.visit(node.thenBranch);
        this.currentFunction.emit(`jmp ${endLabel}`);
        
        this.currentFunction.emit(elseLabel + ':');
        if (node.elseBranch) {
            this.visit(node.elseBranch);
        }
        
        this.currentFunction.emit(endLabel + ':');
    }

    private visitWhileStmt(node: WhileStmt): void {
        const loopId = this.loopCounter++;
        const startLabel = `while_start_${loopId}`;
        const endLabel = `while_end_${loopId}`;
    
        this.currentFunction.emit(`${startLabel}:`);
        this.visit(node.condition);
        this.currentFunction.emit(`jmp_false ${endLabel}`);
    
        this.visit(node.body);
        this.currentFunction.emit(`jmp ${startLabel}`); 
    
        this.currentFunction.emit(`${endLabel}:`);
    }

    private visitForStmt(node: ForStmt): void {
        const loopId = this.loopCounter++;
        const condLabel = `forcond${loopId}`;
        const actionLabel = `foraction${loopId}`;
        const endLabel = `forend${loopId}`;

        // 1. Initializer
        if (node.init) {
            this.visit(node.init);
            // Pop the result of the initializer expression (e.g. the assigned value)
            this.currentFunction.emit('pop');
        }

        this.currentFunction.emit(`${condLabel}:`);
        // 2. Condition
        if (node.condition) {
            this.visit(node.condition);
            this.currentFunction.emit(`jmp_false ${endLabel}`);
        }
        // If no condition, it's an infinite loop, so no jump.

        // 3. Body
        this.visit(node.body);

        // 4. Update
        this.currentFunction.emit(`${actionLabel}:`);
        if (node.update) {
            this.visit(node.update);
            // Pop the result of the update expression
            this.currentFunction.emit('pop');
        }

        // 5. Jump back to condition
        this.currentFunction.emit(`jmp ${condLabel}`);

        // 6. End label
        this.currentFunction.emit(`${endLabel}:`);
    }

    private serialize(): string {
        let output = this.serializeFunction(this.main);
        for (const func of this.functions) {
            output += '\n\n' + this.serializeFunction(func);
        }
        return output;
    }

    private serializeFunction(func: FunctionBytecode): string {
        let block = '.def\n';
        block += `.argc ${func.arity}\n`;
        block += `.locals ${func.localsCount}\n`;
        block += `.name ${func.name}\n`;

        const parentLocalUpvalues = func.upvalues.filter(uv => uv.isLocal).map(uv => uv.index);
        if (parentLocalUpvalues.length > 0) {
            block += `.parent_local ${parentLocalUpvalues.join(' ')}\n`;
        }

        if (func.constants.length > 0) {
        block += '.constants\n';
        func.constants.forEach(c => {
            if (typeof c === 'number') block += `number ${c}\n`;
                else if (typeof c === 'string') block += `string ${c}\n`;
        });
        }
        
        block += '.code\n';
        block += func.instructions.map(instr => {
            if (instr.line === 0) return instr.text; // Label
            return `${instr.line} ${instr.text}`;
        }).join('\n');
        block += '\n.end_def';
        return block;
    }
} 