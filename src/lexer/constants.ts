const EOF_SYMBOL = '$';
const EPSILON = 'epsilon';

const TT = {
    // Keywords
    KEYWORD_LET: 'let',
    KEYWORD_CONST: 'const',
    KEYWORD_FUNCTION: 'function',
    KEYWORD_IF: 'if',
    KEYWORD_ELSE: 'else',
    KEYWORD_WHILE: 'while',
    KEYWORD_RETURN: 'return',
    KEYWORD_FOR: 'for',
    KEYWORD_BOOL: 'bool',
    KEYWORD_NUM: 'num',
    KEYWORD_STRING_TYPE: 'string',
    KEYWORD_TRUE: 'true',
    KEYWORD_FALSE: 'false',
    KEYWORD_VOID: 'void',
    KEYWORD_ANY: 'any',

    // Operators
    OP_ASSIGN: '=',
    OP_EQ: '==',
    OP_NEQ: '!=',
    OP_LT: '<',
    OP_GT: '>',
    OP_LTE: '<=',
    OP_GTE: '>=',
    OP_AND: '&&',
    OP_OR: '||',
    OP_NOT: '!',
    OP_PLUS: '+',
    OP_MINUS: '-',
    OP_MUL: '*',
    OP_DIV: '/',
    OP_MOD: '%',

    // Punctuators
    PUNCT_LPAREN: '(',
    PUNCT_RPAREN: ')',
    PUNCT_LBRACE: '{',
    PUNCT_RBRACE: '}',
    PUNCT_LBRACKET: '[',
    PUNCT_RBRACKET: ']',
    PUNCT_COMMA: ',',
    PUNCT_COLON: ':',
    PUNCT_SEMICOLON: ';',

    // Literals & Identifiers
    IDENTIFIER: 'id',
    NUMBER: 'number',
    STRING: 'string',

    // Misc
    UNKNOWN: 'UNKNOWN',
    EOF: EOF_SYMBOL,
    NULL: null,
};

const tokenSpecifications: [RegExp, string | null][] = [
    // Ignored
    [/^\s+/, null],
    [/^\/\/.*/, null],
    [/^\/\*[\s\S]*?\*\//, null],

    // Punctuators
    [/^\(/, TT.PUNCT_LPAREN],
    [/^\)/, TT.PUNCT_RPAREN],
    [/^\{/, TT.PUNCT_LBRACE],
    [/^\}/, TT.PUNCT_RBRACE],
    [/^\[/, TT.PUNCT_LBRACKET],
    [/^\]/, TT.PUNCT_RBRACKET],
    [/^,/, TT.PUNCT_COMMA],
    [/^:/, TT.PUNCT_COLON],
    [/^;/, TT.PUNCT_SEMICOLON],

    // Operators
    [/^==/, TT.OP_EQ],
    [/^!=/, TT.OP_NEQ],
    [/^<=/, TT.OP_LTE],
    [/^>=/, TT.OP_GTE],
    [/^&&/, TT.OP_AND],
    [/^\|\|/, TT.OP_OR],
    [/^!/, TT.OP_NOT],
    [/^=/, TT.OP_ASSIGN],
    [/^\+/, TT.OP_PLUS],
    [/^-/, TT.OP_MINUS],
    [/^\*/, TT.OP_MUL],
    [/^\//, TT.OP_DIV],
    [/^%/, TT.OP_MOD],
    [/^</, TT.OP_LT],
    [/^>/, TT.OP_GT],
    
    // Literals
    [/^\d+/, TT.NUMBER],
    [/^"[^"]*"/, TT.STRING],

    // Identifiers (should be last)
    [/^[a-zA-Z_][a-zA-Z0-9_]*/, TT.IDENTIFIER],
];

export {
    TT,
    EOF_SYMBOL,
    EPSILON,
    tokenSpecifications
};
