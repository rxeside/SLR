import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { PvmCodeGenerator } from '../../src/generator-pvm/PvmCodeGenerator';
import { Lexer } from '../../src/lexer/lexer';
import { SLRParser } from '../../src/slr/slr';
import { fullGrammar } from '../grammars';
import { ErrorHandler, ErrorType } from '../../src/error/error';
import { SemanticAnalyzer } from '../../src/analyzer/analyzer';
import { SymbolTable } from '../../src/symbolTable/symbolTable';

// Function to compile source code to PVM bytecode
const compileToPvm = (sourceCode: string): string => {
    const errorHandler = new ErrorHandler();
    errorHandler.setSourceCode(sourceCode);

    const lexer = new Lexer();
    const tokens = lexer.tokenize(sourceCode, errorHandler);
    
    if (errorHandler.hasErrors()) {
        throw new Error("Lexing failed:\\n" + errorHandler.errors.map(e => e.message).join('\\n'));
    }

    const parser = new SLRParser(fullGrammar, errorHandler);
    const ast = parser.parse(tokens);

    if (errorHandler.hasErrors() || !ast) {
        throw new Error("Parsing failed:\\n" + errorHandler.errors.map(e => e.message).join('\\n'));
    }

    const symbolTable = new SymbolTable();
    const analyzer = new SemanticAnalyzer(symbolTable, errorHandler);
    analyzer.analyze(ast);

    if (errorHandler.hasErrors()) {
        throw new Error("Semantic analysis failed:\\n" + errorHandler.errors.map(e => e.message).join('\\n'));
    }
    
    const generator = new PvmCodeGenerator();
    return generator.generate(ast);
};

// Test suite for PVM integration tests
describe('PVM Integration Tests', () => {
    const sourcesDir = path.join(__dirname, 'sources');
    const pvmExecutable = path.resolve(__dirname, '..', '..', 'pvm-runtime', 'pvm-linux');

    // Find all .lang files in the sources directory
    const testFiles = fs.readdirSync(sourcesDir).filter(file => file.endsWith('.lang'));

    // Dynamically create a test for each file
    testFiles.forEach(file => {
        it(`should correctly execute ${file}`, () => {
            const filePath = path.join(sourcesDir, file);
            const sourceCode = fs.readFileSync(filePath, 'utf-8');

            // Extract expected output from comments
            const expectedOutputLines = sourceCode.split('\\n')
                .filter(line => line.startsWith('// Expected:'))
                .map(line => line.replace('// Expected:', '').trim());
            const expectedOutput = expectedOutputLines.join('\\n');

            // 1. Compile the source code to PVM bytecode
            let bytecode = '';
            try {
                bytecode = compileToPvm(sourceCode);
            } catch (e: any) {
                throw new Error("Compilation failed: " + e.message);
            }

            // 2. Write bytecode to a temporary file
            const bytecodePath = path.join(__dirname, 'temp_bytecode.pvmc');
            fs.writeFileSync(bytecodePath, bytecode);

            // 3. Execute the PVM with the bytecode
            let actualOutput = '';
            try {
                const result = execSync(`"${pvmExecutable}" "${bytecodePath}"`);
                actualOutput = result.toString().trim();
            } catch (e: any) {
                throw new Error(`PVM execution failed: ${e.stderr.toString()}`);
            }
            
            // 4. Clean up the temporary file
            fs.unlinkSync(bytecodePath);

            // 5. Assert the output
            expect(actualOutput).toEqual(expectedOutput);
        });
    });
}); 