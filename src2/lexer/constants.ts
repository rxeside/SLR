export const EOF_SYMBOL = '$'; // Символ конца файла
export const EPSILON = 'ε'; // Символ для эпсилон (можно использовать пустую строку в грамматике)

export const TT = { // Token Types
    KEYWORD_LET: 'let',
    KEYWORD_CONST: 'const',
    KEYWORD_FUNCTION: 'function',
    KEYWORD_IF: 'if',
    KEYWORD_ELSE: 'else',
    KEYWORD_WHILE: 'while',
    KEYWORD_RETURN: 'return',
    KEYWORD_BOOL: 'bool',
    KEYWORD_NUM: 'num',
    KEYWORD_STRING: 'string',
    KEYWORD_TRUE: 'true',
    KEYWORD_FALSE: 'false',

    IDENTIFIER: 'id',
    NUMBER: 'number',
    STRING: 'string',
    BOOLEAN: 'bool',

    OPERATOR_PLUS: '+',
    OPERATOR_MINUS: '-',
    OPERATOR_MULTIPLY: '*',
    OPERATOR_DIVIDE: '/',
    OPERATOR_ASSIGN: '=',
    OPERATOR_EQUALS: '==',
    OPERATOR_NOT_EQUALS: '!=',
    OPERATOR_LESS: '<',
    OPERATOR_GREATER: '>',
    OPERATOR_LESS_EQUALS: '<=',
    OPERATOR_GREATER_EQUALS: '>=',

    PUNCT_SEMICOLON: ';',
    PUNCT_COMMA: ',',
    PUNCT_LPAREN: '(',
    PUNCT_RPAREN: ')',
    PUNCT_LBRACE: '{',
    PUNCT_RBRACE: '}',
    PUNCT_COLON: ':',

    EOF: EOF_SYMBOL, // Используем общий EOF_SYMBOL
    UNKNOWN: 'UNKNOWN', // Для непредвиденных символов
    NULL: null, // для комментов
};

export const tokenSpecifications: [RegExp, string | null][] = [
    // Пробельные символы и комментарии (игнорируются, тип null)
    [/^\s+/, null], // Пробелы, табы, новые строки
    [/^\/\/.*/, null], // Однострочные комментарии

    // Ключевые слова
    [/^let\b/, TT.KEYWORD_LET],
    [/^const\b/, TT.KEYWORD_CONST],
    [/^function\b/, TT.KEYWORD_FUNCTION],
    [/^if\b/, TT.KEYWORD_IF],
    [/^else\b/, TT.KEYWORD_ELSE],
    [/^while\b/, TT.KEYWORD_WHILE],
    [/^return\b/, TT.KEYWORD_RETURN],
    [/^bool\b/, TT.KEYWORD_BOOL],
    [/^num\b/, TT.KEYWORD_NUM],
    [/^string\b/, TT.KEYWORD_STRING],
    [/^true\b/, TT.KEYWORD_TRUE],
    [/^false\b/, TT.KEYWORD_FALSE],

    // Пунктуация
    [/^;/, TT.PUNCT_SEMICOLON],
    [/^,/, TT.PUNCT_COMMA],
    [/^\(/, TT.PUNCT_LPAREN],
    [/^\)/, TT.PUNCT_RPAREN],
    [/^\{/, TT.PUNCT_LBRACE],
    [/^\}/, TT.PUNCT_RBRACE],
    [/^:/, TT.PUNCT_COLON],

    // Операторы
    [/^==/, TT.OPERATOR_EQUALS],
    [/^!=/, TT.OPERATOR_NOT_EQUALS],
    [/^<=/, TT.OPERATOR_LESS_EQUALS],
    [/^>=/, TT.OPERATOR_GREATER_EQUALS],
    [/^\+/, TT.OPERATOR_PLUS],
    [/^\-/, TT.OPERATOR_MINUS],
    [/^\*/, TT.OPERATOR_MULTIPLY],
    [/^\//, TT.OPERATOR_DIVIDE],
    [/^=/, TT.OPERATOR_ASSIGN],
    [/^</, TT.OPERATOR_LESS],
    [/^>/, TT.OPERATOR_GREATER],

    // Строки (в двойных кавычках)
    [/^"[^"]*"/, TT.STRING],

    // Числа (целые и с точкой)
    [/^[0-9]+(\.[0-9]+)?/, TT.NUMBER],

    // Идентификаторы (должны идти после ключевых слов)
    // Начинаются с буквы или _, затем буквы, цифры или _
    [/^[a-zA-Z_][a-zA-Z0-9_]*/, TT.IDENTIFIER],
];
