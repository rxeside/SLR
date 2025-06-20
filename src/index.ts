import fs from 'fs';
import { Lexer } from './lexer/lexer';
import { SLRParser } from './slr/slr';
import { fullGrammar } from '../integration-tests/grammars';
import { VarDecl, AssignExpr, Identifier } from './ast/entity';
import { CodeGenerator } from './generator/generator';
import { SemanticAnalyzer } from './analyzer/analyzer';
import { SymbolTable } from './symbolTable/symbolTable';
import * as vm from 'vm';
import { ErrorHandler } from './error/error';

function compileAndRun(sourceCode: string): void {
    const errorHandler = new ErrorHandler();
    errorHandler.setSourceCode(sourceCode);

    const lexer = new Lexer();
    const tokens = lexer.tokenize(sourceCode, errorHandler);

    const parser = new SLRParser(fullGrammar, errorHandler);
    const ast = parser.parse(tokens);

    if (errorHandler.hasErrors() || !ast) {
        errorHandler.printErrors();
        console.log('Compilation failed.');
        return;
    }

    const symbolTable = new SymbolTable();
    const analyzer = new SemanticAnalyzer(symbolTable, errorHandler);
    analyzer.analyze(ast);

    if (errorHandler.hasErrors()) {
        errorHandler.printErrors();
        console.log('Compilation failed.');
        return;
    }

    const generator = new CodeGenerator();
    const jsCode = generator.generate(ast);

    const capturedOutput = [];
    const sandbox = {
        console: {
            log: (...args: any[]) => {
                capturedOutput.push(args.map(arg => JSON.stringify(arg, null, 2)).join(' '));
            }
        }
    };

    try {
        vm.runInNewContext(jsCode, sandbox);
        if (capturedOutput.length > 0) {
            console.log(capturedOutput.join('\n'));
        }
    } catch (e) {
        console.error("Error during execution:", e);
    }
}

function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error("Please provide a path to the source file.");
        process.exit(1);
    }

    try {
        const sourceCode = fs.readFileSync(filePath, 'utf-8');
        compileAndRun(sourceCode);
    } catch (error) {
        console.error(`Error processing file: ${error.message}`);
        process.exit(1);
    }
}

main(); 