import {SLRTableGenerator, parseGrammar} from '@src/transitionTable/generator'
import {Parser} from '@src/transitionTable/parser'
import {Lexer} from '@src/lexer/lexer'

const main = () => {
/*    const rawGrammar = [
        '<Z> -> <S> #',
        '<S> -> a <S> b',
        '<S> -> a b',
        '<S> -> <S> c',
        '<S> -> c'
    ]
    */
    const rawGrammarWithAction = [
        '<Z> -> <S> #',
        '<S> -> <S> + <T> ~act_plus', // действие для сложения
        '<S> -> <T>',
        '<T> -> <T> * <F> ~act_mul',  // действие для умножения
        '<T> -> <F>',
        '<F> -> - <F> ~act_neg',     // действие для унарного минуса
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


    const generator = new SLRTableGenerator(rawGrammarWithAction);

    const transitionTable = generator.buildTable();
    console.log(transitionTable)

    try {
        const lexer = new Lexer()
        //const input = '( a )'
        const input = '- ( bombardiro + crocodilo ) * ( 4 + - 6 ) + cucarecu + id'
        //const input = '( a )'
        //const input = '( a , b )'
        //const input = 'begin d ; s end'
        //const input = '0 1'
        //const input = 'a b c'

        const tokens = lexer.tokenize(input)
        const grammar = parseGrammar(rawGrammarWithAction);
        const parser = new Parser(tokens, transitionTable, grammar);
        parser.parse()
        console.log("Разбор успешно завершён!")
    } catch (error) {
        console.log(error)
    }
}

if (require.main === module) {
    main()
}