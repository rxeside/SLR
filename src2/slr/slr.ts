import { Grammar } from "../grammar/types";
import { processGrammar } from "../grammar/grammar";
import { EOF_SYMBOL } from "../lexer/constants";

// Типы для таблиц
export type Action = { type: "shift", to: number } | { type: "reduce", rule: number } | { type: "accept" } | { type: "error" };
export type ActionTable = Map<number, Map<string, Action>>;
export type GotoTable = Map<number, Map<string, number>>;

// LR(0) Item
interface Item {
    rule: number; // индекс правила
    dot: number;  // позиция точки
}

function itemsEqual(a: Item, b: Item): boolean {
    return a.rule === b.rule && a.dot === b.dot;
}

function itemSetEqual(a: Item[], b: Item[]): boolean {
    if (a.length !== b.length) return false;
    return a.every(ai => b.some(bi => itemsEqual(ai, bi)));
}

function closure(items: Item[], grammar: Grammar): Item[] {
    const result = [...items];
    const added = new Set(result.map(i => `${i.rule},${i.dot}`));
    let changed = true;
    while (changed) {
        changed = false;
        for (const item of result) {
            const rule = grammar.rules[item.rule];
            const symbol = rule.production[item.dot];
            if (symbol && grammar.nonTerminals.has(symbol)) {
                grammar.rules.forEach((r, idx) => {
                    if (r.nonTerminal === symbol) {
                        const key = `${idx},0`;
                        if (!added.has(key)) {
                            result.push({ rule: idx, dot: 0 });
                            added.add(key);
                            changed = true;
                        }
                    }
                });
            }
        }
    }
    return result;
}

function goto(items: Item[], symbol: string, grammar: Grammar): Item[] {
    const moved = items.filter(item => grammar.rules[item.rule].production[item.dot] === symbol)
        .map(item => ({ rule: item.rule, dot: item.dot + 1 }));
    return closure(moved, grammar);
}

function items(grammar: Grammar): Item[][] {
    const C: Item[][] = [];
    const startItem = closure([{ rule: 0, dot: 0 }], grammar);
    C.push(startItem);
    let changed = true;
    while (changed) {
        changed = false;
        for (const I of [...C]) {
            const symbols = new Set<string>();
            for (const item of I) {
                const rule = grammar.rules[item.rule];
                if (item.dot < rule.production.length) {
                    symbols.add(rule.production[item.dot]);
                }
            }
            for (const symbol of symbols) {
                const gotoI = goto(I, symbol, grammar);
                if (gotoI.length === 0) continue;
                if (!C.some(J => itemSetEqual(J, gotoI))) {
                    C.push(gotoI);
                    changed = true;
                }
            }
        }
    }
    return C;
}

function computeFirst(grammar: Grammar): Map<string, Set<string>> {
    const first = new Map<string, Set<string>>();
    for (const t of grammar.terminals) first.set(t, new Set([t]));
    for (const nt of grammar.nonTerminals) first.set(nt, new Set());
    let changed = true;
    while (changed) {
        changed = false;
        for (const rule of grammar.rules) {
            const A = rule.nonTerminal;
            const setA = first.get(A)!;
            for (let i = 0; i < rule.production.length; i++) {
                const X = rule.production[i];
                const setX = first.get(X);
                if (setX) {
                    const before = setA.size;
                    for (const s of setX) setA.add(s);
                    if (setA.size > before) changed = true;
                }
                if (!setX || !setX.has(EOF_SYMBOL)) break;
            }
        }
    }
    return first;
}

function computeFollow(grammar: Grammar, first: Map<string, Set<string>>): Map<string, Set<string>> {
    const follow = new Map<string, Set<string>>();
    for (const nt of grammar.nonTerminals) follow.set(nt, new Set());
    follow.get(grammar.startSymbol)!.add(EOF_SYMBOL);
    let changed = true;
    while (changed) {
        changed = false;
        for (const rule of grammar.rules) {
            const A = rule.nonTerminal;
            for (let i = 0; i < rule.production.length; i++) {
                const B = rule.production[i];
                if (!grammar.nonTerminals.has(B)) continue;
                let firstBeta = new Set<string>();
                let nullable = true;
                for (let j = i + 1; j < rule.production.length; j++) {
                    const sym = rule.production[j];
                    const set = first.get(sym);
                    if (set) for (const s of set) if (s !== EOF_SYMBOL) firstBeta.add(s);
                    if (!set || !set.has(EOF_SYMBOL)) { nullable = false; break; }
                }
                const followB = follow.get(B)!;
                const before = followB.size;
                for (const s of firstBeta) followB.add(s);
                if (nullable) for (const s of follow.get(A)!) followB.add(s);
                if (followB.size > before) changed = true;
            }
        }
    }
    return follow;
}

export function buildSLRTable(grammar: Grammar): { action: ActionTable, goto: GotoTable } {
    const C = items(grammar);
    const first = computeFirst(grammar);
    const follow = computeFollow(grammar, first);
    const action: ActionTable = new Map();
    const gotoTable: GotoTable = new Map();
    const augmentedStartSymbol = grammar.rules[0].nonTerminal; // <S>'

    for (let i = 0; i < C.length; i++) {
        action.set(i, new Map());
        gotoTable.set(i, new Map());
    }
    for (let i = 0; i < C.length; i++) {
        const I = C[i];
        for (const item of I) {
            const rule = grammar.rules[item.rule];
            if (item.dot < rule.production.length) {
                const a = rule.production[item.dot];
                if (grammar.terminals.has(a)) {
                    const gotoJ = C.findIndex(J => itemSetEqual(J, goto(I, a, grammar)));
                    if (gotoJ !== -1) {
                        action.get(i)!.set(a, { type: "shift", to: gotoJ });
                    }
                } else if (grammar.nonTerminals.has(a)) {
                    const gotoJ = C.findIndex(J => itemSetEqual(J, goto(I, a, grammar)));
                    if (gotoJ !== -1) {
                        gotoTable.get(i)!.set(a, gotoJ);
                    }
                }
            } else {
                // Reduce or accept
                if (rule.nonTerminal === augmentedStartSymbol) {
                    action.get(i)!.set(EOF_SYMBOL, { type: "accept" });
                } else {
                    for (const b of follow.get(rule.nonTerminal)!) {
                        action.get(i)!.set(b, { type: "reduce", rule: item.rule });
                    }
                }
            }
        }
    }
    return { action, goto: gotoTable };
}

export function printSLRTable(action: ActionTable, goto: GotoTable, grammar: Grammar) {
    const states = Array.from(action.keys());
    const terminals = Array.from(grammar.terminals).concat([EOF_SYMBOL]);
    const nonTerminals = Array.from(grammar.nonTerminals).filter(nt => nt !== grammar.startSymbol);
    const pad = (s: string, n: number) => s.padEnd(n, ' ');
    const colW = 8;
    let header = pad('STATE', colW);
    for (const t of terminals) header += pad(t, colW);
    for (const nt of nonTerminals) header += pad(nt, colW);
    console.log(header);
    for (const state of states) {
        let row = pad(state.toString(), colW);
        for (const t of terminals) {
            const act = action.get(state)?.get(t);
            if (!act) row += pad('', colW);
            else if (act.type === 'shift') row += pad('s' + act.to, colW);
            else if (act.type === 'reduce') row += pad('r' + act.rule, colW);
            else if (act.type === 'accept') row += pad('acc', colW);
            else row += pad('err', colW);
        }
        for (const nt of nonTerminals) {
            const g = goto.get(state)?.get(nt);
            row += pad(g !== undefined ? g.toString() : '', colW);
        }
        console.log(row);
    }
}

export class SLRParser {
    private grammar: Grammar;
    private action: ActionTable;
    private goto: GotoTable;
    private debug: boolean;

    constructor(grammarLines: string[], debug = false) {
        this.grammar = processGrammar(grammarLines);
        const { action, goto } = buildSLRTable(this.grammar);
        if (debug) {
            printSLRTable(action, goto, this.grammar);
        }
        this.action = action;
        this.goto = goto;
        this.debug = debug;
    }

    // tokens: массив терминалов (строк)
    parse(tokens: string[]): boolean | string {
        const stack: number[] = [0];
        let pos = 0;
        while (true) {
            const state = stack[stack.length - 1];
            const token = tokens[pos] ?? EOF_SYMBOL;
            const act = this.action.get(state)?.get(token) ?? { type: "error" };
            if (act.type === "shift") {
                stack.push(act.to);
                pos++;
            } else if (act.type === "reduce") {
                const rule = this.grammar.rules[act.rule];
                for (let i = 0; i < rule.production.length; i++) stack.pop();
                const prev = stack[stack.length - 1];
                const gotoState = this.goto.get(prev)?.get(rule.nonTerminal);
                if (gotoState === undefined) {
                    return `ОШИБКА. Не удалось перейти по GOTO(${prev}, ${rule.nonTerminal}).\nВход: [${tokens.slice(pos).join(" ") || EOF_SYMBOL}], состояние: ${state}, токен: '${token}', правило: ${rule.nonTerminal} -> ${rule.production.join(" ")}`;
                }
                stack.push(gotoState);
            } else if (act.type === "accept") {
                return true;
            } else {
                // Ошибка разбора
                let expected = [];
                const acts = this.action.get(state);
                if (acts) {
                    for (const [tok, a] of acts.entries()) {
                        if (a.type === "shift") expected.push(`shift '${tok}'`);
                        else if (a.type === "reduce") expected.push(`reduce по правилу ${this.grammar.rules[a.rule].nonTerminal} -> ${this.grammar.rules[a.rule].production.join(" ")}`);
                        else if (a.type === "accept") expected.push("accept");
                    }
                }
                return `ОШИБКА. Вход: [${tokens.slice(pos).join(" ") || EOF_SYMBOL}],\n  Состояние: ${state},\n  Текущий токен: '${token}'\n  Ожидалось: ${expected.length ? expected.join(", ") : "нет допустимых действий"}`;
            }
        }
    }
}
