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

function cleanSymbolName(symbol: string): string {
    return symbol.replace(/[<>]/g, '')
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

    // Создание начального состояния Z
    table['Z'] = {}

    const zRule = rules.find(r => r.left === '<Z>')
    if (zRule) {
        const firstSymbol = zRule.right[0]
        const subRules = symbolToRules[firstSymbol]
        if (subRules?.length) {
            const stateName = `${cleanSymbolName(firstSymbol)}01`
            table['Z'][firstSymbol] = [stateName]

            if (subRules[0].right[0] === 'e') {
                if (!table['Z']['#']) table['Z']['#'] = []
                table['Z']['#'].push(`R${subRules[0].ruleIndex}`)
            }
        }
    }

    // Свертка по пустым правилам
    for (const rule of rules) {
        if (rule.left === '<S>' && rule.right[0] === 'e') {
            if (!table['Z']['#']) table['Z']['#'] = []
            table['Z']['#'].push(`R${rule.ruleIndex}`)
        }
    }

    // Сгенерировать состояния
    for (const rule of rules) {
        const right = rule.right
        for (let i = 0; i < right.length; i++) {
            const symbol = right[i]
            states.push({
                name: `${cleanSymbolName(symbol)}${rule.ruleIndex}${i + 1}`,
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
        const nextStateName = `${cleanSymbolName(nextSymbol)}${ruleIndex}${position + 1}`

        // Явный переход
        if (!table[name][nextSymbol]) table[name][nextSymbol] = []
        table[name][nextSymbol].push(nextStateName)

        // Подстановка только если нетерминал
        if (isNonTerminal(nextSymbol)) {
            const subRules = symbolToRules[nextSymbol]
            for (const subRule of subRules) {
                const subFirst = subRule.right[0]
                if (subFirst === 'e') {
                    if (!table[name]['#']) table[name]['#'] = []
                    table[name]['#'].push(`R${subRule.ruleIndex}`)
                } else {
                    const subState = `${cleanSymbolName(subFirst)}${subRule.ruleIndex}1`
                    if (!table[name][subFirst]) table[name][subFirst] = []
                    table[name][subFirst].push(subState)
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