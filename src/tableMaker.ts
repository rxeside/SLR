import { GrammarRule, State, TransitionTable } from '@common/types'; // Предполагаем, что типы определены

const SEPARATOR_SPACED_FALLOW = ' -> ';
const SYMBOL_END = '#'; // Используем константу

// Тип для хранения FOLLOW-множеств
type FollowSets = Record<string, Set<string>>;

// Парсинг грамматики (без изменений)
function parseGrammar(raw: string[]): GrammarRule[] {
    return raw.map((rule, index) => {
        const [left, right] = rule.split(SEPARATOR_SPACED_FALLOW);
        const leftSymbol = left.trim();
        const rightSymbols = right.trim().split(/\s+/).filter(s => s !== ''); // Убираем пустые строки, если есть

        // Обработка пустого правила 'e' (если нужно, сейчас грамматика его не содержит)
        // if (rightSymbols.length === 1 && rightSymbols[0] === 'e') {
        //     rightSymbols = []; // Представляем эпсилон как пустой массив
        // }

        return {
            left: leftSymbol,
            right: rightSymbols,
            ruleIndex: index,
        };
    });
}

function isNonTerminal(symbol: string): boolean {
    return /^<.*>$/.test(symbol);
}

// --- Функции для вычисления FIRST и FOLLOW ---

// Вычисляет FIRST-множества для всех нетерминалов
function calculateFirstSets(rules: GrammarRule[], nonTerminals: Set<string>): Record<string, Set<string>> {
    const firstSets: Record<string, Set<string>> = {};
    nonTerminals.forEach(nt => firstSets[nt] = new Set());
    let changed = true;

    while (changed) {
        changed = false;
        for (const rule of rules) {
            const left = rule.left;
            const right = rule.right;
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
            // Если вся правая часть может быть пустой (или правило было A -> e)
            // if (canBeEmpty) {
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

    // 1. FOLLOW(startSymbol) содержит SYMBOL_END
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
            const right = rule.right;

            for (let i = 0; i < right.length; i++) {
                const symbolB = right[i];
                if (!isNonTerminal(symbolB)) continue; // Нас интересует FOLLOW нетерминалов

                const sequenceAfterB = right.slice(i + 1);
                const firstOfSequence = getFirstForSequence(sequenceAfterB, firstSets);

                // 2. Если есть правило A -> αBβ, то все из FIRST(β) (кроме ε) добавляется в FOLLOW(B)
                const oldSizeB = followSets[symbolB].size;
                firstOfSequence.forEach(f => {
                    if (f !== 'e') followSets[symbolB].add(f);
                });
                if (followSets[symbolB].size > oldSizeB) changed = true;

                // 3. Если есть правило A -> αB, ИЛИ A -> αBβ где FIRST(β) содержит ε,
                // то все из FOLLOW(A) добавляется в FOLLOW(B)
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
    const startSymbol = rules[0]?.left || '<Z>'; // Обычно первое правило определяет стартовый символ
    const firstSets = calculateFirstSets(rules, nonTerminals);
    const followSets = calculateFollowSets(rules, nonTerminals, firstSets, startSymbol);

    console.log("First Sets:", firstSets); // Для отладки
    console.log("Follow Sets:", followSets); // Для отладки

    const symbolToRules: Record<string, GrammarRule[]> = {};
    for (const rule of rules) {
        if (!symbolToRules[rule.left]) {
            symbolToRules[rule.left] = [];
        }
        symbolToRules[rule.left].push(rule);
    }

    // Создание начальных состояний и переходов (как в вашем коде)
    const initialStates: State[] = [];
    for (const rule of rules) {
        const right = rule.right;
        for (let i = 0; i < right.length; i++) {
            const symbol = right[i];
            initialStates.push({
                name: `${symbol}${rule.ruleIndex}${i + 1}`, // Уникальное имя для начального этапа
                symbol,
                ruleIndex: rule.ruleIndex,
                position: i + 1, // Позиция *после* символа
            });
        }
    }

    // Функция для добавления переходов по первым символам (из вашего кода, немного улучшена)
    function addFirstTransitions(
        symbol: string,
        fromState: string,
        currentTable: TransitionTable,
        visited = new Set<string>() // Для предотвращения рекурсии на одном и том же символе *в рамках одного вызова*
    ) {
        if (!isNonTerminal(symbol) || visited.has(symbol)) return;
        visited.add(symbol); // Отмечаем посещение символа в текущем пути рекурсии

        const subRules = symbolToRules[symbol];
        if (!subRules) return;

        if (!currentTable[fromState]) currentTable[fromState] = {}; // Убедимся, что состояние существует

        for (const subRule of subRules) {
            if (subRule.right.length === 0) { // Обработка A -> ε (если есть)
                // Свёртка по эпсилон-правилу добавляется на основе FOLLOW(A)
                // Это обычно делается не здесь, а при обработке завершающих состояний
                // console.warn(`Epsilon rule R${subRule.ruleIndex} found, needs FOLLOW set handling for reduction.`);
            } else {
                const first = subRule.right[0];
                const subStateName = `${first}${subRule.ruleIndex}1`; // Состояние после первого символа

                if (!currentTable[fromState][first]) currentTable[fromState][first] = [];

                // Избегаем дублирования состояний в списке переходов
                if (!currentTable[fromState][first].includes(subStateName)) {
                    currentTable[fromState][first].push(subStateName);
                }

                // Рекурсивный вызов для нетерминалов
                if (isNonTerminal(first)) {
                    // Создаем новый Set для следующего уровня рекурсии
                    addFirstTransitions(first, fromState, currentTable, new Set(visited));
                }
            }
        }
    }


    // 1. Начальное заполнение таблицы переходами (Shift)
    table[startSymbol] = {}; // Начальное состояние для стартового символа грамматики
    const zRule = rules.find(r => r.left === startSymbol);
    if (zRule && zRule.right.length > 0) {
        const firstSymbol = zRule.right[0];
        // Состояние после первого символа правила Z -> S #
        const sState = `${firstSymbol}${zRule.ruleIndex}1`;
        if (!table[startSymbol][firstSymbol]) table[startSymbol][firstSymbol] = [];
        table[startSymbol][firstSymbol].push(sState);

        // Рекурсивно добавляем переходы, начинающиеся с первого символа (S)
        addFirstTransitions(firstSymbol, startSymbol, table, new Set());
    } else if (zRule) {
        // Правило Z -> ε (или Z -> #, если # - терминал)
        console.warn("Handle start rule Z -> epsilon or Z -> # case if needed");
    }


    // Добавляем переходы для всех "внутренних" состояний
    for (const state of initialStates) {
        const { name, ruleIndex, position } = state;
        const rule = rules[ruleIndex];

        if (!table[name]) table[name] = {}; // Создаем запись для состояния, если её нет

        // Если это не конец правила, добавляем переход (Shift) по следующему символу
        if (position < rule.right.length) {
            const nextSymbol = rule.right[position];
            const nextStateName = `${nextSymbol}${rule.ruleIndex}${position + 1}`;

            if (!table[name][nextSymbol]) table[name][nextSymbol] = [];
            if (!table[name][nextSymbol].includes(nextStateName)) {
                table[name][nextSymbol].push(nextStateName);
            }

            // Если следующий символ - нетерминал, добавляем переходы по его FIRST-символам
            if (isNonTerminal(nextSymbol)) {
                addFirstTransitions(nextSymbol, name, table, new Set());
            }
        }
        // else {
        // Если это конец правила (position === rule.right.length),
        // то действия свёртки (Reduce) будут добавлены позже, после слияния,
        // на основе FOLLOW-множеств.
        // }
    }


    // 2. Слияние состояний и обработка свёрток (Reduce)

    let somethingMerged = true;
    while (somethingMerged) {
        somethingMerged = false;
        const mergeMap = new Map<string, string[]>(); // Карта: ключ_слияния -> [имена_исходных_состояний]

        // Находим кандидатов на слияние
        for (const stateName in table) {
            const transitions = table[stateName];
            for (const symbol in transitions) {
                const targets = transitions[symbol];
                // Сливаем, только если несколько переходов по *одному и тому же* символу
                // И если это переходы в состояния, а не свёртки
                if (targets.length > 1 && targets.every(t => !t.startsWith('R'))) {
                    // Сортируем для канонического ключа
                    const sortedTargets = [...targets].sort();
                    const mergedKey = sortedTargets.join(' '); // Ключ для слияния

                    if (!mergeMap.has(mergedKey)) {
                        mergeMap.set(mergedKey, sortedTargets);
                    }
                    // Заменяем множественный переход на переход в будущее слитое состояние
                    transitions[symbol] = [mergedKey]; // Теперь переход ведет в одно слитое состояние
                    // Отмечаем, что произошло изменение, возможно, потребуется еще итерация слияния
                    // (Хотя в данном случае замена происходит сразу, можно и не ставить флаг здесь)
                }
            }
        }


        if (mergeMap.size === 0) break; // Больше нечего сливать

        somethingMerged = true; // Раз нашли кандидатов, значит что-то сольем
        const mergedStatesData: TransitionTable = {}; // Временное хранилище для новых слитых состояний

        // Создаем новые слитые состояния
        for (const [mergedKey, targets] of mergeMap.entries()) {
            if (mergedStatesData[mergedKey]) continue; // Уже обработали этот ключ слияния

            mergedStatesData[mergedKey] = {};
            const newTransitions = mergedStatesData[mergedKey];

            // Собираем все переходы и свёртки из исходных состояний
            for (const targetStateName of targets) {
                // Если исходное состояние само было результатом слияния и уже удалено, пропускаем
                if (!table[targetStateName]) continue;

                const sourceTransitions = table[targetStateName];
                for (const symbol in sourceTransitions) {
                    const actions = sourceTransitions[symbol]; // Могут быть переходы [state] или свёртки [R_]

                    if (!newTransitions[symbol]) {
                        newTransitions[symbol] = [];
                    }

                    // Добавляем действия, избегая дубликатов
                    for (const action of actions) {
                        if (!newTransitions[symbol].includes(action)) {
                            newTransitions[symbol].push(action);
                        }
                    }
                }

                // Проверяем, не является ли *само* исходное состояние `targetStateName`
                // завершающим состоянием какого-либо правила.
                // Парсим имя состояния: символ + индекс правила + позиция
                const match = targetStateName.match(/^(.+)(\d+)(\d+)$/);
                if (match) {
                    //const parsedSymbol = match[1];
                    const ruleIndex = parseInt(match[2], 10);
                    const position = parseInt(match[3], 10);
                    const originalRule = rules[ruleIndex];

                    if (position === originalRule.right.length) {
                        // Да, это состояние завершает правило `originalRule`
                        const leftSymbol = originalRule.left;
                        const follow = followSets[leftSymbol];
                        const reduceAction = `R${ruleIndex}`;

                        follow.forEach(followSymbol => {
                            if (!newTransitions[followSymbol]) {
                                newTransitions[followSymbol] = [];
                            }
                            // Добавляем свёртку, если её ещё нет
                            if (!newTransitions[followSymbol].includes(reduceAction)) {
                                // Проверка на конфликты Shift/Reduce или Reduce/Reduce
                                if (newTransitions[followSymbol].length > 0) {
                                    // Если уже есть действие (Shift или другая Reduce)
                                    const existingAction = newTransitions[followSymbol][0];
                                    if (existingAction !== reduceAction && !existingAction.startsWith('R')) {
                                        console.error(`КОНФЛИКТ Shift/Reduce в состоянии ${mergedKey} по символу ${followSymbol}: Shift ${existingAction} vs Reduce ${reduceAction}`);
                                    } else if (existingAction !== reduceAction && existingAction.startsWith('R')) {
                                        console.error(`КОНФЛИКТ Reduce/Reduce в состоянии ${mergedKey} по символу ${followSymbol}: ${existingAction} vs ${reduceAction}`);
                                    }
                                    // В этом примере конфликтов быть не должно, но проверка важна
                                }
                                newTransitions[followSymbol].push(reduceAction);
                            }
                        });
                    }
                }


            }
            // Удаляем исходные состояния, которые были слиты
            targets.forEach(t => delete table[t]);
        }

        // Добавляем новые слитые состояния в основную таблицу
        Object.assign(table, mergedStatesData);
    }


    // 3. Финальная обработка: Добавляем свёртки для *не слитых* завершающих состояний
    //    (Те состояния, которые завершают правило, но не участвовали в слияниях)
    const finalTable: TransitionTable = JSON.parse(JSON.stringify(table)); // Глубокая копия для итерации

    for (const stateName in table) {
        // Проверяем, является ли *это* состояние завершающим
        const match = stateName.match(/^(.+)(\d+)(\d+)$/);
        if (match) {
            const ruleIndex = parseInt(match[2], 10);
            const position = parseInt(match[3], 10);
            const rule = rules[ruleIndex];

            if (position === rule.right.length) {
                // Да, это завершающее состояние
                const leftSymbol = rule.left;
                const follow = followSets[leftSymbol];
                const reduceAction = `R${ruleIndex}`;

                if (!finalTable[stateName]) finalTable[stateName] = {}; // На всякий случай

                follow.forEach(followSymbol => {
                    if (!finalTable[stateName][followSymbol]) {
                        finalTable[stateName][followSymbol] = [];
                    }
                    if (!finalTable[stateName][followSymbol].includes(reduceAction)) {
                        // Проверка на конфликты (аналогично коду слияния)
                        if (finalTable[stateName][followSymbol].length > 0) {
                            const existingAction = finalTable[stateName][followSymbol][0];
                            if (existingAction !== reduceAction && !existingAction.startsWith('R')) {
                                console.error(`КОНФЛИКТ Shift/Reduce в состоянии ${stateName} по символу ${followSymbol}: Shift ${existingAction} vs Reduce ${reduceAction}`);
                            } else if (existingAction !== reduceAction && existingAction.startsWith('R')) {
                                console.error(`КОНФЛИКТ Reduce/Reduce в состоянии ${stateName} по символу ${followSymbol}: ${existingAction} vs ${reduceAction}`);
                            }
                        }
                        finalTable[stateName][followSymbol].push(reduceAction);
                    }
                });
            }
        }
    }

    return finalTable;
}


export {
    parseGrammar,
    buildTransitionTable,
}