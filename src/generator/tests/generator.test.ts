import { Lexer } from '../../lexer/lexer';
import { SLRParser } from '../../slr/slr';
import { fullGrammar } from '../../../integration-tests/grammars';
import { Program } from '../../ast/entity';
import { CodeGenerator } from '../generator';
import { SemanticAnalyzer } from '../../analyzer/analyzer';
import { SymbolTable } from '../../symbolTable/symbolTable';

describe('CodeGenerator', () => {
    const generateCode = (source: string): string => {
        const lexer = new Lexer();
        const tokens = lexer.tokenize(source);
        const parser = new SLRParser(fullGrammar);
        const ast = parser.parse(tokens);
        
        if (!(ast instanceof Program)) {
            throw new Error('Failed to parse');
        }

        const symbolTable = new SymbolTable();
        const analyzer = new SemanticAnalyzer(symbolTable);
        analyzer.analyze(ast); // Analyze before generating

        const generator = new CodeGenerator();
        return generator.generate(ast);
    };

    test('should generate correct code for variable declaration', () => {
        const source = 'let x: num = 10;';
        const expected = 'let x = 10';
        const actual = generateCode(source);
        expect(actual.trim()).toBe(expected);
    });

    test('should generate correct code for function declaration', () => {
        const source = `
            function myFunc(a: num, b: string): num {
                let result: num = a + 1;
                return result;
            }
        `;
        const expected = `function myFunc(a, b) {\nlet result = a + 1;\nreturn result\n}`;
        const actual = generateCode(source);
        expect(actual.replace(/\s+/g, ' ')).toBe(expected.replace(/\s+/g, ' '));
    });

    test('should generate correct code for control flow and expressions', () => {
        const source = `
            function fib(n: num): num {
                if (n < 2) {
                    return n;
                }
                return fib(n - 1) + fib(n - 2);
            }
            let result: num = fib(10);
        `;
        const expected = `function fib(n) {\nif (n < 2) {\nreturn n\n};\nreturn fib(n - 1) + fib(n - 2)\n};\nlet result = fib(10)`;
        const actual = generateCode(source);
        expect(actual.replace(/\s+/g, ' ')).toBe(expected.replace(/\s+/g, ' '));
    });
}); 