import {Lexeme, Token} from '@common/types'

function getKeyword(value: string): Lexeme | undefined {
    const keywords = [
        Lexeme.IF,
        Lexeme.THEN,
        Lexeme.ELSE,
        Lexeme.OR,
        Lexeme.AND,
        Lexeme.THEN,
        Lexeme.DIV,
        Lexeme.MOD,
        Lexeme.NOT,
        Lexeme.TRUE,
        Lexeme.FALSE,
    ]

    return keywords.find(keyword => keyword === value.toUpperCase()) as Lexeme | undefined
}

class Lexer {
    private text: string = ''
    private pos: number = 0
    private currentChar: string | null = null
    private line: number = 1
    private column: number = 0

    constructor() {
    }

    public tokenize(text: string): Token[] {
        this.reset()
        this.text = text
        this.currentChar = this.text[this.pos] || null

        const tokens: Token[] = []
        let token: Token | null
        do {
            token = this.nextToken()
            if (token) tokens.push(token)
        } while (token && token.type !== Lexeme.GRID)
        return tokens
    }

    private reset(): void {
        this.text = ''
        this.pos = 0
        this.currentChar = null
        this.line = 1
        this.column = 0
    }

    private advance(): void {
        if (this.currentChar === '\n') {
            this.line++
            this.column = 0
        } else {
            this.column++
        }
        this.pos++
        this.currentChar = this.pos < this.text.length ? this.text[this.pos] : null
    }

    private peek(): string | null {
        return this.pos + 1 < this.text.length ? this.text[this.pos + 1] : null
    }

    private skipWhitespace(): void {
        while (this.currentChar && /\s/.test(this.currentChar)) {
            this.advance()
        }
    }

    private skipComment(): Token | null {
        const startLine = this.line
        const startColumn = this.column
        let result = ''

        if (this.currentChar === '/' && this.peek() === '/') {
            while (this.currentChar && this.currentChar !== ('\n' as string)) {
                result += this.currentChar
                this.advance()
            }
            return {
                type: Lexeme.LINE_COMMENT,
                lexeme: result,
                position: {line: startLine, column: startColumn},
            }
        } else if (this.currentChar === '{') {
            result += this.currentChar
            this.advance()

            while (this.currentChar && this.currentChar !== ('}' as string)) {
                result += this.currentChar
                this.advance()
            }

            if (this.currentChar === ('}' as string)) {
                result += this.currentChar
                this.advance()
            } else {
                return {
                    type: Lexeme.ERROR,
                    lexeme: result,
                    position: {line: startLine, column: startColumn},
                }
            }

            return {
                type: Lexeme.BLOCK_COMMENT,
                lexeme: result,
                position: {line: startLine, column: startColumn},
            }
        }

        return null
    }

    private number(): Token {
        const startColumn = this.column
        const startLine = this.line
        let result = ''
        let isFloat = false
        let dotCount = 0

        while (this.currentChar && /\d/.test(this.currentChar)) {
            result += this.currentChar
            this.advance()
        }

        if (this.currentChar === '.' && this.peek() === '.') {
            return {
                type: Lexeme.INTEGER,
                lexeme: result,
                position: {line: startLine, column: startColumn},
            }
        }

        if (this.currentChar === '.') {
            while (this.currentChar === '.') {
                result += this.currentChar
                dotCount++
                this.advance()
            }
            if (dotCount > 1 || !/\d/.test(this.currentChar || '')) {
                while (this.currentChar && /[a-zA-Z\d.]/.test(this.currentChar)) {
                    result += this.currentChar
                    this.advance()
                }
                return {
                    type: Lexeme.ERROR,
                    lexeme: result,
                    position: {line: startLine, column: startColumn},
                }
            }
            isFloat = true

            while (this.currentChar && /\d/.test(this.currentChar)) {
                result += this.currentChar
                this.advance()
            }
        }

        if (this.currentChar?.toLowerCase() === 'e') {
            result += this.currentChar
            this.advance()

            if (this.currentChar === '+' || this.currentChar === '-') {
                result += this.currentChar
                this.advance()
            }

            if (!/\d/.test(this.currentChar || '')) {
                return {
                    type: Lexeme.ERROR,
                    lexeme: result,
                    position: {line: startLine, column: startColumn},
                }
            }

            while (this.currentChar && /\d/.test(this.currentChar)) {
                result += this.currentChar
                this.advance()
            }

            isFloat = true
        }

        if (this.currentChar === '.') {
            while (this.currentChar && this.currentChar !== ('\n' as string) && this.currentChar !== (' ' as string)) {
                result += this.currentChar
                this.advance()
            }
            return {
                type: Lexeme.ERROR,
                lexeme: result,
                position: {line: startLine, column: startColumn},
            }
        }

        if (/[a-zA-Z_а-яА-Я]/.test(this.currentChar || '')) {
            while (this.currentChar && !/\s/.test(this.currentChar)) {
                result += this.currentChar
                this.advance()
            }
            return {
                type: Lexeme.ERROR,
                lexeme: result,
                position: {line: startLine, column: startColumn},
            }
        }

        return {
            type: isFloat ? Lexeme.FLOAT : Lexeme.INTEGER,
            lexeme: result,
            position: {line: startLine, column: startColumn},
        }
    }

    private identifierOrInvalid(): Token {
        const startColumn = this.column
        const startLine = this.line
        let result = ''

        while (this.currentChar && /[a-zA-Z0-9_а-яА-Я]/.test(this.currentChar)) {
            result += this.currentChar
            this.advance()
        }

        if (/[а-яА-Я]/.test(result)) {
            return {
                type: Lexeme.ERROR,
                lexeme: result,
                position: {line: startLine, column: startColumn},
            }
        }

        const keyword = getKeyword(result)
        if (keyword) {
            return {
                type: keyword,
                lexeme: result,
                position: {line: startLine, column: startColumn},
            }
        }

        return {
            type: Lexeme.IDENTIFIER,
            lexeme: result,
            position: {line: startLine, column: startColumn},
        }
    }

    private string(): Token {
        const startColumn = this.column
        const startLine = this.line
        let result = ''

        this.advance()
        while (this.currentChar && this.currentChar !== '"' && this.currentChar !== '\n') {
            result += this.currentChar
            this.advance()
        }

        if (this.currentChar === '"') {
            this.advance()
            return {
                type: Lexeme.STRING,
                lexeme: `${result}`,
                position: {line: startLine, column: startColumn},
            }
        }

        return {
            type: Lexeme.ERROR,
            lexeme: result,
            position: {line: startLine, column: startColumn},
        }
    }

    private operatorOrPunctuation(): Token {
        const startColumn = this.column
        const startLine = this.line
        const char = this.currentChar

        if (char === '=' && this.peek() === '=') {
            this.advance()
            this.advance()
            return {
                type: Lexeme.DOUBLE_EQ,
                lexeme: '==',
                position: {line: startLine, column: startColumn},
            }
        }
        if (char === '!' && this.peek() === '=') {
            this.advance()
            this.advance()
            return {
                type: Lexeme.NOT_EQ,
                lexeme: '!=',
                position: {line: startLine, column: startColumn},
            }
        }
        if (char === '>' && this.peek() === '=') {
            this.advance()
            this.advance()
            return {
                type: Lexeme.GREATER_EQ,
                lexeme: '>=',
                position: {line: startLine, column: startColumn},
            }
        }
        if (char === '<' && this.peek() === '=') {
            this.advance()
            this.advance()
            return {
                type: Lexeme.LESS_EQ,
                lexeme: '<=',
                position: {line: startLine, column: startColumn},
            }
        }

        const singleCharOperators: Record<string, Lexeme> = {
            '*': Lexeme.MULTIPLICATION,
            '+': Lexeme.PLUS,
            '-': Lexeme.MINUS,
            '/': Lexeme.DIVIDE,
            ';': Lexeme.SEMICOLON,
            ',': Lexeme.COMMA,
            '(': Lexeme.LEFT_PAREN,
            ')': Lexeme.RIGHT_PAREN,
            '[': Lexeme.LEFT_BRACKET,
            ']': Lexeme.RIGHT_BRACKET,
            '=': Lexeme.ASSIGN,
            '>': Lexeme.GREATER,
            '<': Lexeme.LESS,
            ':': Lexeme.COLON,
            '.': Lexeme.DOT,
            '!': Lexeme.NEGATION,
            '#': Lexeme.GRID,
        }

        if (singleCharOperators[char]) {
            this.advance()
            return {
                type: singleCharOperators[char],
                lexeme: char,
                position: {line: startLine, column: startColumn},
            }
        }

        this.advance()
        return {
            type: Lexeme.ERROR,
            lexeme: char,
            position: {line: startLine, column: startColumn},
        }
    }

    private nextToken(): Token | null {
        while (this.currentChar) {
            if (/\s/.test(this.currentChar)) {
                this.skipWhitespace()
                continue
            }
            if (this.currentChar === '/' && this.peek() === '/') {
                return this.skipComment()
            }
            if (this.currentChar === '{') {
                return this.skipComment()
            }
            if (this.currentChar === '"') {
                return this.string()
            }
            if (/[a-zA-Z_а-яА-Я]/.test(this.currentChar)) {
                return this.identifierOrInvalid()
            }
            if (/\d/.test(this.currentChar)) {
                return this.number()
            }
            return this.operatorOrPunctuation()
        }
        return {
            type: Lexeme.GRID,
            lexeme: '#',
            position: {line: this.line, column: this.column},
        }
    }
}

export {
    Lexer,
}
