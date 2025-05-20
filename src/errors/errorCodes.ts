export enum ErrorCode {
    // Lexer Errors (L001 - L099)
    LEXER_UNEXPECTED_CHAR = 'L001',
    LEXER_UNTERMINATED_STRING = 'L002',
    LEXER_INVALID_NUMBER_FORMAT = 'L003',
    // ... другие ошибки лексера

    // Parser Errors (P001 - P099)
    PARSER_UNEXPECTED_TOKEN = 'P001',
    PARSER_MISSING_TOKEN = 'P002', // Если бы у вас была логика восстановления
    PARSER_GRAMMAR_RULE_NOT_FOUND = 'P003',
    PARSER_INVALID_REDUCE_ACTION = 'P004',
    PARSER_STACK_MISMATCH = 'P005',
    PARSER_INCOMPLETE_PARSE = 'P006',
    PARSER_AST_STACK_ERROR = 'P007',
    PARSER_NO_TRANSITION = 'P008',

    // SLR Table Builder Errors (B001 - B099)
    BUILDER_EMPTY_GRAMMAR = 'B001',
    BUILDER_INVALID_GRAMMAR_RULE_FORMAT = 'B002',
    BUILDER_START_SYMBOL_NOT_FOUND_IN_FOLLOW = 'B003',
    BUILDER_SHIFT_REDUCE_CONFLICT = 'B004',
    BUILDER_REDUCE_REDUCE_CONFLICT = 'B005',
    BUILDER_INVALID_RULE_INDEX_IN_STATE_NAME = 'B006',
    // ... другие ошибки построителя таблицы

    // Semantic Errors (S001 - S099) - если будете добавлять семантический анализ
    SEMANTIC_UNDECLARED_VARIABLE = 'S001',
    SEMANTIC_TYPE_MISMATCH = 'S002',

    // General/Internal Errors (G001 - G099)
    GENERAL_UNEXPECTED_ERROR = 'G001',
}