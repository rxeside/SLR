import { GrammarRule, State, TransitionTable } from '@common/types';
import {SEPARATOR_SPACED_FALLOW, SYMBOL_END} from "@common/consts";

type FollowSets = Record<string, Set<string>>;
type FirstSets = Record<string, Set<string>>;

class SLRTableBuilder {
    private rules: GrammarRule[];
    private nonTerminals: Set<string>;
    private startSymbol: string;
    private firstSets: FirstSets;
    private followSets: FollowSets;
    private symbolToRules: Record<string, GrammarRule[]>;
    private table: TransitionTable;

    constructor(rawGrammar: string[]) {
        this.rules = this._parseGrammar(rawGrammar);
        this.nonTerminals = new Set(this.rules.map(r => r.left));
        this.startSymbol = this.rules[0]?.left || '<Z>'; // Default start symbol
        this.firstSets = this._calculateFirstSets();
        this.followSets = this._calculateFollowSets();
        this.symbolToRules = this._mapSymbolsToRules();
        this.table = {}; // Initialize an empty table
    }

    public buildTable(): TransitionTable {
        console.log("Parsed Rules (with actions):", this.rules);
        console.log("First Sets:", this.firstSets);
        console.log("Follow Sets:", this.followSets);

        this._initializeShiftTransitions();
        this._mergeStatesAndAddReduceActions();
        this._finalizeReduceActions();

        // Обработка ε-правил (оставлена как заглушка, так как исходная грамматика их не содержит
        // и полная реализация требует LR(0) замыканий)
        this._handleEpsilonRuleReductions();


        return this.table;
    }

    private _isNonTerminal(symbol: string): boolean {
        return /^<.*>$/.test(symbol);
    }

    private _parseGrammar(raw: string[]): GrammarRule[] {
        return raw.map((rule, index) => {
            const [left, rightPart] = rule.split(SEPARATOR_SPACED_FALLOW);
            const leftSymbol = left.trim();
            let rightSymbols = rightPart.trim().split(/\s+/).filter(s => s !== '');
            let semanticAction: string | undefined = undefined;

            if (rightSymbols.length > 0 && rightSymbols[rightSymbols.length - 1].startsWith('~')) {
                const actionToken = rightSymbols.pop();
                if (actionToken) {
                    semanticAction = actionToken.substring(1);
                }
            }
            return {
                left: leftSymbol,
                right: rightSymbols,
                ruleIndex: index,
                semanticAction: semanticAction,
            };
        });
    }

    private _calculateFirstSets(): FirstSets {
        const firstSets: FirstSets = {};
        this.nonTerminals.forEach(nt => firstSets[nt] = new Set());
        let changed = true;

        while (changed) {
            changed = false;
            for (const rule of this.rules) {
                const left = rule.left;
                const right = rule.right;
                let canBeEmpty = true;

                for (const symbol of right) {
                    if (this._isNonTerminal(symbol)) {
                        const currentFirst = firstSets[symbol];
                        const oldSize = firstSets[left].size;
                        currentFirst.forEach(f => {
                            if (f !== 'e') firstSets[left].add(f);
                        });
                        if (firstSets[left].size > oldSize) changed = true;
                        if (!currentFirst.has('e')) {
                            canBeEmpty = false;
                            break;
                        }
                    } else {
                        const oldSize = firstSets[left].size;
                        firstSets[left].add(symbol);
                        if (firstSets[left].size > oldSize) changed = true;
                        canBeEmpty = false;
                        break;
                    }
                }
                // if (canBeEmpty && rule.right.length === 0) { // Only if rule is A -> e
                //     const oldSize = firstSets[left].size;
                //     firstSets[left].add('e');
                //     if (firstSets[left].size > oldSize) changed = true;
                // }
            }
        }
        return firstSets;
    }

    private _getFirstForSequence(sequence: string[]): Set<string> {
        const result = new Set<string>();
        let canBeEmpty = true;
        for (const symbol of sequence) {
            if (this._isNonTerminal(symbol)) {
                const currentFirst = this.firstSets[symbol];
                currentFirst.forEach(f => {
                    if (f !== 'e') result.add(f);
                });
                if (!currentFirst.has('e')) {
                    canBeEmpty = false;
                    break;
                }
            } else {
                result.add(symbol);
                canBeEmpty = false;
                break;
            }
        }
        // if (canBeEmpty) result.add('e');
        return result;
    }

    private _calculateFollowSets(): FollowSets {
        const followSets: FollowSets = {};
        this.nonTerminals.forEach(nt => followSets[nt] = new Set());

        if (followSets[this.startSymbol]) {
            followSets[this.startSymbol].add(SYMBOL_END);
        } else {
            console.warn(`Start symbol ${this.startSymbol} not found in non-terminals for FOLLOW set init.`);
        }

        let changed = true;
        while (changed) {
            changed = false;
            for (const rule of this.rules) {
                const left = rule.left;
                const right = rule.right;

                for (let i = 0; i < right.length; i++) {
                    const symbolB = right[i];
                    if (!this._isNonTerminal(symbolB)) continue;

                    const sequenceAfterB = right.slice(i + 1);
                    const firstOfSequence = this._getFirstForSequence(sequenceAfterB);

                    const oldSizeB = followSets[symbolB].size;
                    firstOfSequence.forEach(f => {
                        if (f !== 'e') followSets[symbolB].add(f);
                    });
                    if (followSets[symbolB].size > oldSizeB) changed = true;

                    if (sequenceAfterB.length === 0 || firstOfSequence.has('e')) {
                        const followA = followSets[left];
                        const oldSizeB_ = followSets[symbolB].size;
                        followA.forEach(f => followSets[symbolB].add(f));
                        if (followSets[symbolB].size > oldSizeB_) changed = true;
                    }
                }
            }
        }
        return followSets;
    }

    private _mapSymbolsToRules(): Record<string, GrammarRule[]> {
        const map: Record<string, GrammarRule[]> = {};
        for (const rule of this.rules) {
            if (!map[rule.left]) {
                map[rule.left] = [];
            }
            map[rule.left].push(rule);
        }
        return map;
    }

    private _addFirstTransitions(symbol: string, fromState: string, visited = new Set<string>()): void {
        if (!this._isNonTerminal(symbol) || visited.has(symbol)) return;
        visited.add(symbol);

        const subRules = this.symbolToRules[symbol];
        if (!subRules) return;

        if (!this.table[fromState]) this.table[fromState] = {};

        for (const subRule of subRules) {
            if (subRule.right.length > 0) {
                const first = subRule.right[0];
                const subStateName = `${first}${subRule.ruleIndex}1`;

                if (!this.table[fromState][first]) this.table[fromState][first] = [];
                if (!this.table[fromState][first].includes(subStateName)) {
                    this.table[fromState][first].push(subStateName);
                }
                if (this._isNonTerminal(first)) {
                    this._addFirstTransitions(first, fromState, new Set(visited));
                }
            }
            // Epsilon rules (subRule.right.length === 0) don't add shift transitions here
        }
    }

    private _initializeShiftTransitions(): void {
        const initialStates: State[] = [];
        for (const rule of this.rules) {
            for (let i = 0; i < rule.right.length; i++) {
                const symbol = rule.right[i];
                initialStates.push({
                    name: `${symbol}${rule.ruleIndex}${i + 1}`,
                    symbol,
                    ruleIndex: rule.ruleIndex,
                    position: i + 1,
                });
            }
        }

        this.table[this.startSymbol] = {};
        const zRule = this.rules.find(r => r.left === this.startSymbol);
        if (zRule && zRule.right.length > 0) {
            const firstSymbol = zRule.right[0];
            const sState = `${firstSymbol}${zRule.ruleIndex}1`;
            if (!this.table[this.startSymbol][firstSymbol]) this.table[this.startSymbol][firstSymbol] = [];
            this.table[this.startSymbol][firstSymbol].push(sState);
            this._addFirstTransitions(firstSymbol, this.startSymbol, new Set());
        } else if (zRule && zRule.right.length === 0) {
            console.warn(`Handle start rule like Z -> ε or Z -> # if needed for direct reduction from start state.`);
        }


        for (const state of initialStates) {
            const { name, ruleIndex, position } = state;
            const rule = this.rules[ruleIndex];

            if (!this.table[name]) this.table[name] = {};

            if (position < rule.right.length) {
                const nextSymbol = rule.right[position];
                const nextStateName = `${nextSymbol}${rule.ruleIndex}${position + 1}`;
                if (!this.table[name][nextSymbol]) this.table[name][nextSymbol] = [];
                if (!this.table[name][nextSymbol].includes(nextStateName)) {
                    this.table[name][nextSymbol].push(nextStateName);
                }
                if (this._isNonTerminal(nextSymbol)) {
                    this._addFirstTransitions(nextSymbol, name, new Set());
                }
            }
        }
    }

    private _mergeStatesAndAddReduceActions(): void {
        let somethingMerged = true;
        while (somethingMerged) {
            somethingMerged = false;
            const mergeMap = new Map<string, string[]>();

            for (const stateName in this.table) {
                const transitions = this.table[stateName];
                for (const symbol in transitions) {
                    const targets = transitions[symbol];
                    if (targets.length > 1 && targets.every(t => !t.startsWith('R'))) {
                        const sortedTargets = [...targets].sort();
                        const mergedKey = sortedTargets.join(' ');
                        if (!mergeMap.has(mergedKey)) {
                            mergeMap.set(mergedKey, sortedTargets);
                        }
                        transitions[symbol] = [mergedKey];
                    }
                }
            }

            if (mergeMap.size === 0) break;
            somethingMerged = true;

            const mergedStatesData: TransitionTable = {};
            const statesToDelete = new Set<string>();

            for (const [mergedKey, targets] of mergeMap.entries()) {
                targets.forEach(t => statesToDelete.add(t));
                if (mergedStatesData[mergedKey]) continue;

                mergedStatesData[mergedKey] = {};
                const newTransitions = mergedStatesData[mergedKey];

                for (const targetStateName of targets) {
                    if (!this.table[targetStateName]) continue;

                    const sourceTransitions = this.table[targetStateName];
                    for (const symbol in sourceTransitions) {
                        const actions = sourceTransitions[symbol];
                        if (!newTransitions[symbol]) newTransitions[symbol] = [];
                        for (const action of actions) {
                            if (!newTransitions[symbol].includes(action)) {
                                newTransitions[symbol].push(action);
                            }
                        }
                    }

                    const match = targetStateName.match(/^(.+)(\d+)(\d+)$/);
                    if (match) {
                        const ruleIndex = parseInt(match[2], 10);
                        const position = parseInt(match[3], 10);
                        if (ruleIndex >= 0 && ruleIndex < this.rules.length) {
                            const originalRule = this.rules[ruleIndex];
                            if (position === originalRule.right.length) {
                                const leftSymbol = originalRule.left;
                                const follow = this.followSets[leftSymbol];
                                let reduceAction = `R${originalRule.ruleIndex}`;
                                if (originalRule.semanticAction) {
                                    reduceAction += `~${originalRule.semanticAction}`;
                                }

                                follow.forEach(followSymbol => {
                                    if (!newTransitions[followSymbol]) newTransitions[followSymbol] = [];
                                    if (!newTransitions[followSymbol].includes(reduceAction)) {
                                        if (newTransitions[followSymbol].length > 0) {
                                            const existingAction = newTransitions[followSymbol][0];
                                            if (!existingAction.startsWith('R') && existingAction !== reduceAction) {
                                                console.error(`КОНФЛИКТ Shift/Reduce в состоянии ${mergedKey} по символу ${followSymbol}: Обнаружен Shift ${existingAction}, попытка добавить Reduce ${reduceAction} из состояния ${targetStateName}`);
                                            } else if (existingAction.startsWith('R') && existingAction !== reduceAction) {
                                                console.error(`КОНФЛИКТ Reduce/Reduce в состоянии ${mergedKey} по символу ${followSymbol}: Обнаружен ${existingAction}, попытка добавить ${reduceAction} из состояния ${targetStateName}`);
                                            }
                                        }
                                        // Add Reduce only if no Shift action exists or no other Reduce action
                                        if (!newTransitions[followSymbol].some(a => !a.startsWith('R'))) {
                                            if (!newTransitions[followSymbol].includes(reduceAction)){
                                                newTransitions[followSymbol].push(reduceAction);
                                            }
                                        }
                                    }
                                });
                            }
                        } else {
                            console.warn(`Invalid ruleIndex ${ruleIndex} parsed from state name ${targetStateName}`);
                        }
                    }
                }
            }
            statesToDelete.forEach(stateName => delete this.table[stateName]);
            Object.assign(this.table, mergedStatesData);
        }
    }

    // В классе SLRTableGenerator
    private _finalizeReduceActions(): void {
        // Create a deep copy to iterate over original keys while modifying the copy
        const tableCopy = JSON.parse(JSON.stringify(this.table));
        const finalTable: TransitionTable = this.table;

        for (const stateName in tableCopy) {
            // Проверяем, что имя состояния НЕ является результатом слияния (т.е. не содержит пробелов)
            // и соответствует формату symbol<ruleIndex><position>
            if (stateName.includes(' ')) { // Это слитое состояние, его Reduce-действия уже должны быть установлены
                continue;
            }

            const match = stateName.match(/^(.+?)(\d+)(\d+)$/); // Non-greedy match for symbol
            if (match) {
                const ruleIndex = parseInt(match[2], 10);
                const position = parseInt(match[3], 10);

                // Добавляем проверку на NaN для ruleIndex и position, чтобы избежать дальнейших ошибок
                if (isNaN(ruleIndex) || isNaN(position)) {
                    // Это может произойти, если имя состояния не соответствует ожидаемому формату,
                    // но прошло проверку на отсутствие пробелов. Например, если имя символа содержит цифры в конце.
                    // console.warn(`Could not parse ruleIndex/position from state name: ${stateName}`);
                    continue;
                }

                if (ruleIndex < 0 || ruleIndex >= this.rules.length) {
                    console.warn(`Invalid ruleIndex ${ruleIndex} parsed from state name ${stateName} in final processing loop.`);
                    continue;
                }
                const rule = this.rules[ruleIndex];

                if (position === rule.right.length) {
                    const leftSymbol = rule.left;
                    const follow = this.followSets[leftSymbol];
                    let reduceAction = `R${rule.ruleIndex}`;
                    if (rule.semanticAction) {
                        reduceAction += `~${rule.semanticAction}`;
                    }

                    if (!finalTable[stateName]) finalTable[stateName] = {};

                    follow.forEach(followSymbol => {
                        if (!finalTable[stateName][followSymbol]) finalTable[stateName][followSymbol] = [];

                        let addAction = true;
                        if (finalTable[stateName][followSymbol].includes(reduceAction)) {
                            addAction = false;
                        } else if (finalTable[stateName][followSymbol].length > 0) {
                            const existingAction = finalTable[stateName][followSymbol][0];
                            if (!existingAction.startsWith('R')) {
                                // console.error(`КОНФЛИКТ Shift/Reduce в состоянии ${stateName} по символу ${followSymbol}: Обнаружен Shift ${existingAction}, попытка добавить Reduce ${reduceAction}. Предпочитаем Shift.`);
                                addAction = false;
                            } else if (existingAction.startsWith('R') && existingAction !== reduceAction) {
                                // console.error(`КОНФЛИКТ Reduce/Reduce в состоянии ${stateName} по символу ${followSymbol}: Обнаружен ${existingAction}, попытка добавить ${reduceAction}. Оставляем первый (${existingAction}).`);
                                addAction = false;
                            }
                        }
                        if (addAction) {
                            finalTable[stateName][followSymbol].push(reduceAction);
                        }
                    });
                }
            }
            // else {
            // Если stateName не содержит пробел и не матчится, это может быть стартовый символ типа '<Z>'
            // или другие специальные имена состояний, которые не являются "завершающими" в смысле symbol<index><pos>.
            // Для таких состояний Reduce-действия обычно не добавляются на этом этапе.
            // }
        }
    }

    private _handleEpsilonRuleReductions(): void {
        // This method is a placeholder.
        // Correctly handling epsilon rule reductions in SLR requires integrating LR(0) item set
        // construction and closure operations, which is a significant change to the current
        // state naming and table construction logic.
        // The current grammar example does not use epsilon rules, so this part is not critical for it.
        this.rules.forEach((rule) => {
            if (rule.right.length === 0) { // This is an ε-rule
                // const leftNt = rule.left;
                // const followOfLeft = this.followSets[leftNt];
                // let reduceAction = `R${rule.ruleIndex}`;
                // if (rule.semanticAction) {
                //     reduceAction += `~${rule.semanticAction}`;
                // }
                // For each state in finalTable and for each symbol in followOfLeft:
                //   If the state "expects" leftNt (difficult to determine without LR(0) items),
                //   add reduceAction, handling conflicts.
                // console.log(`Epsilon rule ${rule.left} -> ε found. Advanced handling needed for SLR.`);
            }
        });
    }
}

// Парсинг грамматики (с изменениями для поддержки семантических действий)
function parseGrammar(raw: string[]): GrammarRule[] {
    return raw.map((rule, index) => {
        const [left, rightPart] = rule.split(SEPARATOR_SPACED_FALLOW);
        const leftSymbol = left.trim();
// Убираем пустые строки, если есть, и разделяем по пробелам
        let rightSymbols = rightPart.trim().split(/\s+/).filter(s => s !== '');
        let semanticAction: string | undefined = undefined;
// Проверяем, есть ли семантическое действие в конце правила
        if (rightSymbols.length > 0 && rightSymbols[rightSymbols.length - 1].startsWith('~')) {
            const actionToken = rightSymbols.pop(); // Извлекаем токен действия
            if (actionToken) { // TypeScript null check
                semanticAction = actionToken.substring(1); // Удаляем тильду
            }
        }

        // Обработка пустого правила 'e' (если нужно, сейчас грамматика его не содержит)
        // if (rightSymbols.length === 1 && rightSymbols[0] === 'e') {
        //     rightSymbols = []; // Представляем эпсилон как пустой массив
        // }

        return {
            left: leftSymbol,
            right: rightSymbols, // rightSymbols теперь не содержит токен действия
            ruleIndex: index,
            semanticAction: semanticAction, // Сохраняем действие
        };
    });
}

export {
    SLRTableBuilder,
    parseGrammar,
};
