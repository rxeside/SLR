import {FirstSets, FollowSets, GrammarRule} from '@common/types'

function computeFollowSets(grammar: GrammarRule[], firstSets: FirstSets): FollowSets {
    const follow: FollowSets = new Map();
    const nonTerminals = new Set<string>();

    for (const rule of grammar) {
        nonTerminals.add(rule.left);
    }

    for (const nt of nonTerminals) {
        follow.set(nt, new Set());
    }

    // Предполагаем, что стартовый символ — левый символ первого правила
    const startSymbol = grammar[0].left;
    follow.get(startSymbol)!.add('#'); // маркер конца ввода

    let changed = true;

    while (changed) {
        changed = false;

        for (const rule of grammar) {
            const leftFollow = follow.get(rule.left)!;

            for (let i = 0; i < rule.right.length; i++) {
                const symbol = rule.right[i];
                if (!symbol.startsWith('<')) continue;
                const symbolFollow = follow.get(symbol)!;

                let trailer = new Set<string>();

                for (let j = i + 1; j < rule.right.length; j++) {
                    const nextSymbol = rule.right[j];

                    if (!nextSymbol.startsWith('<')) {
                        trailer.add(nextSymbol);
                        break;
                    } else {
                        const nextFirst = firstSets.get(nextSymbol)!;
                        trailer = new Set([...trailer, ...nextFirst]);
                        break; // ε не рассматриваем
                    }
                }

                if (trailer.size === 0) {
                    for (const f of leftFollow) {
                        if (!symbolFollow.has(f)) {
                            symbolFollow.add(f);
                            changed = true;
                        }
                    }
                } else {
                    for (const t of trailer) {
                        if (!symbolFollow.has(t)) {
                            symbolFollow.add(t);
                            changed = true;
                        }
                    }
                }
            }
        }
    }

    return follow;
}

export {
    computeFollowSets,
}