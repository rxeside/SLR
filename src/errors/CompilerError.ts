import { ErrorCode } from './errorCodes';
import { Token } from '@common/types';

export interface ErrorContext {
    // Общие
    message?: string; // Дополнительное сообщение от компонента
    lineNumber?: number;
    columnNumber?: number;
    offendingSymbol?: string; // Символ или токен, вызвавший ошибку

    // Специфичные для парсера
    expectedToken?: string;
    currentState?: string;

    // Специфичные для построителя таблицы
    stateName?: string;
    conflictingAction1?: string;
    conflictingAction2?: string;
    ruleText?: string;
    // ... и т.д.
}

export class CompilerError extends Error {
    public readonly code: ErrorCode;
    public readonly context: ErrorContext;

    constructor(code: ErrorCode, context: ErrorContext = {}) {
        // Вызываем конструктор Error с некоторым базовым сообщением,
        // но основное форматирование будет в ErrorReporter
        super(`Compiler Error [${code}]${context.message ? `: ${context.message}` : ''}`);
        this.code = code;
        this.context = context;
        this.name = 'CompilerError';

        // Это нужно для корректной работы instanceof с пользовательскими ошибками в TypeScript
        Object.setPrototypeOf(this, CompilerError.prototype);
    }
}