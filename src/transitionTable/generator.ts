import { GrammarRule, State, TransitionTable } from '@common/types'; // Предполагаем, что типы определены и GrammarRule имеет поле semanticAction?

const SEPARATOR_SPACED_FALLOW = ' -> ';
const SYMBOL_END = '#'; // Используем константу

// Тип для хранения FOLLOW-множеств
type FollowSets = Record<string, Set<string>>;

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

function isNonTerminal(symbol: string): boolean {
    return /^<.*>$/.test(symbol);
}

// --- Функции для вычисления FIRST и FOLLOW (без изменений) ---

// Вычисляет FIRST-множества для всех нетерминалов
function calculateFirstSets(rules: GrammarRule[], nonTerminals: Set<string>): Record<string, Set<string>> {
    const firstSets: Record<string, Set<string>> = {};
    nonTerminals.forEach(nt => firstSets[nt] = new Set());
    let changed = true;

    while (changed) {
        changed = false;
        for (const rule of rules) {
            const left = rule.left;
            const right = rule.right; // right уже не содержит семантического действия
            let canBeEmpty = true;

            for (const symbol of right) {
                if (isNonTerminal(symbol)) {
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
                } else { // Терминал
                    const oldSize = firstSets[left].size;
                    firstSets[left].add(symbol);
                    if (firstSets[left].size > oldSize) changed = true;
                    canBeEmpty = false;
                    break;
                }
            }
            // if (canBeEmpty) { // Если нужно обрабатывать 'e'
            //     const oldSize = firstSets[left].size;
            //     firstSets[left].add('e');
            //     if (firstSets[left].size > oldSize) changed = true;
            // }
        }
    }
    return firstSets;
}

// Вычисляет FIRST для последовательности символов
function getFirstForSequence(sequence: string[], firstSets: Record<string, Set<string>>): Set<string> {
    const result = new Set<string>();
    let canBeEmpty = true;
    for (const symbol of sequence) {
        if (isNonTerminal(symbol)) {
            const currentFirst = firstSets[symbol];
            currentFirst.forEach(f => {
                if (f !== 'e') result.add(f);
            });
            if (!currentFirst.has('e')) {
                canBeEmpty = false;
                break;
            }
        } else { // Терминал
            result.add(symbol);
            canBeEmpty = false;
            break;
        }
    }
    // if (canBeEmpty) result.add('e'); // Если нужно обрабатывать 'e'
    return result;
}


// Вычисляет FOLLOW-множества для всех нетерминалов
function calculateFollowSets(rules: GrammarRule[], nonTerminals: Set<string>, firstSets: Record<string, Set<string>>, startSymbol: string): FollowSets {
    const followSets: FollowSets = {};
    nonTerminals.forEach(nt => followSets[nt] = new Set());

    if (followSets[startSymbol]) {
        followSets[startSymbol].add(SYMBOL_END);
    } else {
        console.warn(`Start symbol ${startSymbol} not found in non-terminals for FOLLOW set init.`);
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (const rule of rules) {
            const left = rule.left;
            const right = rule.right; // right уже не содержит семантического действия

            for (let i = 0; i < right.length; i++) {
                const symbolB = right[i];
                if (!isNonTerminal(symbolB)) continue;

                const sequenceAfterB = right.slice(i + 1);
                const firstOfSequence = getFirstForSequence(sequenceAfterB, firstSets);

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


// --- Построение таблицы ---

function buildTransitionTable(rules: GrammarRule[]): TransitionTable {
    const table: TransitionTable = {};
    const nonTerminals = new Set(rules.map(r => r.left));
    const startSymbol = rules[0]?.left || '<Z>';
    const firstSets = calculateFirstSets(rules, nonTerminals);
    const followSets = calculateFollowSets(rules, nonTerminals, firstSets, startSymbol);

    console.log("Parsed Rules (with actions):", rules); // Для отладки, чтобы видеть действия
    console.log("First Sets:", firstSets);
    console.log("Follow Sets:", followSets);

    const symbolToRules: Record<string, GrammarRule[]> = {};
    for (const rule of rules) {
        if (!symbolToRules[rule.left]) {
            symbolToRules[rule.left] = [];
        }
        symbolToRules[rule.left].push(rule);
    }

    const initialStates: State[] = [];
    for (const rule of rules) {
        const right = rule.right; // right уже не содержит семантического действия
        for (let i = 0; i < right.length; i++) {
            const symbol = right[i];
            initialStates.push({
                name: `${symbol}${rule.ruleIndex}${i + 1}`,
                symbol,
                ruleIndex: rule.ruleIndex,
                position: i + 1,
            });
        }
    }

    function addFirstTransitions(
        symbol: string,
        fromState: string,
        currentTable: TransitionTable,
        visited = new Set<string>()
    ) {
        if (!isNonTerminal(symbol) || visited.has(symbol)) return;
        visited.add(symbol);

        const subRules = symbolToRules[symbol];
        if (!subRules) return;

        if (!currentTable[fromState]) currentTable[fromState] = {};

        for (const subRule of subRules) {
            if (subRule.right.length === 0) { // A -> ε (возможно с действием)
                // Свёртка по эпсилон-правилу. Действие будет добавлено позже при обработке завершающих состояний.
                // На этом этапе мы только строим переходы по символам.
                // Для SLR, если A -> ε ~action, то в ячейки [X, f] где X - состояние, f ∈ FOLLOW(A)
                // будет R<индекс правила A->ε>~action
                // Это будет обработано в циклах слияния и финальной обработке.
            } else {
                const first = subRule.right[0];
                const subStateName = `${first}${subRule.ruleIndex}1`;

                if (!currentTable[fromState][first]) currentTable[fromState][first] = [];
                if (!currentTable[fromState][first].includes(subStateName)) {
                    currentTable[fromState][first].push(subStateName);
                }
                if (isNonTerminal(first)) {
                    addFirstTransitions(first, fromState, currentTable, new Set(visited));
                }
            }
        }
    }

    table[startSymbol] = {};
    const zRule = rules.find(r => r.left === startSymbol);
    if (zRule && zRule.right.length > 0) {
        const firstSymbol = zRule.right[0];
        const sState = `${firstSymbol}${zRule.ruleIndex}1`;
        if (!table[startSymbol][firstSymbol]) table[startSymbol][firstSymbol] = [];
        table[startSymbol][firstSymbol].push(sState);
        addFirstTransitions(firstSymbol, startSymbol, table, new Set());
    } else if (zRule) { // Z -> ε (возможно с действием) или Z -> #
        // Если Z -> ε ~action, то при обработке завершающих состояний
        // в [startSymbol, #] (т.к. FOLLOW(Z)={#}) добавится R<индекс Z->ε>~action.
        // Если Z -> #, то это обычный переход.
        // Сейчас предполагаем, что стартовое правило не пустое слева от #.
        if (zRule.right.length === 0 && zRule.left === startSymbol) {
            // Это ситуация типа <Z> -> #, где # может быть конечным маркером,
            // или <Z> -> ε ~action #.
            // Если <Z> -> ε #, то это равносильно <Z'> -> <Z> #, <Z> -> ε.
            // Если <Z> -> # (и # терминал), то это переход.
            // Логика свёрток для пустых правил обрабатывается ниже.
            console.warn(`Handle start rule like Z -> ε or Z -> # (if # is terminal) if needed for direct reduction from start state.`);
        }
    }

    for (const state of initialStates) {
        const { name, ruleIndex, position } = state;
        const rule = rules[ruleIndex];

        if (!table[name]) table[name] = {};

        if (position < rule.right.length) {
            const nextSymbol = rule.right[position];
            const nextStateName = `${nextSymbol}${rule.ruleIndex}${position + 1}`;
            if (!table[name][nextSymbol]) table[name][nextSymbol] = [];
            if (!table[name][nextSymbol].includes(nextStateName)) {
                table[name][nextSymbol].push(nextStateName);
            }
            if (isNonTerminal(nextSymbol)) {
                addFirstTransitions(nextSymbol, name, table, new Set());
            }
        }
        // Действия свёртки (Reduce) будут добавлены позже
    }

    let somethingMerged = true;
    while (somethingMerged) {
        somethingMerged = false;
        const mergeMap = new Map<string, string[]>();

        for (const stateName in table) {
            const transitions = table[stateName];
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
                if (!table[targetStateName]) continue;

                const sourceTransitions = table[targetStateName];
                for (const symbol in sourceTransitions) {
                    const actions = sourceTransitions[symbol];
                    if (!newTransitions[symbol]) newTransitions[symbol] = [];
                    for (const action of actions) {
                        if (!newTransitions[symbol].includes(action)) {
                            newTransitions[symbol].push(action);
                        }
                    }
                }

                // Проверка на завершающее состояние для добавления Reduce
                const match = targetStateName.match(/^(.+)(\d+)(\d+)$/);
                if (match) {
                    const ruleIndex = parseInt(match[2], 10);
                    const position = parseInt(match[3], 10);
                    if (ruleIndex >= 0 && ruleIndex < rules.length) {
                        const originalRule = rules[ruleIndex];
                        // Проверяем, является ли это концом правила ИЛИ правило пустое (A -> ε)
                        // Для пустого правила position будет 0, right.length будет 0.
                        // Но initialStates создаются только для непустых правых частей.
                        // Поэтому здесь position === originalRule.right.length достаточно.
                        if (position === originalRule.right.length) {
                            const leftSymbol = originalRule.left;
                            const follow = followSets[leftSymbol];

                            // Формируем строку Reduce с учетом семантического действия
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
        statesToDelete.forEach(stateName => delete table[stateName]);
        Object.assign(table, mergedStatesData);
    }

    // Финальная обработка: Добавляем свёртки для не слитых завершающих состояний
    const finalTable: TransitionTable = JSON.parse(JSON.stringify(table));

    // Этот цикл для состояний, которые ЯВЛЯЮТСЯ концом непустого правила
    for (const stateName in table) {
        const match = stateName.match(/^(.+?)(\d+)(\d+)$/); // Non-greedy match for symbol
        if (match) {
            const ruleIndex = parseInt(match[2], 10);
            const position = parseInt(match[3], 10);

            if (ruleIndex < 0 || ruleIndex >= rules.length) {
                console.warn(`Invalid ruleIndex ${ruleIndex} parsed from state name ${stateName} in final processing loop.`);
                continue;
            }
            const rule = rules[ruleIndex];

            if (position === rule.right.length) { // Завершающее состояние для непустого правила
                const leftSymbol = rule.left;
                const follow = followSets[leftSymbol];

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
                            console.error(`КОНФЛИКТ Shift/Reduce в состоянии ${stateName} по символу ${followSymbol}: Обнаружен Shift ${existingAction}, попытка добавить Reduce ${reduceAction}. Предпочитаем Shift.`);
                            addAction = false;
                        } else {
                            console.error(`КОНФЛИКТ Reduce/Reduce в состоянии ${stateName} по символу ${followSymbol}: Обнаружен ${existingAction}, попытка добавить ${reduceAction}. Оставляем первый (${existingAction}).`);
                            addAction = false;
                        }
                    }
                    if (addAction) {
                        finalTable[stateName][followSymbol].push(reduceAction);
                    }
                });
            }
        }
    }

    rules.forEach((rule, ruleIndex) => {
        if (rule.right.length === 0) { // Это ε-правило
            const leftNt = rule.left;
            const followOfLeft = followSets[leftNt];
            let reduceAction = `R${rule.ruleIndex}`;
            if (rule.semanticAction) {
                reduceAction += `~${rule.semanticAction}`;
            }


            for (const stateName in finalTable) {
                // И для всех символов `s` из `FOLLOW(leftNt)`:
                followOfLeft.forEach(followSymbol => {
                    // Это условие трудно проверить без полного набора LR-элементов.
                    // Пока пропустим этот сложный случай, так как исходная грамматика не содержит ε-правил.
                });
            }
        }
    });


    return finalTable;
}


export {
    parseGrammar,
    buildTransitionTable,
}

/*
// Пример использования с новой грамматикой:
const rawGrammarWithAction = [
    '<Z> -> <S> #',
    '<S> -> <S> + <T> ~act_plus', // действие для сложения
    '<S> -> <T>',
    '<T> -> <T> * <F> ~act_mul',  // действие для умножения
    '<T> -> <F>',
    '<F> -> - <F> ~act_neg',     // действие для унарного минуса
    '<F> -> ( <S> )',
    '<F> -> id ~act_id',         // действие для идентификатора
    '<F> -> num ~act_num',       // действие для числа
    // '<E> -> ~empty_action' // Пример эпсилон-правила с действием
];

// Предполагается, что GrammarRule, State, TransitionTable определены в @common/types
// и GrammarRule имеет поле semanticAction?: string;

// const parsed = parseGrammar(rawGrammarWithAction);
// console.log("Parsed Grammar with Actions:", JSON.stringify(parsed, null, 2));
// const table = buildTransitionTable(parsed);
// console.log("Transition Table:", JSON.stringify(table, null, 2));
*/