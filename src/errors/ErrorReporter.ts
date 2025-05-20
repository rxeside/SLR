import { ErrorCode } from './errorCodes';
import { CompilerError, ErrorContext } from './CompilerError';

type ErrorMessageFormatter = (context: ErrorContext) => string;

export class ErrorReporter {
    private errorMessages: Map<ErrorCode, string | ErrorMessageFormatter>;
    private errorCount: number;
    private collectedErrors: CompilerError[]; // Для сбора всех ошибок, если нужно

    constructor() {
        this.errorMessages = new Map();
        this.errorCount = 0;
        this.collectedErrors = [];
        this._initializeErrorMessages();
    }

    private _initializeErrorMessages(): void {
        // Лексер
        this.errorMessages.set(
            ErrorCode.LEXER_UNEXPECTED_CHAR,
            (ctx) => `Неожиданный символ '${ctx.offendingSymbol}'`
        );
        this.errorMessages.set(
            ErrorCode.LEXER_UNTERMINATED_STRING,
            (ctx) => `Незавершенная строка, начавшаяся`
        );

        // Парсер
        this.errorMessages.set(
            ErrorCode.PARSER_UNEXPECTED_TOKEN,
            (ctx) => `Неожиданный токен '${ctx.offendingSymbol}'. ${ctx.expectedToken ? `Ожидался: ${ctx.expectedToken}.` : ''}`
        );
        this.errorMessages.set(
            ErrorCode.PARSER_NO_TRANSITION,
            (ctx) => `Синтаксическая ошибка: нет перехода из состояния '${ctx.currentState}' по символу '${ctx.offendingSymbol}' (токен: '${ctx.message}')`
        );
        this.errorMessages.set(
            ErrorCode.PARSER_GRAMMAR_RULE_NOT_FOUND,
            (ctx) => `Внутренняя ошибка: правило грамматики с индексом ${ctx.message} не найдено.`
        );
        this.errorMessages.set(
            ErrorCode.PARSER_INVALID_REDUCE_ACTION,
            (ctx) => `Внутренняя ошибка: невалидный формат действия свёртки '${ctx.message}'.`
        );
        this.errorMessages.set(
            ErrorCode.PARSER_STACK_MISMATCH,
            (ctx) => `Внутренняя ошибка построителя таблицы: несоответствие стека при свёртке правила '${ctx.ruleText}'.`
        );
        this.errorMessages.set(
            ErrorCode.PARSER_INCOMPLETE_PARSE,
            (ctx) => `Синтаксическая ошибка: разбор завершился некорректно. ${ctx.message || ''}`
        );
        this.errorMessages.set(
            ErrorCode.PARSER_AST_STACK_ERROR,
            (ctx) => `Ошибка построения AST: ${ctx.message}`
        );


        // Построитель таблицы
        this.errorMessages.set(
            ErrorCode.BUILDER_EMPTY_GRAMMAR,
            "Грамматика не может быть пустой."
        );
        this.errorMessages.set(
            ErrorCode.BUILDER_SHIFT_REDUCE_CONFLICT,
            (ctx) => `Конфликт Shift/Reduce в состоянии '${ctx.stateName}' по символу '${ctx.offendingSymbol}'. Обнаружен Shift (${ctx.conflictingAction1}), попытка добавить Reduce (${ctx.conflictingAction2}).`
        );
        this.errorMessages.set(
            ErrorCode.BUILDER_REDUCE_REDUCE_CONFLICT,
            (ctx) => `Конфликт Reduce/Reduce в состоянии '${ctx.stateName}' по символу '${ctx.offendingSymbol}'. Обнаружен Reduce (${ctx.conflictingAction1}), попытка добавить Reduce (${ctx.conflictingAction2}).`
        );
        this.errorMessages.set(
            ErrorCode.BUILDER_START_SYMBOL_NOT_FOUND_IN_FOLLOW,
            (ctx) => `Стартовый символ '${ctx.offendingSymbol}' не найден в нетерминалах для инициализации FOLLOW-множеств.`
        );
        this.errorMessages.set(
            ErrorCode.BUILDER_INVALID_RULE_INDEX_IN_STATE_NAME,
            (ctx) => `Внутренняя ошибка: невалидный индекс правила ${ctx.offendingSymbol} извлечен из имени состояния '${ctx.stateName}'.`
        );


        // Общие
        this.errorMessages.set(
            ErrorCode.GENERAL_UNEXPECTED_ERROR,
            (ctx) => `Произошла непредвиденная ошибка: ${ctx.message || 'Нет дополнительной информации.'}`
        );
    }

    public report(error: CompilerError): void {
        this.errorCount++;
        this.collectedErrors.push(error);

        const formatter = this.errorMessages.get(error.code);
        let message: string;

        if (typeof formatter === 'function') {
            message = formatter(error.context);
        } else if (typeof formatter === 'string') {
            message = formatter;
        } else {
            message = `Неизвестный код ошибки: ${error.code}. ${error.context.message || ''}`;
        }

        let location = "";
        if (error.context.lineNumber !== undefined) {
            location = `[${error.context.lineNumber}${error.context.columnNumber !== undefined ? `:${error.context.columnNumber}` : ''}] `;
        }

        console.error(`Ошибка ${error.code}: ${location}${message}`);
    }

    public hasErrors(): boolean {
        return this.errorCount > 0;
    }

    public getErrorCount(): number {
        return this.errorCount;
    }

    public getCollectedErrors(): CompilerError[] {
        return this.collectedErrors;
    }

    // Можно добавить метод для форматирования всех собранных ошибок
    public printCollectedErrors(): void {
        if (this.collectedErrors.length === 0) {
            console.log("Ошибок не обнаружено.");
            return;
        }
        console.error(`Обнаружено ошибок: ${this.errorCount}`);
        this.collectedErrors.forEach(err => {
            // Повторно используем логику report, но без инкремента счетчика
            const formatter = this.errorMessages.get(err.code);
            let message: string;
            if (typeof formatter === 'function') {
                message = formatter(err.context);
            } else if (typeof formatter === 'string') {
                message = formatter;
            } else {
                message = `Неизвестный код ошибки: ${err.code}. ${err.context.message || ''}`;
            }
            let location = "";
            if (err.context.lineNumber !== undefined) {
                location = `[${err.context.lineNumber}${err.context.columnNumber !== undefined ? `:${err.context.columnNumber}` : ''}] `;
            }
            console.error(`  - ${err.code}: ${location}${message}`);
        });
    }
}