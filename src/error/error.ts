export enum ErrorType {
    Lexical,
    Syntax,
    Semantic
}

export class CompilerError extends Error {
    constructor(
        public message: string,
        public line: number,
        public column: number,
        public type: ErrorType,
    ) {
        super(message);
    }
}

export class ErrorHandler {
    public errors: CompilerError[] = [];
    private sourceCode: string = '';

    public setSourceCode(sourceCode: string) {
        this.sourceCode = sourceCode;
    }

    public addError(message: string, line: number, column: number, type: ErrorType) {
        this.errors.push(new CompilerError(message, line, column, type));
    }

    public hasErrors(): boolean {
        return this.errors.length > 0;
    }

    public printErrors(): void {
        const lines = this.sourceCode.split('\n');
        for (const error of this.errors) {
            console.error(
                `[${ErrorType[error.type]} Error] at ${error.line}:${error.column}: ${error.message}`
            );
            if (error.line > 0) {
                console.error(`  ${lines[error.line - 1]}`);
                console.error('  ' + ' '.repeat(error.column - 1) + '^');
            }
        }
    }
} 