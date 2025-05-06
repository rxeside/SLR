import {FirstSets, GrammarRule} from '@common/types'

function computeFirstSets(grammar: GrammarRule[]): FirstSets {
    const first: FirstSets = new Map();

    const terminals = new Set<string>();
    const nonTerminals = new Set<string>();

    for (const rule of grammar) {
        nonTerminals.add(rule.left);
        for (const symbol of rule.right) {
            if (!symbol.startsWith('<')) {
                terminals.add(symbol);
            }
        }
    }

    // Initialize FIRST sets
    for (const nt of nonTerminals) {
        first.set(nt, new Set());
    }

    let changed = true;

    while (changed) {
        changed = false;
        for (const rule of grammar) {
            const leftFirst = first.get(rule.left)!;

            for (let i = 0; i < rule.right.length; i++) {
                const symbol = rule.right[i];

                if (!symbol.startsWith('<')) {
                    if (!leftFirst.has(symbol)) {
                        leftFirst.add(symbol);
                        changed = true;
                    }
                    break;
                } else {
                    const symbolFirst = first.get(symbol)!;
                    const beforeSize = leftFirst.size;
                    for (const s of symbolFirst) {
                        leftFirst.add(s);
                    }
                    if (leftFirst.size > beforeSize) {
                        changed = true;
                    }
                    break; // мы не рассматриваем ε-продукции здесь
                }
            }
        }
    }

    return first;
}

export {
    computeFirstSets,
}
