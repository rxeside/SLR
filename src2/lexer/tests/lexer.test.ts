import { TT } from "../constants";
import { Lexer } from "../lexer";

describe('Lexer', () => {
    let lexer: Lexer;

    beforeEach(() => {
        lexer = new Lexer();
    });

    // строковая константа не закрыта

    test('should tokenize keywords correctly', () => {
        const input = 'let const function if else while return';
        const tokens = lexer.tokenize(input);
        const expectedTypes = [
            TT.KEYWORD_LET, TT.KEYWORD_CONST, TT.KEYWORD_FUNCTION,
            TT.KEYWORD_IF, TT.KEYWORD_ELSE, TT.KEYWORD_WHILE, TT.KEYWORD_RETURN, TT.EOF
        ];
        expect(tokens.map(t => t.type)).toEqual(expectedTypes);
        expect(tokens[0].value).toBe('let');
    });

    test('should tokenize identifiers', () => {
        const input = 'myVar _anotherVar var123';
        const tokens = lexer.tokenize(input);
        expect(tokens.map(t => t.type)).toEqual([TT.IDENTIFIER, TT.IDENTIFIER, TT.IDENTIFIER, TT.EOF]);
        expect(tokens[0].value).toBe('myVar');
        expect(tokens[1].value).toBe('_anotherVar');
        expect(tokens[2].value).toBe('var123');
    });

    test('should tokenize numbers', () => {
        const input = '123 0 4567';
        const tokens = lexer.tokenize(input);
        expect(tokens.map(t => t.type)).toEqual([TT.NUMBER, TT.NUMBER, TT.NUMBER, TT.EOF]);
        expect(tokens[0].value).toBe('123');
    });

    test('should tokenize operators and punctuation', () => {
        const input = '+ - * / = ; , ( ) { }';
        const tokens = lexer.tokenize(input);
        const expectedTypes = [
            TT.OPERATOR_PLUS, TT.OPERATOR_MINUS, TT.OPERATOR_MULTIPLY, TT.OPERATOR_DIVIDE,
            TT.OPERATOR_ASSIGN, TT.PUNCT_SEMICOLON, TT.PUNCT_COMMA, TT.PUNCT_LPAREN,
            TT.PUNCT_RPAREN, TT.PUNCT_LBRACE, TT.PUNCT_RBRACE, TT.EOF
        ];
        expect(tokens.map(t => t.type)).toEqual(expectedTypes);
    });

    test('should ignore whitespace and comments', () => {
        const input = `
            // This is a comment
            let  x; // Another comment
              // Yet another
        `;
        const tokens = lexer.tokenize(input);
        expect(tokens.map(t => t.type)).toEqual([TT.KEYWORD_LET, TT.IDENTIFIER, TT.PUNCT_SEMICOLON, TT.EOF]);
        expect(tokens[1].value).toBe('x');
    });

    test('should handle empty input', () => {
        const input = '';
        const tokens = lexer.tokenize(input);
        expect(tokens.map(t => t.type)).toEqual([TT.EOF]);
    });

    test('should handle input with only whitespace/comments', () => {
        const input = '   // comment \n  ';
        const tokens = lexer.tokenize(input);
        expect(tokens.map(t => t.type)).toEqual([TT.EOF]);
    });

    test('should report unknown tokens', () => {
        const input = 'let a = @#;';
        // Подавляем console.error для этого теста, если он мешает
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const tokens = lexer.tokenize(input);
        expect(tokens.map(t => t.type)).toEqual([
            TT.KEYWORD_LET, TT.IDENTIFIER, TT.OPERATOR_ASSIGN, 
            TT.UNKNOWN, TT.UNKNOWN, TT.PUNCT_SEMICOLON, TT.EOF
        ]);
        expect(tokens[3].value).toBe('@');
        expect(tokens[4].value).toBe('#');
        consoleErrorSpy.mockRestore();
    });

    test('should correctly track line and column numbers', () => {
        const input = `let x;
function y() {
  return 0;
}`;
        const tokens = lexer.tokenize(input);
        // Ожидаемые позиции (примерные, проверьте точно)
        // let
        expect(tokens[0].line).toBe(1);
        expect(tokens[0].column).toBe(1);
        // x
        expect(tokens[1].line).toBe(1);
        expect(tokens[1].column).toBe(5);
        // ;
        expect(tokens[2].line).toBe(1);
        expect(tokens[2].column).toBe(6);
        // function
        expect(tokens[3].line).toBe(2);
        expect(tokens[3].column).toBe(1);
        // EOF
        const eofToken = tokens[tokens.length - 1];
        expect(eofToken.line).toBe(4); // После '}'
        // Точная колонка EOF может зависеть от того, есть ли перевод строки в конце
    });

    test('keyword-like identifier', () => {
        const input = 'letter iffi';
        const tokens = lexer.tokenize(input);
        expect(tokens.map(t => t.type)).toEqual([TT.IDENTIFIER, TT.IDENTIFIER, TT.EOF]);
        expect(tokens[0].value).toBe('letter');
        expect(tokens[1].value).toBe('iffi');
    });
});