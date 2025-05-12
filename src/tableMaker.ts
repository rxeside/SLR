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
        const statesToDelete = new Set<string>(); // Собираем все состояния, которые нужно будет удалить ПОСЛЕ обработки всех слияний

        // Создаем новые слитые состояния и копируем данные
        for (const [mergedKey, targets] of mergeMap.entries()) {
            // Добавляем все состояния, участвующие в слияниях, в набор для удаления
            targets.forEach(t => statesToDelete.add(t));

            if (mergedStatesData[mergedKey]) continue; // Уже обработали этот ключ слияния

            mergedStatesData[mergedKey] = {};
            const newTransitions = mergedStatesData[mergedKey];

            // Собираем все переходы и свёртки из исходных состояний
            for (const targetStateName of targets) {
                // Исходное состояние ДОЛЖНО существовать на этом этапе,
                // так как мы еще ничего не удаляли в этой итерации while
                if (!table[targetStateName]) {
                    // Если это все же произошло, это указывает на другую проблему,
                    // но основной баг с преждевременным удалением должен быть исправлен.
                    // console.warn(`Warning: State ${targetStateName} not found during merge for key ${mergedKey}. This might indicate an issue.`);
                    continue;
                }

                const sourceTransitions = table[targetStateName];
                for (const symbol in sourceTransitions) {
                    const actions = sourceTransitions[symbol];

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
                // завершающим состоянием какого-либо правила для добавления Reduce.
                const match = targetStateName.match(/^(.+)(\d+)(\d+)$/);
                if (match) {
                    const ruleIndex = parseInt(match[2], 10);
                    const position = parseInt(match[3], 10);
                    // Убедимся, что rules[ruleIndex] существует
                    if (ruleIndex >= 0 && ruleIndex < rules.length) {
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
                                // Добавляем свёртку, если её ещё нет и нет конфликтов
                                if (!newTransitions[followSymbol].includes(reduceAction)) {
                                    if (newTransitions[followSymbol].length > 0) {
                                        const existingAction = newTransitions[followSymbol][0];
                                        // Проверка на конфликты (добавим логирование для ясности)
                                        if (!existingAction.startsWith('R') && existingAction !== reduceAction) {
                                            console.error(`КОНФЛИКТ Shift/Reduce в состоянии ${mergedKey} по символу ${followSymbol}: Обнаружен Shift ${existingAction}, попытка добавить Reduce ${reduceAction} из состояния ${targetStateName}`);
                                            // Можно добавить стратегию разрешения, например, предпочитать Shift:
                                            // continue; // Пропустить добавление Reduce
                                        } else if (existingAction.startsWith('R') && existingAction !== reduceAction) {
                                            console.error(`КОНФЛИКТ Reduce/Reduce в состоянии ${mergedKey} по символу ${followSymbol}: Обнаружен ${existingAction}, попытка добавить ${reduceAction} из состояния ${targetStateName}`);
                                            // Можно выбрать правило с меньшим индексом или выдать ошибку
                                        }
                                        // Если конфликта нет или мы решили добавить несмотря на конфликт (не рекомендуется без стратегии):
                                        // newTransitions[followSymbol].push(reduceAction);
                                    }
                                    // Добавляем Reduce только если нет конфликта Shift/Reduce (предпочитаем Shift)
                                    // или если нет других действий
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
            // НЕ УДАЛЯЕМ ЗДЕСЬ: targets.forEach(t => delete table[t]);
        }

        // Удаляем все исходные состояния, участвовавшие в слияниях, ПОСЛЕ обработки всех ключей в mergeMap
        statesToDelete.forEach(stateName => {
            delete table[stateName];
        });

        // Добавляем новые слитые состояния в основную таблицу
        Object.assign(table, mergedStatesData);
    }


    // 3. Финальная обработка: Добавляем свёртки для *не слитых* завершающих состояний
    //    (Те состояния, которые завершают правило, но не участвовали в слияниях)
    const finalTable: TransitionTable = JSON.parse(JSON.stringify(table)); // <<< ВОЗВРАЩАЕМ ГЛУБОКУЮ КОПИЮ

    for (const stateName in table) { // Итерируем по ключам ОРИГИНАЛЬНОЙ таблицы ПОСЛЕ слияния
        // Проверяем, является ли *это* состояние завершающим по имени
        const match = stateName.match(/^(.+?)(\d+)(\d+)$/); // Non-greedy match for symbol
        if (match) {
            const ruleIndex = parseInt(match[2], 10);
            const position = parseInt(match[3], 10);

            // Проверяем валидность индекса правила
            if (ruleIndex < 0 || ruleIndex >= rules.length) {
                console.warn(`Invalid ruleIndex ${ruleIndex} parsed from state name ${stateName} in final processing loop.`);
                continue; // Пропускаем невалидное состояние
            }
            const rule = rules[ruleIndex];

            // Проверяем, действительно ли позиция соответствует концу правила
            if (position === rule.right.length) {
                // Да, это завершающее состояние
                const leftSymbol = rule.left;
                const follow = followSets[leftSymbol];
                const reduceAction = `R${ruleIndex}`;

                // Убеждаемся, что состояние существует в КОПИИ (должно, если было в оригинале)
                if (!finalTable[stateName]) {
                    console.warn(`State ${stateName} missing in finalTable copy during final processing.`);
                    finalTable[stateName] = {}; // Создаем на всякий случай
                }

                follow.forEach(followSymbol => {
                    // Убеждаемся, что массив для символа существует в КОПИИ
                    if (!finalTable[stateName][followSymbol]) {
                        finalTable[stateName][followSymbol] = [];
                    }

                    let addAction = true; // Флаг, разрешающий добавление действия

                    // Проверяем, нужно ли добавлять (нет дубликатов + разрешение конфликтов)
                    if (finalTable[stateName][followSymbol].includes(reduceAction)) {
                        addAction = false; // Уже есть такое действие, не добавляем
                    } else if (finalTable[stateName][followSymbol].length > 0) {
                        // Есть другие действия, проверяем конфликты
                        const existingAction = finalTable[stateName][followSymbol][0];
                        if (!existingAction.startsWith('R')) { // Конфликт Shift/Reduce
                            console.error(`КОНФЛИКТ Shift/Reduce в состоянии ${stateName} по символу ${followSymbol}: Обнаружен Shift ${existingAction}, попытка добавить Reduce ${reduceAction}. Предпочитаем Shift.`);
                            addAction = false; // НЕ добавляем Reduce при S/R конфликте
                        } else { // Конфликт Reduce/Reduce (existingAction !== reduceAction т.к. проверили includes выше)
                            console.error(`КОНФЛИКТ Reduce/Reduce в состоянии ${stateName} по символу ${followSymbol}: Обнаружен ${existingAction}, попытка добавить ${reduceAction}. Оставляем первый (${existingAction}).`);
                            addAction = false; // НЕ добавляем второй Reduce при R/R конфликте
                        }
                    }
                    // else { /* Массив пуст, конфликтов нет */ }

                    // Добавляем действие, если разрешено
                    if (addAction) {
                        finalTable[stateName][followSymbol].push(reduceAction);
                    }
                }); // конец follow.forEach
            } // конец if (position === rule.right.length)
        } // конец if (match)
    } // конец for (const stateName in table)

    return finalTable; // <<< ВОЗВРАЩАЕМ ИЗМЕНЕННУЮ КОПИЮ
}


export {
    parseGrammar,
    buildTransitionTable,
}