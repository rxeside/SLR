import {buildTransitionTable, parseGrammar} from '@src/tableMaker'
import {parseTable} from '@src/parser'
import {TransitionTable} from '@common/types'
import {Lexer} from '@src/lexer'

const main = () => {
    const rawGrammar12 = [
        'Z -> S#',
        '<Exp> -> <Exp> <Rel> <simexp>',
        '<Exp> -> <simexp>',
        '<simexp> -> <simexp> <PLUSO> <simtre>',
        'S -> Sc',
        'S -> c'
    ];

    const rawGrammar = [
        '<Z> -> <S> #',
        '<S> -> a <S> b',
        '<S> -> a b',
        '<S> -> <S> c',
        '<S> -> c'
    ]

    const grammar = parseGrammar(rawGrammar);
    const transitionTable = buildTransitionTable(grammar);
    console.log(transitionTable)

    const testTable: TransitionTable = {
        "Z": {
            "Z": ["ok"],
            "S": ["S01", "S31"],
            "a": ["a11", "a21"],
            "b": [],
            "c": ["c41"],
            "#": []
        },
        "S01 S31": {
            "Z": [],
            "S": [],
            "a": [],
            "b": [],
            "c": ["c32"],
            "#": ["#02"]
        },
        "#02": {
            "Z": [],
            "S": ["R0"],
            "a": ["R0"],
            "b": ["R0"],
            "c": ["R0"],
            "#": ["R0"]
        },
        "a11 a21": {
            "Z": [],
            "S": ["S12", "S31"],
            "a": ["a11", "a21"],
            "b": ["b22"],
            "c": ["c41"],
            "#": []
        },
        "c41": {
            "Z": [],
            "S": [],
            "a": [],
            "b": ["R4"],
            "c": ["R4"],
            "#": ["R4"]
        },
        "c32": {
            "Z": [],
            "S": [],
            "a": [],
            "b": ["R3"],
            "c": ["R3"],
            "#": ["R3"]
        },
        "S12 S31": {
            "Z": [],
            "S": [],
            "a": [],
            "b": ["b13"],
            "c": ["c32"],
            "#": []
        },
        "b22": {
            "Z": [],
            "S": [],
            "a": [],
            "b": ["R2"],
            "c": ["R2"],
            "#": ["R2"]
        },
        "b13": {
            "Z": [],
            "S": [],
            "a": [],
            "b": ["R1"],
            "c": ["R1"],
            "#": ["R1"]
        }
    };

    try {
        const lexer = new Lexer()
        const input = 'a c b'

        const tokens = lexer.tokenize(input)
        parseTable(tokens, testTable, grammar)
        console.log('Разбор успешно завершён!')
    } catch (error) {
        console.log(error)
    }
}

if (require.main === module) {
    main()
}