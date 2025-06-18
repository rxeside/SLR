type Value = number | string | boolean | null;

// Представление скомпилированной инструкции
interface Instruction {
    line: number;
    text: string;
}

// Представление скомпилированной функции
interface CompiledFunction {
    name: string;
    arity: number;
    instructions: Instruction[];
}

/**
 * Класс BytecodeWriter теперь сохраняет инструкции вместе с номерами строк.
 */
class BytecodeWriter {
    private instructions: Instruction[] = [];
    private constants: Value[] = [];

    /** Добавляет константу в таблицу, если её там ещё нет, и возвращает её индекс. */
    public addConstant(value: Value): number {
        const index = this.constants.indexOf(value);
        if (index !== -1) {
            return index;
        }
        this.constants.push(value);
        return this.constants.length - 1;
    }

    /** Сохраняет инструкцию вместе с номером строки. */
    public writeInstruction(text: string, line: number): void {
        this.instructions.push({ line, text });
    }

    public getInstructions() { return this.instructions; }
    public getConstants() { return this.constants; }
}

// Управляет процессом компиляции для одной "области": глобальной или функции
class Compiler {
    private locals: { name: string, depth: number }[] = [];
    public scopeDepth = 0;

    constructor(public functionName: string, private arity: number) {
        if (functionName !== 'global_scope') {
            // Резервируем место для параметров, они будут первыми локальными переменными
        }
    }

    public beginScope() { this.scopeDepth++; }
    public endScope() { this.scopeDepth--; }

    public addLocal(name: string): void {
        this.locals.push({ name, depth: this.scopeDepth });
    }

    public resolveVariable(name: string): { type: 'local' | 'global', index: number } {
        for (let i = this.locals.length - 1; i >= 0; i--) {
            if (this.locals[i].name === name) {
                return { type: 'local', index: i };
            }
        }
        return { type: 'global', index: -1 };
    }
}

class FunctionCompiler {
    public constants: Value[] = [];
    public instructions: Instruction[] = [];
    public locals: string[] = [];
    public labelCount = 0;

    constructor(public name: string, public arity: number) {}

    public addConstant(value: Value): number {
        const index = this.constants.indexOf(value);
        if (index !== -1) return index;
        this.constants.push(value);
        return this.constants.length - 1;
    }

    public addLocal(name: string): number {
        if (this.locals.includes(name)) return this.locals.indexOf(name);
        this.locals.push(name);
        return this.locals.length - 1;
    }

    public resolveVariable(name: string): { type: 'local' | 'global'; index: number } {
        const localIndex = this.locals.indexOf(name);
        if (localIndex > -1) {
            return { type: 'local', index: localIndex };
        }
        return { type: 'global', index: this.addConstant(name) };
    }

    public emit(text: string, line: number) {
        this.instructions.push({ line, text });
    }

    public createLabel(name: string): string {
        return `${name}${this.labelCount++}`;
    }
}

export class CodeGenerator {
    private functions: FunctionCompiler[] = [];
    private main: FunctionCompiler | null = null;
    private currentCompiler: FunctionCompiler | null = null;
    private userFunctionNames: string[] = [];

    public generate(programNode: any): string {
        const functionNodes = programNode.body.filter((n: any) => n.type === 'FunctionDeclaration');
        this.userFunctionNames = functionNodes.map(n => n.id.name);

        for (const funcNode of functionNodes) {
            this.functions.push(this.compileFunction(funcNode));
        }

        this.main = new FunctionCompiler('__EntryPoint__', 0);
        this.currentCompiler = this.main;
        const mainStatements = programNode.body.filter((n: any) => n.type !== 'FunctionDeclaration');
        
        this.scanForLocals(mainStatements, this.main);

        for (const statement of mainStatements) {
            this.visit(statement);
        }
        
        const lastLine = mainStatements.length > 0 ? mainStatements[mainStatements.length - 1].line : 1;
        this.main!.emit(`return`, lastLine);

        return this.serialize();
    }

    private compileFunction(node: any): FunctionCompiler {
        const func = new FunctionCompiler(node.id.name, node.params.length);
        this.currentCompiler = func;
        node.params.forEach((p: any) => func.addLocal(p.name));
        this.scanForLocals(node.body.body, func);
        this.visit(node.body);
        return func;
    }

    private scanForLocals(statements: any[], compiler: FunctionCompiler) {
        for (const stmt of statements) {
            if (!stmt) continue;
            if (stmt.type === 'VariableDeclaration') {
                compiler.addLocal(stmt.declarations[0].id.name);
            } else if (stmt.type === 'ForStatement') {
                if (stmt.init && stmt.init.type === 'VariableDeclaration') {
                    compiler.addLocal(stmt.init.declarations[0].id.name);
                }
                if (stmt.body.type === 'BlockStatement') this.scanForLocals(stmt.body.body, compiler);
            } else if (stmt.type === 'IfStatement') {
                if (stmt.consequent.type === 'BlockStatement') {
                    this.scanForLocals(stmt.consequent.body, compiler);
                }
                if (stmt.alternate?.type === 'BlockStatement') {
                    this.scanForLocals(stmt.alternate.body, compiler);
                }
            }
        }
    }

    private serialize(): string {
        let output = this.serializeFunction(this.main!);
        for (const func of this.functions) {
            output += '\n\n';
            output += this.serializeFunction(func);
        }
        return output;
    }

    private serializeFunction(func: FunctionCompiler): string {
        let block = '.def\n';
        block += `.argc ${func.arity}\n`;
        block += `.locals ${func.locals.length - func.arity}\n`;
        block += `.name ${func.name}\n`;
        block += '.constants\n';
        func.constants.forEach(c => {
            if (typeof c === 'number') block += `number ${c}\n`;
            else if (typeof c === 'string') block += `string "${c}"\n`;
        });
        block += '.code\n';
        block += func.instructions.map(instr => {
            return instr.text.endsWith(':') 
                ? instr.text 
                : `${instr.line} ${instr.text}`;
        }).join('\n');
        return block;
    }
    
    private visit(node: any): void {
        if (!node) return;
        const line = node.line || 1;
        const C = this.currentCompiler!;

        switch (node.type) {
            case 'Program': node.body.forEach((s: any) => this.visit(s)); break;
            case 'BlockStatement': node.body.forEach((s: any) => this.visit(s)); break;
            case 'ExpressionStatement':
                this.visit(node.expression);
                C.emit('pop', line);
                break;
            case 'VariableDeclaration':
                const decl = node.declarations[0];
                if (decl.init) this.visit(decl.init);
                C.emit(`set_local ${C.addLocal(decl.id.name)}`, line);
                break;
            case 'ReturnStatement':
                this.visit(node.argument);
                C.emit('return', line);
                break;
            case 'IfStatement':
                const elseLabel = C.createLabel('endif');
                const endLabel = C.createLabel('end');
                this.visit(node.test);
                C.emit(`jmp_false ${elseLabel}`, line);
                this.visit(node.consequent);
                if (node.alternate) C.emit(`jmp ${endLabel}`, line);
                C.emit(`${elseLabel}:`, line);
                if (node.alternate) this.visit(node.alternate);
                if (node.alternate) C.emit(`${endLabel}:`, line);
                break;
            case 'ForStatement':
                const forcond = C.createLabel('forcond');
                const forblock = C.createLabel('forblock');
                const foraction = C.createLabel('foraction');
                const forend = C.createLabel('forend');
                if (node.init) this.visit(node.init);
                C.emit(`${forcond}:`, line);
                this.visit(node.test);
                C.emit(`jmp_false ${forend}`, line);
                C.emit(`jmp ${forblock}`, line);
                C.emit(`${foraction}:`, line);
                if (node.update) {
                    if (node.update.type === 'AssignmentExpression' && node.update.right.type === 'BinaryExpression' && node.update.right.operator === '+' && node.update.right.right.value === 1) {
                         const idx = C.locals.indexOf(node.update.left.name);
                         if (idx > -1) C.emit(`inc_local ${idx}`, line);
                         this.visit(node.update.left); // get the value back for popping
                    } else {
                        this.visit(node.update);
                    }
                    C.emit('pop', line);
                }
                C.emit(`jmp ${forcond}`, line);
                C.emit(`${forblock}:`, line);
                this.visit(node.body);
                C.emit(`jmp ${foraction}`, line);
                C.emit(`${forend}:`, line);
                break;
            case 'AssignmentExpression':
                const left = node.left;
                if (left.type === 'Identifier') {
                    this.visit(node.right);
                    const res = C.locals.indexOf(left.name);
                    if (res > -1) {
                        C.emit(`set_local ${res}`, line);
                        C.emit(`get_local ${res}`, line);
                    }
                } else if (left.type === 'MemberExpression') {
                    this.visit(node.right);
                    this.visit(left.object);
                    this.visit(left.property);
                    C.emit(`set_el`, line);
                    this.visit(left.object);
                    this.visit(left.property);
                    C.emit(`get_el`, line);
                }
                break;
            case 'BinaryExpression': this.visit(node.left); this.visit(node.right); this.emitBinaryOp(node.operator, line); break;
            case 'CallExpression':
                node.arguments.forEach((arg: any) => this.visit(arg));
                this.visit(node.callee);
                C.emit('call', line);
                break;
            case 'Identifier':
                const res = C.resolveVariable(node.name);
                if (res.type === 'local') {
                    C.emit(`get_local ${res.index}`, line);
                } else {
                    const funcIndex = this.userFunctionNames.indexOf(node.name);
                    if (funcIndex > -1) {
                        C.emit(`load_fn ${funcIndex + 1}`, line);
                    } else {
                        C.emit(`get_global ${res.index}`, line);
                    }
                }
                break;
            case 'MemberExpression':
                this.visit(node.object);
                this.visit(node.property);
                C.emit(`get_el`, line);
                break;
            case 'ArrayExpression':
                node.elements.forEach((el: any) => this.visit(el));
                C.emit(`create_arr ${node.elements.length}`, line);
                break;
            case 'NumericLiteral': C.emit(`const ${C.addConstant(node.value)}`, line); break;
            case 'StringLiteral': C.emit(`const ${C.addConstant(node.value)}`, line); break;
            case 'UnaryExpression':
                this.visit(node.argument);
                if (node.operator === '-') C.emit('neg', line);
                break;
            default: throw new Error(`Генерация кода не реализована для узла типа: ${node.type}`);
        }
    }

    private emitBinaryOp(op: string, line: number) {
        const map: { [k: string]: string } = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod', '==': 'ceq', '>': 'cgt', '<': 'clt' };
        if (map[op]) this.currentCompiler!.emit(map[op], line);
        else throw new Error(`Неизвестный оператор: ${op}`);
    }
} 