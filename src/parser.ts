import {GrammarRule, Token, TransitionTable} from '@common/types'
import {Stack} from '@common/stack'
import {STATE_REDUCE, STATE_START, SYMBOL_END} from '@common/consts'
import {arrayEqual} from '@common/utils'

type StackItem = {
    symbol: string,
    state: string,
}

/**
 * Сдвиг-свёрточный парсер по SLR(1)-таблице
 * @param tokens — массив токенов, заканчивается Lexeme.GRID ('#')
 * @param table — SLR(1)-таблица переходов
 * @param grammar — список правил вида {left: string, right: string[], ruleIndex: number}
 */
function parseTable(
    tokens: Token[],
    table: TransitionTable,
    grammar: GrammarRule[],
): void {
    const inputQueue: string[] = tokens.map(token => token.lexeme)
    inputQueue.push(SYMBOL_END)
    const stack = new Stack<StackItem>()
    stack.push({symbol: STATE_START, state: STATE_START})

    let isEnd: boolean = false
    while (inputQueue.length > 0 && !isEnd) {
        // ==== SHIFT/GOTO ====
        const currToken = inputQueue.shift()!
        const curState = stack.peek()!.state
        const action = table[curState]?.[currToken]
        if (!action || action.length === 0) {
            throw new Error(`Нет перехода из состояния '${curState}' по токену '${currToken}'`)
        }

        // ==== REDUCE ====
        const maybeSymbolReduce = action[0]!
        if (maybeSymbolReduce[0] !== STATE_REDUCE) {
            stack.push({symbol: currToken, state: action.join(' ')})
            continue
        }
        let ruleForReduce: GrammarRule
        const reduceGrammarIndex = maybeSymbolReduce[1]
        try {
            ruleForReduce = grammar[reduceGrammarIndex]
        } catch (error) {
            throw new Error(`Нет правила с индексом ${reduceGrammarIndex}`)
        }
        const {left, right} = ruleForReduce
        const stackSymbolArr: string[] = stack.toArray().map(item => item.symbol)
        const n = right.length

        if (n <= 0 ||
            stackSymbolArr.length < n ||
            !arrayEqual(stackSymbolArr.slice(-n), right)
        ) {
            throw new Error('Таблица неверно составлена: стек неправильно заполняется')
        }

        for (let k = 0; k < n; k++) {
            stack.pop()
        }
        inputQueue.unshift(currToken)
        inputQueue.unshift(left)

        if (left === STATE_START) {
            isEnd = true
        }
    }

    if (stack.isEmpty() ||
        stack.toArray().length !== 1 ||
        stack.toArray().map(item => item.symbol).join('') !== STATE_START ||
        stack.toArray().map(item => item.state).join('') !== STATE_START ||
        !arrayEqual(inputQueue, [STATE_START, SYMBOL_END])
    ) {
        throw new Error('Таблица неверно составлена: недоделанные символы/состояния')
    }
}

export {
    parseTable,
}