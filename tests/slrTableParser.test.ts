// slrTableParser.test.ts
import { SLRTableParser } from 'src2/slrTableParser';
import { SLRTableBuilder, } from 'src2/slrTableBuilder'; // Нужен для генерации таблицы и правил
import { Lexer } from 'src2/lexer';
import { EOF_SYMBOL } from 'src2/types';

describe('SLRTableParser', () => {
    // Простая грамматика: S -> id
    const simpleGrammar = [
        `<S> -> id`
    ];

    let tableBuilder: SLRTableBuilder;
    let parser: SLRTableParser;
    let lexer: Lexer;

    beforeAll(() => { // Генерируем таблицу один раз для всех тестов в этом describe
        tableBuilder = new SLRTableBuilder(simpleGrammar);
        console.log(tableBuilder)
        lexer = new Lexer();
    });

    test('should parse a simple valid input: "testId $" ', () => {
        const tokens = lexer.tokenize(`testId`); // Lexer добавит EOF
        parser = new SLRTableParser(tokens, tableBuilder.buildTable(), tableBuilder.rules);
        
        const ast = parser.parse();
        
        // Ожидаемая структура AST для S -> id (зависит от вашей логики построения AST)
        // Например, если S' -> S $, S -> id. Тогда после свертки id в S, и S в S'
        // AST может быть { type: "S'", children: [{ type: "S", value: "testId" }] }
        // Или если вы берете actionName (здесь нет), то иначе.
        // Адаптируйте под свою логику.
        expect(ast).not.toBeNull();
        if (ast) { // type guard
             expect(ast.type).toBe('S\''); // Из дополненного правила S' -> S $
             expect(ast.children).toHaveLength(1);
             if (ast.children && ast.children[0]) {
                 const sNode = ast.children[0];
                 expect(sNode.type).toBe('S'); // Из правила S -> id
                 // Если правило S->id создает узел S со значением id:
                 // expect(sNode.value).toBe('testId'); 
                 // Если S->id создает узел S с потомком Ident:
                 expect(sNode.children).toBeUndefined();
             }
        }
    });

    test('should throw error for invalid input: "123 $" ', () => {
        const tokens = lexer.tokenize(`123`);
        parser = new SLRTableParser(tokens, tableBuilder.buildTable(), tableBuilder.rules);
        expect(() => parser.parse()).toThrowError(/Нет перехода из состояния .* по символу 'num'/);
    });

    // Грамматика для теста эпсилон: S -> A $, A -> ε
    const epsilonGrammar = [
        `<S> -> <A> ${EOF_SYMBOL}`,
        `<A> -> ` // Эпсилон
    ];

    test('should parse grammar with epsilon production', () => {
        const epsilonTableBuilder = new SLRTableBuilder(epsilonGrammar);
        const tokens = lexer.tokenize(``); // Пустая строка
        const epsilonParser = new SLRTableParser(tokens, epsilonTableBuilder.buildTable(), epsilonTableBuilder.rules);
        const ast = epsilonParser.parse();
        expect(ast).not.toBeNull();
        if (ast) {
            expect(ast.type).toBe('S\'');
            expect(ast.children).toHaveLength(1);
            if (ast.children && ast.children[0]) {
                expect(ast.children[0].type).toBe('A'); // Узел для A -> ε
                expect(ast.children[0].children).toBeUndefined(); // или .toHaveLength(0)
            }
        }
    });


    // Добавьте более сложные тесты для вашей реальной грамматики
    // Например, для арифметических выражений:
    const arithGrammar = [
        `<E> -> <E> + <T> ${EOF_SYMBOL} ~Expr`, // Добавим EOF для простоты теста одного выражения
        `<E> -> <T> ~Expr`,
        `<T> -> id ~Term`,
    ];
    // ... тесты для arithGrammar ...
    // Это потребует более умного построения AST в парсере.
});