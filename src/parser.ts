import {Grammar, TransitionTable} from '@common/types'
import {Stack} from '@common/stack'
import {SYMBOL_START} from '@common/consts'

/** Простейшее сравнение двух массивов на полное совпадение */
function arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

/**
 * Сдвиг-свёрточный парсер по SLR(1)-таблице
 * @param input — входная строка (терминалы, например 'aabb')
 *                Эндмаркер '#' добавится автоматически
 * @param table — SLR(1)-таблица переходов
 * @param grammar — список правил вида {left: string, right: string[]}
 */
function parseTable(
    input: string,
    table: TransitionTable,
    grammar: Grammar
): void {
    // 1) инициализация
    const inputQueue = input.split('').concat('#')     // входная очередь, '#' — маркер конца
    const symbolStack = new Stack<string>()                // стек терминалов/нетерминалов
    const stateStack = new Stack<string>()                 // стек состояний
    stateStack.push(SYMBOL_START)                                        // Z — стартовое состояние

    while (inputQueue.length > 0) {
        // ==== 2) SHIFT/GOTO ====
        const a = inputQueue.shift()!                             // снимаем символ из входа
        symbolStack.push(a)                                              // кладём его в стек символов

        const curState = stateStack.peek()!
        const action = table[curState]?.[a]
        if (!action || action.length === 0) {
            throw new Error(`Нет перехода из состояния '${curState}' по символу '${a}'`)
        }
        // shift (терминал) или goto (нетерминал) — одно и то же: массив состояний
        // перевод из вида ['a21', 'a42'] в вид состояния 'a21 a42'
        stateStack.push(action.join(' '))

        // ==== 3) REDUCE ====
        // После каждого shift пытаемся свернуть, пока возможно
        console.log({symbolStack, stateStack})
        let reduced: boolean
        do {
            reduced = false

            // пробегаем по всем правилам грамматики
            for (const { left, right } of grammar) {
                const stackArr = symbolStack.toArray()
                const n = right.length

                // проверяем, хватает ли символов и совпадает ли хвост
                if (n > 0 &&
                    stackArr.length >= n &&
                    arraysEqual(stackArr.slice(-n), right)
                ) {
                    if (left === SYMBOL_START) {
                        return
                    }

                    // выполняем редукцию:
                    // 1) выталкиваем из обоих стеков по |right| элементов
                    for (let k = 0; k < n; k++) {
                        symbolStack.pop()
                        stateStack.pop()
                    }
                    // 2) помещаем нетерминал left обратно в начало входной очереди
                    inputQueue.unshift(left)

                    reduced = true
                    break  // после редукции начинаем сканировать правила заново
                }
            }
        } while (reduced)
        console.log(inputQueue)
    }

    // ==== 4) завершение ====
    // Успех, если стек символов пуст и в стеке состояний только начальное Z
    if (!symbolStack.isEmpty() ||
        stateStack.size() !== 1 ||
        stateStack.peek() !== SYMBOL_START
    ) {
        throw new Error('Таблица неверно составлена: недоделанные символы/состояния')
    }
}

export {
    parseTable,
}