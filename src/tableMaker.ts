import {GrammarRule, State, TransitionTable} from '@common/types'
//import {SEPARATOR_SPACED_FALLOW, SYMBOL_END} from '@common/consts'

const SEPARATOR_SPACED_FALLOW = ' -> '
const SYMBOL_END = '#'


// Парсинг грамматики
function parseGrammar(raw: string[]): GrammarRule[] {
    return raw.map((rule, index) => {
        const [left, right] = rule.split(SEPARATOR_SPACED_FALLOW)
        return { left, right: right.split(''), ruleIndex: index }
    })
}

// Получение всех символов (нетерминалы + терминалы)
function extractSymbols(rules: GrammarRule[]): Set<string> {
    const symbols = new Set<string>()
    for (const { left, right } of rules) {
        symbols.add(left)
        for (const ch of right) {
            if (ch !== SYMBOL_END) symbols.add(ch)
        }
    }
    return symbols
}

// Генерация всех состояний из правых частей правил
function generateStates(rules: GrammarRule[]): State[] {
    const states: State[] = []
    for (const { right, ruleIndex } of rules) {
        for (let i = 0; i < right.length; i++) {
            const symbol = right[i]
            states.push({
                name: `${symbol}${ruleIndex}${i + 1}`,
                symbol,
                ruleIndex,
                position: i + 1
            })
        }
    }
    return states
}

// Генерация таблицы переходов
function buildTransitionTable(rules: GrammarRule[]): TransitionTable {
    const table: TransitionTable = {}
    const symbols = Array.from(extractSymbols(rules))
    const states = generateStates(rules)

    // Стартовое состояние Z
    table['Z'] = {}
    for (const state of states) {
        const rule = rules[state.ruleIndex]
        if (rule.left === 'S') {
            if (!table['Z'][state.symbol]) table['Z'][state.symbol] = []
            table['Z'][state.symbol].push(state.name)
        }
    }
    table['Z'][''] = ['R0'] // Свертка по пустому символу

    // Остальные состояния
    for (const state of states) {
        table[state.name] = {}
        const rule = rules[state.ruleIndex]
        const nextPos = state.position
        const nextSymbol = rule.right[nextPos]
        if (nextSymbol) {
            const nextState = states.find(s => s.ruleIndex === state.ruleIndex && s.position === nextPos + 1)
            if (nextState) {
                if (!table[state.name][nextSymbol]) table[state.name][nextSymbol] = []
                table[state.name][nextSymbol].push(nextState.name)
            }
        } else {
            table[state.name][''] = [`R${state.ruleIndex}`]
        }
    }

    return table
}

export {
    parseGrammar,
    buildTransitionTable,
}