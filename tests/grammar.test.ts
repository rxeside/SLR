import { SLRTableGenerator, parseGrammar } from '@src/transitionTable/generator';
import { Parser } from '@src/transitionTable/parser';
import { Lexer } from '@src/lexer/lexer';
import { testInputs } from './test-inputs';

describe('Grammar Tests', () => {
    let lexer: Lexer;
    let parser: Parser;
    let transitionTable: any;
    let grammar: any;

    beforeAll(() => {
        // Читаем грамматику из файла
        const fs = require('fs');
        const grammarText = fs.readFileSync('Grammar.txt', 'utf8');
        const grammarLines = grammarText.split('\n').filter((line: string) => line.trim() !== '');
        
        // Создаем генератор таблицы переходов
        const generator = new SLRTableGenerator(grammarLines);
        transitionTable = generator.buildTable();
        grammar = parseGrammar(grammarLines);
        lexer = new Lexer();
    });

    test.each(testInputs)('should parse: %s', (input) => {
        try {
            const tokens = lexer.tokenize(input);
            parser = new Parser(tokens, transitionTable, grammar);
            parser.parse();
            // Если парсинг успешен, тест пройден
            expect(true).toBe(true);
        } catch (error) {
            // Если парсинг не удался, выводим ошибку и помечаем тест как проваленный
            console.error(`Failed to parse: ${input}`);
            console.error(error);
            throw error;
        }
    });
}); 