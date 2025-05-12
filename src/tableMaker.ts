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

        // Рекурсивно добавить все возможные первые терминальные переходы
        addFirstTransitions(firstSymbol, startState, table, symbolToRules, isNonTerminal)
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
// Рекурсивная функция для добавления переходов по первым символам
    function addFirstTransitions(
        symbol: string,
        fromState: string,
        table: TransitionTable,
        symbolToRules: Record<string, GrammarRule[]>,
        isNonTerminal: (s: string) => boolean,
        visited = new Set<string>()
    ) {
        if (!isNonTerminal(symbol) || visited.has(symbol)) return;
        visited.add(symbol);

        const subRules = symbolToRules[symbol];
        if (!subRules) return;

        for (const subRule of subRules) {
            const first = subRule.right[0];
            if (first === "e") {
                if (!table[fromState]["#"]) table[fromState]["#"] = [];
                table[fromState]["#"].push(`R${subRule.ruleIndex}`);
            } else if (isNonTerminal(first)) {
                // Добавляем переход в промежуточное состояние для нетерминала
                const subState = `${first}${subRule.ruleIndex}1`;
                if (!table[fromState][first]) table[fromState][first] = [];
                table[fromState][first].push(subState);
                addFirstTransitions(first, fromState, table, symbolToRules, isNonTerminal, visited);
            } else {
                const subState = `${first}${subRule.ruleIndex}1`;
                if (!table[fromState][first]) table[fromState][first] = [];
                table[fromState][first].push(subState);
            }
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
            addFirstTransitions(nextSymbol, name, table, symbolToRules, isNonTerminal)
        }
    }

    // Построение переходов
    /*for (const state of states) {
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
    }*/

    let somethingMerged = true

    while (somethingMerged) {
        somethingMerged = false
        const mergeMap = new Map<string, string[]>()

        for (const transitions of Object.values(table)) {
            for (const targets of Object.values(transitions)) {
                if (targets.length > 1 && targets.every(t => table[t])) {
                    const mergedKey = targets.join(' ')
                    if (!mergeMap.has(mergedKey)) {
                        mergeMap.set(mergedKey, targets)
                        somethingMerged = true
                    }
                }
            }
        }

        const mergedStates: TransitionTable = {}
        const processed = new Set<string>()

        for (const [mergedKey, targets] of mergeMap.entries()) {
            if (!mergedStates[mergedKey]) mergedStates[mergedKey] = {}

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

        for (const [mergedKey, value] of Object.entries(mergedStates)) {
            table[mergedKey] = value
        }

        for (const key of processed) {
            delete table[key]
        }
    }



    function getFirstSymbols(symbol: string, rules: GrammarRule[], visited = new Set()): string[] {
        if (!isNonTerminal(symbol)) return [symbol]
        if (visited.has(symbol)) return []

        visited.add(symbol)
        const firstSymbols: Set<string> = new Set()

        for (const rule of rules) {
            if (rule.left === symbol && rule.right.length > 0) {
                const first = rule.right[0]
                const nestedFirsts = getFirstSymbols(first, rules, visited)
                for (const f of nestedFirsts) {
                    firstSymbols.add(f)
                }
            }
        }

        return Array.from(firstSymbols)
    }

    function getFollowSymbolsRecursive(symbol: string, rules: GrammarRule[], visited = new Set()): string[] {
        if (visited.has(symbol)) return []

        visited.add(symbol)
        const followSymbols: Set<string> = new Set()

        for (const rule of rules) {
            const right = rule.right

            for (let i = 0; i < right.length; i++) {
                if (right[i] === symbol) {
                    const next = right[i + 1]
                    if (next) {
                        // Следующий символ существует, добавим его first-множество
                        const nextFirsts = getFirstSymbols(next, rules)
                        nextFirsts.forEach(s => followSymbols.add(s))
                    } else {
                        // Это последний символ — ищем, где rule.left используется
                        const nestedFollows = getFollowSymbolsRecursive(rule.left, rules, visited)
                        nestedFollows.forEach(s => followSymbols.add(s))
                    }
                }
            }
        }

        return Array.from(followSymbols)
    }


    // Дополнительная свёртка: если символ последний в правиле,
// то добавляем свёртки по символам, идущим после соответствующего нетерминала в других правилах
    for (const rule of rules) {
        const right = rule.right
        const lastSymbol = right[right.length - 1]

        if (!isNonTerminal(rule.left)) continue
        if (!lastSymbol) continue

        const targetState = `${lastSymbol}${rule.ruleIndex}${right.length}`

        // Найдём все follow-символы, которые могут идти после rule.left (с рекурсией)
        const symbolsToAdd = getFollowSymbolsRecursive(rule.left, rules)

        for (const sym of symbolsToAdd) {
            if (!table[targetState]) {
                table[targetState] = {}
            }
            if (!table[targetState][sym]) {
                table[targetState][sym] = []
            }

            table[targetState][sym].push(`R${rule.ruleIndex}`)
        }
    }



    return table
}



export {
    parseGrammar,
    buildTransitionTable,
}