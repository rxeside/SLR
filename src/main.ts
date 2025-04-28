import {buildTransitionTable, parseGrammar} from '@src/tableMaker'
import {parseTable} from '@src/parser'
import {Grammar, TransitionTable} from '@common/types'

const main = () => {
    // const rawGrammar = [
    //     'Z->S#',
    //     'S->aSb',
    //     'S->ab',
    //     'S->Sc',
    //     'S->c'
    // ];
    //
    // const grammar = parseGrammar(rawGrammar);
    // const transitionTable = buildTransitionTable(grammar);
    // console.log(JSON.stringify(transitionTable, null, 2));

    const testTable: TransitionTable = {
        "Z": {
            "Z": ["ok"],
            "S": ["S11", "S41"],
            "a": ["a21", "a31"],
            "b": [],
            "c": ["c51"],
            "#": ["#12"]
        },
        "S11 S41": {
            "Z": [],
            "S": [],
            "a": [],
            "b": [],
            "c": ["c42"],
            "#": ["#12"]
        },
        "#12": {
            "Z": [],
            "S": ["R1"],
            "a": ["R1"],
            "b": ["R1"],
            "c": ["R1"],
            "#": ["R1"]
        },
        "a21 a31": {
            "Z": [],
            "S": ["S22", "S41"],
            "a": ["a21", "a31"],
            "b": ["b32"],
            "c": ["c51"],
            "#": []
        },
        "c51": {
            "Z": [],
            "S": [],
            "a": [],
            "b": [],
            "c": ["R5"],
            "#": ["R5"]
        },
        "c42": {
            "Z": [],
            "S": [],
            "a": [],
            "b": [],
            "c": ["R4"],
            "#": ["R4"]
        },
        "S22 S41": {
            "Z": [],
            "S": [],
            "a": [],
            "b": ["b23"],
            "c": ["c42"],
            "#": []
        },
        "b32": {
            "Z": [],
            "S": [],
            "a": [],
            "b": [],
            "c": ["R3"],
            "#": ["R3"]
        },
        "b23": {
            "Z": [],
            "S": [],
            "a": [],
            "b": [],
            "c": ["R2"],
            "#": ["R2"]
        }
    };

    const testGrammar: Grammar = [
        {
            left: 'Z',
            right: ['S', '#'],
        },
        {
            left: 'S',
            right: ['a', 'S', 'b'],
        },
        {
            left: 'S',
            right: ['a', 'b'],
        },
        {
            left: 'S',
            right: ['S', 'c'],
        },
        {
            left: 'S',
            right: ['c'],
        },
    ]

    try {
        parseTable('a c b', testTable, testGrammar)
        console.log('Разбор успешно завершён!')
    } catch (error) {
        console.log('Ошибка: ', error)
    }
}

if (require.main === module) {
    main()
}