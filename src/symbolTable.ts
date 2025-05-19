export interface SymbolEntry {
    name: string;       // Имя идентификатора (лексема)
    type: string;       // Тип символа (например, 'identifier', 'number_literal', 'keyword')
    value?: any;        // Значение (для литералов или инициализированных переменных/констант)
    // TODO: Добавить атрибуты для строки и области видимости ?
    // lineDeclared?: number; // Строка, где объявлен символ
    // scope?: string;        // Область видимости (пока не используется)
}

export class SymbolTable {
    private table: Map<string, SymbolEntry>;

    constructor() {
        this.table = new Map<string, SymbolEntry>();
    }

    /**
     * Добавляет новый символ в таблицу.
     * @param name Имя символа (идентификатор).
     * @param type Тип символа.
     * @param value (Опционально) Значение символа.
     * @returns Добавленную запись SymbolEntry или null, если символ уже существует.
     */
    add(name: string, type: string, value?: any): SymbolEntry | null {
        if (this.table.has(name)) {
            // TODO: В будущем здесь можно будет обрабатывать переопределение в зависимости от правил языка
            // или области видимости. Пока что просто логирование
            console.error(`Error: Symbol '${name}' already declared in the current scope.`);
            return null;
        }
        const entry: SymbolEntry = { name, type, value };
        this.table.set(name, entry);
        return entry;
    }

    /**
     * Ищет символ в таблице по имени.
     * @param name Имя символа для поиска.
     * @returns Найденную запись SymbolEntry или undefined, если символ не найден.
     */
    lookup(name: string): SymbolEntry | undefined {
        return this.table.get(name);
    }

    /**
     * Очищает таблицу символов.
     */
    clear(): void {
        this.table.clear();
    }

    /**
     * print
     */
    print(): void {
        if (this.table.size === 0) {
            console.log("Symbol Table is empty.");
            return;
        }
        console.log("--- Symbol Table ---");
        this.table.forEach((entry, name) => {
            console.log(`'${name}' -> { type: '${entry.type}', value: ${entry.value !== undefined ? entry.value : '(none)'} }`);
        });
        console.log("--------------------");
    }
} 