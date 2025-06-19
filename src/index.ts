import fs from 'fs';
import { Lexer } from './lexer/lexer';
import { SLRParser } from './slr/slr';
import { fullGrammar } from '../integration-tests/grammars';
import { Program, VarDecl, AssignExpr, Identifier } from './ast/entity';
import { CodeGenerator } from './generator/generator';
import { SemanticAnalyzer } from './analyzer/analyzer';
import { SymbolTable } from './symbolTable/symbolTable';
import * as vm from 'vm';
import { ErrorHandler } from './error/error';

function compileAndRun(sourceCode: string): void {
    const errorHandler = new ErrorHandler();
    errorHandler.setSourceCode(sourceCode);

    // 1. Lexer
    const lexer = new Lexer();
    const tokens = lexer.tokenize(sourceCode, errorHandler);

    // 2. Parser
    const parser = new SLRParser(fullGrammar, errorHandler);
    const ast = parser.parse(tokens);

    if (errorHandler.hasErrors() || !ast) {
        errorHandler.printErrors();
        console.log('Compilation failed.');
        return;
    }

    // 3. Semantic Analyzer
    const symbolTable = new SymbolTable();
    const analyzer = new SemanticAnalyzer(symbolTable, errorHandler);
    analyzer.analyze(ast);

    if (errorHandler.hasErrors()) {
        errorHandler.printErrors();
        console.log('Compilation failed.');
        return;
    }

    // 4. Code Generator
    const generator = new CodeGenerator();
    let jsCode = generator.generate(ast);

    // Wrap the code to capture the last expression's value
    const lastStatement = ast.statements[ast.statements.length - 1];
    let resultVariableName: string | null = null;
    if (lastStatement instanceof VarDecl) {
        resultVariableName = lastStatement.name;
    } else if (lastStatement instanceof AssignExpr && lastStatement.target instanceof Identifier) {
        resultVariableName = lastStatement.target.name;
    }

    if (resultVariableName) {
        jsCode += `\n;${resultVariableName};`;
    }

    // 5. Run the generated code
    const sandbox = {
        console: {
            log: (...args: any[]) => {
                // Intercept log calls if needed in the future
            }
        }
    };

    try {
        const result = vm.runInNewContext(jsCode, sandbox);
        console.log(result);
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