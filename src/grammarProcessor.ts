export function parseRule(ruleString: string): { lhs: string; rhsSymbols: string[]; action?: string } {
    const actionSeparator = "~"
    let productionPart = ruleString
    let actionPart: string | undefined = undefined

    const actionIndex = ruleString.indexOf(actionSeparator)
    if (actionIndex !== -1) {
        productionPart = ruleString.substring(0, actionIndex).trim()
        actionPart = ruleString.substring(actionIndex).trim()
    }

    const [lhs, rhsString] = productionPart.split('->').map(s => s.trim())
    const rhsSymbols = rhsString ? rhsString.split(/\s+/).filter(s => s.length > 0) : []
    return { lhs, rhsSymbols, action: actionPart }
}

export function formatRule(lhs: string, rhsSymbols: string[], action?: string): string {
    let rule = `${lhs} -> ${rhsSymbols.join(' ')}`
    if (action) {
        rule += `${rhsSymbols.length > 0 ? " " : ""}${action}`
    }
    return rule
}

export function isNonTerminal(symbol: string): boolean {
    if (symbol.startsWith('<') && symbol.endsWith('>')) {
        return true
    }
    return /^[A-Z]+$/.test(symbol)
}


export function removeEpsilonRulesFromGrammar(grammarWithActions: string[]): string[] {
    const originalParsedRules = grammarWithActions.map(parseRule)
    const nullable = new Set<string>()

    let changedInNullableIteration = true
    while (changedInNullableIteration) {
        changedInNullableIteration = false
        for (const rule of originalParsedRules) {
            if (nullable.has(rule.lhs)) {
                continue
            }

            if (rule.rhsSymbols.length === 0 ||
                (rule.rhsSymbols.length === 1 && (rule.rhsSymbols[0].toLowerCase() === 'e' || rule.rhsSymbols[0].toLowerCase() === 'epsilon'))) {
                if (!nullable.has(rule.lhs)) {
                    nullable.add(rule.lhs)
                    changedInNullableIteration = true
                }
            } else {
                const allRhsSymbolsAreNullableNonTerminals =
                    rule.rhsSymbols.length > 0 &&
                    rule.rhsSymbols.every(sym => isNonTerminal(sym) && nullable.has(sym))

                if (allRhsSymbolsAreNullableNonTerminals) {
                    if (!nullable.has(rule.lhs)) {
                        nullable.add(rule.lhs)
                        changedInNullableIteration = true
                    }
                }
            }
        }
    }

    const newProductionsSet = new Set<string>()
    for (const rule of originalParsedRules) {
        const { lhs, rhsSymbols, action } = rule

        if (rule.rhsSymbols.length === 0 ||
            (rule.rhsSymbols.length === 1 && (rule.rhsSymbols[0].toLowerCase() === 'e' || rule.rhsSymbols[0].toLowerCase() === 'epsilon'))) {
            continue
        }

        const indicesOfNullableSymbolsInRhs = rhsSymbols
            .map((symbol, index) => (isNonTerminal(symbol) && nullable.has(symbol) ? index : -1))
            .filter(index => index !== -1)

        const numCombinations = 1 << indicesOfNullableSymbolsInRhs.length

        for (let i = 0; i < numCombinations; i++) {
            const currentNewRhs: string[] = []
            let nullableSymbolPointer = 0

            for (let j = 0; j < rhsSymbols.length; j++) {
                if (indicesOfNullableSymbolsInRhs.includes(j)) { 
                    if (!((i >> nullableSymbolPointer) & 1)) {
                        currentNewRhs.push(rhsSymbols[j])
                    }
                    nullableSymbolPointer++
                } else {
                    currentNewRhs.push(rhsSymbols[j])
                }
            }

            if (currentNewRhs.length > 0) {
                newProductionsSet.add(formatRule(lhs, currentNewRhs, action))
            }
        }
    }
    return Array.from(newProductionsSet)
} 