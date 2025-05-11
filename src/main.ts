import {buildTransitionTable, parseGrammar} from '@src/tableMaker'
import {Parser} from '@src/parser'
import {TransitionTable} from '@common/types'
import {Lexer} from '@src/lexer'

const main = () => {
    /*const rawGrammar = [
        'Z -> S #',
        'S -> a S b',
        'S -> a b',
        'S -> S c',
        'S -> c'
    ];*/

    /*const rawGrammar = [
        '<Z> -> <S> #',
        '<S> -> a <S> b',
        '<S> -> a b',
        '<S> -> <S> c',
        '<S> -> c'
    ]*/

    const rawGrammar = [
        '<Z> -> <S> #',
        '<S> -> ( )',
        '<S> -> ( <S> <B> )',
        '<S> -> ( <S> )',
        '<S> -> <A>',
        '<B> -> <S> <B>',
        '<A> -> a',
        '<A> -> b'
    ]


    const grammar = parseGrammar(rawGrammar);
    console.log({gr: grammar[0]!.right})
    const transitionTable = buildTransitionTable(grammar);
    console.log(transitionTable)

        const testTable: TransitionTable = {
        "<Z>": {
            "<Z>": ["ok"],
            "<S>": ["<S>01", "<S>31"],
            "a": ["a11", "a21"],
            "c": ["c41"],
        },
        "<S>01 <S>31": {
            "c": ["c32"],
            "#": ["#02"]
        },
        "#02": {
            "<S>": ["R0"],
            "a": ["R0"],
            "b": ["R0"],
            "c": ["R0"],
            "#": ["R0"]
        },
        "a11 a21": {
            "<S>": ["<S>12", "<S>31"],
            "a": ["a11", "a21"],
            "b": ["b22"],
            "c": ["c41"],
        },
        "c41": {
            "b": ["R4"],
            "c": ["R4"],
            "#": ["R4"]
        },
        "c32": {
            "b": ["R3"],
            "c": ["R3"],
            "#": ["R3"]
        },
        "<S>12 <S>31": {
            "b": ["b13"],
            "c": ["c32"],
        },
        "b22": {
            "b": ["R2"],
            "c": ["R2"],
            "#": ["R2"]
        },
        "b13": {
            "b": ["R1"],
            "c": ["R1"],
            "#": ["R1"]
        }
    };

    try {
        const lexer = new Lexer()
        const input = '( a )'

        const tokens = lexer.tokenize(input)
        const parser = new Parser(tokens, transitionTable, grammar)
        parser.parse()
        console.log("Разбор успешно завершён!")
    } catch (error) {
        console.log(error)
    }
}

if (require.main === module) {
    main()
}