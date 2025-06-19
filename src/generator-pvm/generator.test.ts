import { PvmCodeGenerator } from './PvmCodeGenerator';
import { Program, CallExpr, Literal, VarDecl, Identifier, BinaryExpr, AssignExpr, IfStmt, Block, WhileStmt, FuncDecl, Param, ReturnStmt } from '../ast/entity';

describe('PvmCodeGenerator', () => {
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

    it('should generate correct bytecode for a simple print call', () => {
        // AST for: print("hello")
        const ast = new Program([new CallExpr('print', [new Literal('hello')])]);
        const generator = new PvmCodeGenerator();
        const bytecode = generator.generate(ast);
        const expectedBytecode = `
.def
.argc 0
.locals 0
.name __EntryPoint__
.constants
string "hello"
string "print"
.code
0 const 0
1 get_global 1
2 call 1
3 pop
4 return
.end_def
`;
        expect(normalize(bytecode)).toEqual(normalize(expectedBytecode));
    });

    it('should handle variable declaration and usage', () => {
        // AST for: let a = 10; print(a);
        const ast = new Program([
            new VarDecl('a', 'num', new Literal(10)),
            new CallExpr('print', [new Identifier('a')])
        ]);
        const generator = new PvmCodeGenerator();
        const bytecode = generator.generate(ast);
        const expectedBytecode = `
.def
.argc 0
.locals 0
.name __EntryPoint__
.constants
number 10
string "a"
string "print"
.code
0 const 0
1 def_global 1
2 get_global 1
3 get_global 2
4 call 1
5 pop
6 return
.end_def
`;
        expect(normalize(bytecode)).toEqual(normalize(expectedBytecode));
    });

    it('should handle arithmetic expressions', () => {
        // AST for: print(10 + 5);
        const ast = new Program([
            new CallExpr('print', [
                new BinaryExpr(new Literal(10), '+', new Literal(5))
            ])
        ]);
        const generator = new PvmCodeGenerator();
        const bytecode = generator.generate(ast);
        const expectedBytecode = `
.def
.argc 0
.locals 0
.name __EntryPoint__
.constants
number 10
number 5
string "print"
.code
0 const 0
1 const 1
2 add
3 get_global 2
4 call 1
5 pop
6 return
.end_def
`;
        expect(normalize(bytecode)).toEqual(normalize(expectedBytecode));
    });

    it('should handle variable assignment', () => {
        // AST for: let a = 10; a = 15; print(a);
        const ast = new Program([
            new VarDecl('a', 'num', new Literal(10)),
            new AssignExpr(new Identifier('a'), new Literal(15)),
            new CallExpr('print', [new Identifier('a')])
        ]);
        const generator = new PvmCodeGenerator();
        const bytecode = generator.generate(ast);
        const expectedBytecode = `
.def
.argc 0
.locals 0
.name __EntryPoint__
.constants
number 10
string "a"
number 15
string "print"
.code
0 const 0
1 def_global 1
2 const 2
3 set_global 1
4 get_global 1
5 get_global 3
6 call 1
7 pop
8 return
.end_def
`;
        expect(normalize(bytecode)).toEqual(normalize(expectedBytecode));
    });

    it('should handle comparison expressions', () => {
        // AST for: print(10 > 5);
        const ast = new Program([
            new CallExpr('print', [
                new BinaryExpr(new Literal(10), '>', new Literal(5))
            ])
        ]);
        const generator = new PvmCodeGenerator();
        const bytecode = generator.generate(ast);
        const expectedBytecode = `
.def
.argc 0
.locals 0
.name __EntryPoint__
.constants
number 10
number 5
string "print"
.code
0 const 0
1 const 1
2 cgt
3 get_global 2
4 call 1
5 pop
6 return
.end_def
`;
        expect(normalize(bytecode)).toEqual(normalize(expectedBytecode));
    });

    it('should handle if-else statements', () => {
        // AST for: if (10 > 5) { print("yes"); } else { print("no"); }
        const ast = new Program([
            new IfStmt(
                new BinaryExpr(new Literal(10), '>', new Literal(5)),
                new Block([new CallExpr('print', [new Literal('yes')])]),
                [], // No elif branches
                new Block([new CallExpr('print', [new Literal('no')])])
            )
        ]);
        const generator = new PvmCodeGenerator();
        const bytecode = generator.generate(ast);
        const expectedBytecode = `
.def
.argc 0
.locals 0
.name __EntryPoint__
.constants
number 10
number 5
string "yes"
string "print"
string "no"
.code
0 const 0
1 const 1
2 cgt
3 jmp_if_false 6
4 const 2
5 get_global 3
6 call 1
7 pop
8 jmp 5
9 const 4
10 get_global 3
11 call 1
12 pop
13 return
.end_def
`;
        expect(normalize(bytecode)).toEqual(normalize(expectedBytecode));
    });

    it('should handle while loops', () => {
        // AST for: let i = 0; while (i < 3) { i = i + 1; }
        const ast = new Program([
            new VarDecl('i', 'num', new Literal(0)),
            new WhileStmt(
                new BinaryExpr(new Identifier('i'), '<', new Literal(3)),
                new Block([
                    new AssignExpr(new Identifier('i'), new BinaryExpr(new Identifier('i'), '+', new Literal(1)))
                ])
            )
        ]);
        const generator = new PvmCodeGenerator();
        const bytecode = generator.generate(ast);
        const expectedBytecode = `
.def
.argc 0
.locals 0
.name __EntryPoint__
.constants
number 0
string "i"
number 3
number 1
.code
0 const 0
1 def_global 1
2 get_global 1
3 const 2
4 clt
5 jmp_if_false 6
6 get_global 1
7 const 3
8 add
9 set_global 1
10 jmp -8
11 return
.end_def
`;
        expect(normalize(bytecode)).toEqual(normalize(expectedBytecode));
    });

    it('should handle user-defined functions with local variables', () => {
        // AST for: function my_add(a, b) { return a + b; } print(my_add(5, 15));
        const ast = new Program([
            new FuncDecl('my_add', [new Param('a', 'num'), new Param('b', 'num')], 'num',
                new Block([
                    new ReturnStmt(new BinaryExpr(new Identifier('a'), '+', new Identifier('b')))
                ])
            ),
            new CallExpr('print', [
                new CallExpr('my_add', [new Literal(5), new Literal(15)])
            ])
        ]);
        const generator = new PvmCodeGenerator();
        const bytecode = generator.generate(ast);
        const expectedBytecode = `
.def
.argc 2
.locals 0
.name my_add
.constants
.code
0 get_local 0
1 get_local 1
2 add
3 return
.end_def

.def
.argc 0
.locals 0
.name __EntryPoint__
.constants
string "my_add"
number 5
number 15
string "print"
.code
0 def_global 0
1 const 1
2 const 2
3 get_global 0
4 call 2
5 get_global 3
6 call 1
7 pop
8 return
.end_def
`;
        expect(normalize(bytecode)).toEqual(normalize(expectedBytecode));
    });
}); 