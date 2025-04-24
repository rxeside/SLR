// Представление грамматического правила
interface GrammarRule {
    left: string;
    right: string;
    ruleIndex: number;
}

// Представление состояния: символ на позиции с индексом
interface State {
    name: string; // Например a11, S12
    symbol: string;
    ruleIndex: number;
    position: number;
}

// Таблица переходов: строки — состояния, столбцы — символы
interface TransitionTable {
    [state: string]: {
        [symbol: string]: string[]; // список состояний
    };
}

// Исходная грамматика
const rawGrammar = [
    'Z->S#',
    'S->aSb',
    'S->ab',
    'S->Sc',
    'S->c'
];

// Парсинг грамматики
function parseGrammar(raw: string[]): GrammarRule[] {
    return raw.map((rule, index) => {
        const [left, right] = rule.split('->');
        return { left, right, ruleIndex: index };
    });
}

// Получение всех символов (нетерминалы + терминалы)
function extractSymbols(rules: GrammarRule[]): Set<string> {
    const symbols = new Set<string>();
    for (const { left, right } of rules) {
        symbols.add(left);
        for (const ch of right) {
            if (ch !== '#') symbols.add(ch);
        }
    }
    return symbols;
}

// Генерация всех состояний из правых частей правил
function generateStates(rules: GrammarRule[]): State[] {
    const states: State[] = [];
    for (const { right, ruleIndex } of rules) {
        for (let i = 0; i < right.length; i++) {
            const symbol = right[i];
            states.push({
                name: `${symbol}${ruleIndex}${i + 1}`,
                symbol,
                ruleIndex,
                position: i + 1
            });
        }
    }
    return states;
}

// Генерация таблицы переходов
function buildTransitionTable(rules: GrammarRule[]): TransitionTable {
    const table: TransitionTable = {};
    const symbols = Array.from(extractSymbols(rules));
    const states = generateStates(rules);

    // Стартовое состояние Z
    table['Z'] = {};
    for (const state of states) {
        const rule = rules[state.ruleIndex];
        if (rule.left === 'S') {
            if (!table['Z'][state.symbol]) table['Z'][state.symbol] = [];
            table['Z'][state.symbol].push(state.name);
        }
    }
    table['Z'][''] = ['R0']; // Свертка по пустому символу

    // Остальные состояния
    for (const state of states) {
        table[state.name] = {};
        const rule = rules[state.ruleIndex];
        const nextPos = state.position;
        const nextSymbol = rule.right[nextPos];
        if (nextSymbol) {
            const nextState = states.find(s => s.ruleIndex === state.ruleIndex && s.position === nextPos + 1);
            if (nextState) {
                if (!table[state.name][nextSymbol]) table[state.name][nextSymbol] = [];
                table[state.name][nextSymbol].push(nextState.name);
            }
        } else {
            table[state.name][''] = [`R${state.ruleIndex}`];
        }
    }

    return table;
}

const grammar = parseGrammar(rawGrammar);
const transitionTable = buildTransitionTable(grammar);
console.log(JSON.stringify(transitionTable, null, 2));