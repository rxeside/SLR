import {SLRTableBuilder, parseGrammar} from '@src/transitionTable/builder'
import {SLRTableParser} from '@src/transitionTable/parser'
import {Lexer} from '@src/lexer/lexer'
import {ErrorReporter} from "@src/errors/ErrorReporter";
import {CompilerError} from "@src/errors/CompilerError";
import {ErrorCode} from "@src/errors/errorCodes";

const main = () => {
/*    const rawGrammar = [
        '<Z> -> <S> #',
        '<S> -> a <S> b',
        '<S> -> a b',
        '<S> -> <S> c',
        '<S> -> c'
    ]
    */
    const rawGrammar = [
        '<Z> -> <S> #',
        '<S> -> <S> + <T> ~BinaryExpr', // действие для сложения
        '<S> -> <T>',
        '<T> -> <T> * <F> ~BinaryExpr',  // действие для умножения
        '<T> -> <F>',
        '<F> -> - <F> ~UnaryExpr',     // действие для унарного минуса
        '<F> -> ( <S> )',
        '<F> -> id ~act_id',         // действие для идентификатора
        '<F> -> num ~act_num',       // действие для числа
    ];

    // const rawGrammar = [
    //     '<Z> -> <S> #',
    //     '<S> -> ( )',
    //     '<S> -> ( <S> <B> )',
    //     '<S> -> ( <S> )',
    //     '<S> -> <A>',
    //     '<B> -> * <S> <B>',
    //     '<B> -> * <S>',
    //     '<A> -> a',
    //     '<A> -> b'
    // ]

    // const rawGrammar = [
    //     '<Z> -> <S> #',
    //     '<S> -> ( )',
    //     '<S> -> ( <S> <B> )',
    //     '<S> -> ( <S> )',
    //     '<S> -> <A>',
    //     '<B> -> , <S> <B>',
    //     '<B> -> , <S>',
    //     '<A> -> a',
    //     '<A> -> b'
    // ]
    // const rawGrammar = [
    //     '<Z> -> <PROG> #',
    //     '<PROG> -> id id ; <X> id',
    //     '<X> -> id ; <X>',
    //     '<X> -> id <Y>',
    //     '<X> -> id',
    //     '<Y> -> ; id <Y>',
    //     '<Y> -> ; id'
    // ]
    // const rawGrammar = [
    //     '<Z> -> <A> #',
    //     '<Z> -> #',
    //     '<A> -> num <A>',
    //     '<A> -> num',
    //     '<A> -> num <A>',
    //     '<A> -> num',
    //     '<A> -> num <A>',
    //     '<A> -> num'
    // ]
    // const rawGrammar = [
    //     '<Z> -> <S> #',
    //     '<S> -> <A> <B> <C>',
    //     '<S> -> <B> <C>',
    //     '<S> -> <A> <C>',
    //     '<S> -> <A> <B>',
    //     '<A> -> <A> id',
    //     '<A> -> id',
    //     '<B> -> id <B>',
    //     '<B> -> id',
    //     '<C> -> <C> id',
    //     '<C> -> id'
    // ]

    // const rawGrammar = [
    //     '<Z> -> <S> # ~Program',
    //     '<S> -> <T> + <T> ~BinaryExpr',
    //     '<T> -> id ~Ident'
    // ];

    const errorReporter = new ErrorReporter();

    try {
        const builder = new SLRTableBuilder(rawGrammar);

        const transitionTable = builder.buildTable();
        console.log(transitionTable)
        //const input = '( a )'
        const input = '- ( bombardiro + crocodilo ) * ( 4 + - 6 ) cucarecu + id'
        //const input = '( a )'
        //const input = '( a , b )'
        //const input = 'begin d ; s end'
        //const input = '0 1'
        // const input = 'a b c'
        //const input = 'a + b'
        const grammar = parseGrammar(rawGrammar);

        const lexer = new Lexer()
        const tokens = lexer.tokenize(input)

        const parser = new SLRTableParser(tokens, transitionTable, grammar);
        parser.parse()
    } catch (error) {
        //console.log(error)
        if (error instanceof CompilerError) {
            errorReporter.report(error);
        }
        // else if (error instanceof Error) {
        //     // Для других неожиданных ошибок
        //     errorReporter.report(new CompilerError(ErrorCode.GENERAL_UNEXPECTED_ERROR, { message: error.message }));
        // }
        // else {
        //     // Совсем неизвестная ошибка
        //     errorReporter.report(new CompilerError(ErrorCode.GENERAL_UNEXPECTED_ERROR, { message: 'Произошла неизвестная ошибка.' }));
        // }
    } finally {
        if (errorReporter.hasErrors()) {
            console.log("\nКомпиляция завершилась с ошибками.");
            // errorReporter.printCollectedErrors(); // Можно вывести все собранные ошибки в конце
        } else {
            // Этот блок выполнится, только если не было выброшено исключение из try
            // или если исключение было поймано и обработано без re-throw.
            // Если parse() успешен, сообщение "Разбор успешно завершен!" выводится изнутри парсера.
            // Но если была ошибка билдера, то сюда мы попадем.
            if (!errorReporter.hasErrors()) { // Дополнительная проверка, т.к. parse() мог завершиться без ошибок
                console.log("Компиляция успешно завершена!");
            }
        }
    }
}

if (require.main === module) {
    main()
}