enum Lexeme {
    // Ключевые слова
    IF = 'IF',
    THEN = 'THEN',
    ELSE = 'ELSE',
    OR = 'OR',
    AND = 'AND',
    DIV = 'DIV',
    MOD = 'MOD',
    NOT = 'NOT',
    TRUE = 'TRUE',
    FALSE = 'FALSE',
    LET = 'LET',
    CONST = 'CONST',
    INT = 'INT',
    // Операторы и знаки пунктуации
    MULTIPLICATION = '*',
    PLUS = '+',
    MINUS = '-',
    DIVIDE = '/',
    SEMICOLON = ';',
    COMMA = ',',
    LEFT_PAREN = '(',
    RIGHT_PAREN = ')',
    LEFT_BRACKET = '[',
    RIGHT_BRACKET = ']',
    GREATER = '>',
    LESS = '<',
    LESS_EQ = '<=',
    GREATER_EQ = '>=',
    NOT_EQ = '!=',
    COLON = ':',
    ASSIGN = '=',
    DOT = '.',
    DOUBLE_EQ = '==',
    NEGATION = '!',
    GRID = '#',

    // Литералы и идентификаторы
    IDENTIFIER = 'IDENTIFIER',
    STRING = 'STRING',
    INTEGER = 'INTEGER',
    FLOAT = 'FLOAT',

    // Комментарии
    LINE_COMMENT = 'LINE_COMMENT',
    BLOCK_COMMENT = 'BLOCK_COMMENT',

    // Специальные
    ERROR = 'ERROR',
    EOF = 'EOF'
}

type Position = {
    line: number;
    column: number;
};

type Token = {
    type: Lexeme;
    lexeme: string;
    position: Position;
};

// Представление грамматического правила
type GrammarRule = {
    left: string;
    right: string[];
    ruleIndex: number;
    semanticAction?: string;
}

// Представление состояния: символ на позиции с индексом
type State = {
    name: string; // Например a11, S12
    symbol: string;
    ruleIndex: number;
    position: number;
}

// Таблица переходов: строки — состояния, столбцы — символы
type TransitionTable = {
    [state: string]: {
        [symbol: string]: string[]; // список состояний
    };
}

type FirstSets = Map<string, Set<string>>;

type FollowSets = Map<string, Set<string>>;

export {
    Lexeme,
    Position,
    Token,
    GrammarRule,
    State,
    TransitionTable,
    FirstSets,
    FollowSets,
}