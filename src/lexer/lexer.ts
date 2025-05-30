import { EOF_SYMBOL, TT, tokenSpecifications } from "./constants";
import { Token } from "./type";

export class Lexer {
    private input: string = "";
    private cursor: number = 0;
    private line: number = 1;
    private column: number = 1;

    public tokenize(input: string): Token[] {
        this.input = input;
        this.cursor = 0;
        this.line = 1;
        this.column = 1;
        const tokens: Token[] = [];

        while (this.cursor < this.input.length) {
            const token = this.getNextToken();
            if (token) {
                tokens.push(token);
            }
        }

        // Добавляем токен конца файла
        tokens.push({
            type: TT.EOF,
            value: EOF_SYMBOL,
            line: this.line,
            column: this.column
        });

        return tokens;
    }

    private getNextToken(): Token | null {
        if (this.cursor >= this.input.length) {
            return null; // Достигнут конец строки
        }

        const stringToMatch = this.input.substring(this.cursor);

        for (const [regex, tokenType] of tokenSpecifications) {
            const match = regex.exec(stringToMatch);

            if (match && match.index === 0) { // Убедимся, что совпадение с начала строки
                const value = match[0];
                const startLine = this.line;
                const startColumn = this.column;

                // Обновляем позицию курсора, строки и колонки
                this.cursor += value.length;
                const linesInValue = value.split('\n');
                if (linesInValue.length > 1) {
                    this.line += linesInValue.length - 1;
                    this.column = linesInValue[linesInValue.length - 1].length + 1;
                } else {
                    this.column += value.length;
                }
                
                if (tokenType === null) { // Игнорируемый токен (пробел, комментарий)
                    return this.getNextToken(); // Рекурсивно получаем следующий значащий токен
                }

                return {
                    type: tokenType,
                    value: value,
                    line: startLine,
                    column: startColumn
                };
            }
        }

        // Если ни одно правило не подошло
        const unknownChar = stringToMatch[0];
        const errorToken: Token = {
            type: TT.UNKNOWN,
            value: unknownChar,
            line: this.line,
            column: this.column
        };
        
        // Пропускаем неизвестный символ, чтобы избежать бесконечного цикла
        this.cursor++;
        this.column++;
        
        console.error(`Неизвестный токен: '${unknownChar}' в строке ${this.line}, колонке ${this.column -1}`);
        return errorToken;
    }
}