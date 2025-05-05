import {GrammarRule, Token, TransitionTable} from '@common/types'
import {Stack} from '@common/stack'
import {STATE_REDUCE, STATE_START, SYMBOL_END} from '@common/consts'
import {arraysEqual} from '@common/utils'

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
    const symbolStack = new Stack<string>()
    const stateStack = new Stack<string>()
    stateStack.push(STATE_START)

    let isEnd: boolean = false
    while (inputQueue.length > 0 && !isEnd) {
        // ==== SHIFT/GOTO ====
        const currToken = inputQueue.shift()!
        const curState = stateStack.peek()!
        const action = table[curState]?.[currToken]
        if (!action || action.length === 0) {
            throw new Error(`Нет перехода из состояния '${curState}' по токену '${currToken}'`)
        }

        // ==== REDUCE ====
        const maybeSymbolReduce = action[0]!
        if (maybeSymbolReduce[0] !== STATE_REDUCE) {
            symbolStack.push(currToken)
            // перевод из вида ['a21', 'a42'] в вид состояния 'a21 a42'
            stateStack.push(action.join(' '))
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
        const stackArr = symbolStack.toArray()
        const n = right.length

        // проверяем, хватает ли символов и совпадает ли хвост
        if (n > 0 &&
            stackArr.length >= n &&
            arraysEqual(stackArr.slice(-n), right)
        ) {
            // выполняем редукцию:
            // 1) выталкиваем из обоих стеков по длине |right| элементов
            for (let k = 0; k < n; k++) {
                symbolStack.pop()
                stateStack.pop()
            }
            // 2) помещаем нетерминал left в начало входной очереди
            inputQueue.unshift(currToken)
            inputQueue.unshift(left)

            if (left === STATE_START) {
                isEnd = true
            }
        }
    }

    // ==== 4) завершение ====
    // Успех, если стек символов пуст и в стеке состояний только начальное Z
    if (!symbolStack.isEmpty() ||
        stateStack.size() !== 1 ||
        stateStack.peek() !== STATE_START ||
        !arraysEqual(inputQueue, [STATE_START, SYMBOL_END])
    ) {
        throw new Error('Таблица неверно составлена: недоделанные символы/состояния')
    }
}

export {
    parseTable,
}