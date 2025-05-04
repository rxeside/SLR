import {GrammarRule, Token, TransitionTable} from '@common/types'
import {Stack} from '@common/stack'
import {STATE_START} from '@common/consts'
import {arraysEqual} from '@common/utils'

/**
 * Сдвиг-свёрточный парсер по SLR(1)-таблице
 * @param tokens — массив токенов, заканчивается Lexeme.GRID ('#')
 * @param table — SLR(1)-таблица переходов
 * @param grammar — список правил вида {left: string, right: string[]}
 */
function parseTable(
    tokens: Token[],
    table: TransitionTable,
    grammar: GrammarRule[],
): void {
    const inputQueue: string[] = tokens.map(token => token.lexeme)
    const symbolStack = new Stack<string>()
    const stateStack = new Stack<string>()
    stateStack.push(STATE_START)

    while (inputQueue.length > 0) {
        // ==== SHIFT/GOTO ====
        const currToken = inputQueue.shift()!
        symbolStack.push(currToken)

        const curState = stateStack.peek()!
        const action = table[curState]?.[currToken]
        if (!action || action.length === 0) {
            throw new Error(`Нет перехода из состояния '${curState}' по токену '${currToken}'`)
        }
        // перевод из вида ['a21', 'a42'] в вид состояния 'a21 a42'
        stateStack.push(action.join(' '))

        // ==== REDUCE ====
        // После каждого shift пытаемся свернуть, пока возможно
        let reduced: boolean
        do {
            reduced = false

            // пробегаем по всем правилам грамматики
            for (const {left, right} of grammar) {
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
                    inputQueue.unshift(left)

                    if (left === STATE_START) {
                        console.log({inputQueue})
                        return
                    }

                    reduced = true
                    // после редукции начинаем сканировать правила заново
                    break
                }
            }
        } while (reduced)
    }

    // ==== 4) завершение ====
    // Успех, если стек символов пуст и в стеке состояний только начальное Z
    if (!symbolStack.isEmpty() ||
        stateStack.size() !== 1 ||
        stateStack.peek() !== STATE_START
    ) {
        throw new Error('Таблица неверно составлена: недоделанные символы/состояния')
    }
}

export {
    parseTable,
}