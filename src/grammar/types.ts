export type GrammarRule = {
    id: number; // Уникальный ID правила
    nonTerminal: string; // Левая часть (нетерминал)
    production: string[]; // Правая часть (последовательность символов)
    actionName?: string; // Имя семантического действия (например, ~Program)
};

export type Grammar = {
    rules: GrammarRule[];
    terminals: Set<string>;
    nonTerminals: Set<string>;
    startSymbol: string;
};