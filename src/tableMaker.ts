import {GrammarRule, State, TransitionTable} from '@common/types'
//import {SEPARATOR_SPACED_FALLOW, SYMBOL_END} from '@common/consts'

const SEPARATOR_SPACED_FALLOW = ' -> '
const SYMBOL_END = '#'


// Парсинг грамматики
function parseGrammar(raw: string[]): GrammarRule[] {
    return raw.map((rule, index) => {
        const [left, right] = rule.split(SEPARATOR_SPACED_FALLOW)

        const leftSymbol = left.trim()
        const rightSymbols = right.trim().split(/\s+/) // разделяем по пробелам

        return {
            left: leftSymbol,
            right: rightSymbols,
            ruleIndex: index,
        }
    })
}

// Генерация таблицы переходов
function isNonTerminal(symbol: string): boolean {
    return /^<.*>$/.test(symbol)
}

function buildTransitionTable(rules: GrammarRule[]): TransitionTable {
    const table: TransitionTable = {}
    const states: State[] = []
    const nonTerminals = new Set(rules.map(r => r.left))
    const symbolToRules: Record<string, GrammarRule[]> = {}

    // Индексация правил по левому символу
    for (const rule of rules) {
        if (!symbolToRules[rule.left]) {
            symbolToRules[rule.left] = []
        }
        symbolToRules[rule.left].push(rule)
    }

    // Создание начального состояния "<Z>"
    const startState = "<Z>"
    table[startState] = {}

    const zRule = rules.find(r => r.left === '<Z>')
    if (zRule) {
        const firstSymbol = zRule.right[0]

        if (!table[startState][firstSymbol]) table[startState][firstSymbol] = []

        // Добавляем переход по самому <S>
        const sState = `${firstSymbol}01`
        table[startState][firstSymbol].push(sState)

        // Рекурсивно добавим переходы по всем первым символам правил для <S>
        const subRules = symbolToRules[firstSymbol]
        if (subRules?.length) {
            for (const subRule of subRules) {
                const firstInSub = subRule.right[0]
                if (firstInSub === 'e') {
                    if (!table[startState]['#']) table[startState]['#'] = []
                    table[startState]['#'].push(`R${subRule.ruleIndex}`)
                } else {
                    const target = `${firstInSub}${subRule.ruleIndex}1`
                    if (!table[startState][firstInSub]) table[startState][firstInSub] = []
                    table[startState][firstInSub].push(target)
                }
            }
        }

        // Переход по самому <Z> → ok (можно удалить, если не нужен)
        table[startState][startState] = ['ok']
    }

    // Свертка по пустым правилам
    for (const rule of rules) {
        if (rule.right.length === 1 && rule.right[0] === 'e') {
            if (!table[startState]['#']) table[startState]['#'] = []
            table[startState]['#'].push(`R${rule.ruleIndex}`)
        }
    }

    // Сгенерировать состояния
    for (const rule of rules) {
        const right = rule.right
        for (let i = 0; i < right.length; i++) {
            const symbol = right[i]
            states.push({
                name: `${symbol}${rule.ruleIndex}${i + 1}`,
                symbol,
                ruleIndex: rule.ruleIndex,
                position: i + 1,
            })
        }
    }

    // Построение переходов
    for (const state of states) {
        const { name, ruleIndex, position } = state
        const rule = rules[ruleIndex]
        table[name] = {}

        if (position >= rule.right.length) {
            table[name]['#'] = [`R${ruleIndex}`]
            continue
        }

        const nextSymbol = rule.right[position]
        const nextStateName = `${nextSymbol}${ruleIndex}${position + 1}`

        if (!table[name][nextSymbol]) table[name][nextSymbol] = []
        table[name][nextSymbol].push(nextStateName)

        if (isNonTerminal(nextSymbol)) {
            const subRules = symbolToRules[nextSymbol]
            for (const subRule of subRules) {
                const subFirst = subRule.right[0]
                if (subFirst === 'e') {
                    if (!table[name]['#']) table[name]['#'] = []
                    table[name]['#'].push(`R${subRule.ruleIndex}`)
                } else {
                    const subState = `${subFirst}${subRule.ruleIndex}1`
                    if (!table[name][subFirst]) table[name][subFirst] = []
                    table[name][subFirst].push(subState)
                }
            }
        }
    }

    // Объединение состояний (если требуется)
    const mergedStates: TransitionTable = {}
    const processed = new Set<string>()

    for (const [state, transitions] of Object.entries(table)) {
        for (const [symbol, targets] of Object.entries(transitions)) {
            if (targets.length > 1 && targets.every(t => table[t])) {
                const mergedKey = targets.join(' ')
                if (!mergedStates[mergedKey]) {
                    mergedStates[mergedKey] = {}
                }

                for (const target of targets) {
                    const subTransitions = table[target]
                    for (const [subSymbol, subTargets] of Object.entries(subTransitions)) {
                        if (!mergedStates[mergedKey][subSymbol]) {
                            mergedStates[mergedKey][subSymbol] = []
                        }
                        mergedStates[mergedKey][subSymbol].push(...subTargets)
                    }
                }

                for (const key of Object.keys(mergedStates[mergedKey])) {
                    mergedStates[mergedKey][key] = [...new Set(mergedStates[mergedKey][key])]
                }

                targets.forEach(t => processed.add(t))
            }
        }
    }

    for (const [mergedKey, value] of Object.entries(mergedStates)) {
        table[mergedKey] = value
    }

    for (const key of processed) {
        delete table[key]
    }

    // Дополнительная свёртка: если символ последний в правиле,
// то добавляем свёртки по символам, идущим после соответствующего нетерминала в других правилах
    for (const rule of rules) {
        const right = rule.right
        const lastSymbol = right[right.length - 1]

        if (!isNonTerminal(rule.left)) continue // левый должен быть нетерминалом
        if (!lastSymbol) continue

        const targetState = `${lastSymbol}${rule.ruleIndex}${right.length}`

        for (const otherRule of rules) {
            const r = otherRule.right

            for (let i = 0; i < r.length - 1; i++) {
                if (r[i] === rule.left) {
                    const followSymbol = r[i + 1]

                    if (!table[targetState]) {
                        table[targetState] = {}
                    }
                    if (!table[targetState][followSymbol]) {
                        table[targetState][followSymbol] = []
                    }

                    table[targetState][followSymbol].push(`R${rule.ruleIndex}`)
                }
            }
        }
    }


    return table
}



export {
    parseGrammar,
    buildTransitionTable,
}