export interface Scope {
    name: string;
    symbols: Map<string, SymbolEntry>;
    parent: Scope | null;
    children: Scope[];
    nextLocalIndex: number;
}

export interface SymbolEntry {
    name: string;
    type: string;
    value?: any;
    localIndex?: number;

    isFunction?: boolean;
    paramTypes?: string[];
    returnType?: string;
    // isFunctionDefined?: boolean; // Определяется по наличию functionBodyScope
    argCount?: number;

    definedInScope: Scope;     // Область, где СИМВОЛ (имя функции/переменной) определен
    functionBodyScope?: Scope; // Область видимости ТЕЛА функции (для символов типа 'function')
                               // Здесь будут храниться параметры и локальные переменные функции
}


export class SymbolTable {
    public currentScope: Scope;
    public globalScope: Scope;

    constructor() {
        this.globalScope = {
            name: "GLOBAL",
            symbols: new Map<string, SymbolEntry>(),
            parent: null,
            children: [],
            nextLocalIndex: 0
        };
        this.currentScope = this.globalScope;
    }

    enterScope(name: string = "anonymous_scope"): Scope { // enterScope теперь возвращает созданную область
        const newScope: Scope = {
            name,
            symbols: new Map<string, SymbolEntry>(),
            parent: this.currentScope,
            children: [],
            nextLocalIndex: 0 // Каждая новая область (особенно для функций) начинает отсчет локальных с 0
        };
        this.currentScope.children.push(newScope);
        this.currentScope = newScope;
        return newScope; // Возвращаем для возможного сохранения
    }

    exitScope(): boolean {
        if (this.currentScope.parent) {
            this.currentScope = this.currentScope.parent;
            return true;
        }
        return false;
    }

    add(
        name: string,
        type: string,
        value?: any,
        isFunction: boolean = false,
        paramTypes?: string[],
        returnType?: string,
        // isFunctionDefined: boolean = false // Убрано, определяется через functionBodyScope
    ): SymbolEntry | null {
        if (this.currentScope.symbols.has(name)) {
            // Простая проверка на повторное объявление в той же области
            // Для функций можно добавить логику перегрузки или обновления объявлений vs определений
            return null;
        }

        let localIdx: number | undefined = undefined;
        // localIndex присваивается только для переменных/параметров, не для имен функций в глобальной области
        // и только если текущая область не глобальная (для параметров и локальных переменных функций)
        if (!isFunction && this.currentScope !== this.globalScope) {
            localIdx = this.currentScope.nextLocalIndex++;
        } else if (isFunction && this.currentScope === this.globalScope) {
            // Глобальные функции не имеют localIndex в смысле слотов на стеке ВМ для аргументов,
            // но их символы хранятся в globalScope.
        }


        const entry: SymbolEntry = {
            name,
            type,
            // value, // Обычно не используется для переменных/функций на этом этапе
            localIndex: localIdx,
            isFunction: isFunction,
            paramTypes: isFunction ? (paramTypes || []) : undefined,
            returnType: isFunction ? (returnType || 'void') : undefined,
            argCount: isFunction && paramTypes ? paramTypes.length : undefined,
            definedInScope: this.currentScope,
            functionBodyScope: undefined // Будет установлено для функций в SemanticAnalyzer
        };

        this.currentScope.symbols.set(name, entry);
        return entry;
    }

    lookup(name: string): SymbolEntry | undefined {
        let scope: Scope | null = this.currentScope;
        while (scope) {
            const entry = scope.symbols.get(name);
            if (entry) {
                return entry;
            }
            scope = scope.parent;
        }
        return undefined;
    }

    lookupCurrentScope(name: string): SymbolEntry | undefined {
        return this.currentScope.symbols.get(name);
    }

    clear(): void {
        this.globalScope.symbols.clear();
        this.globalScope.children = [];
        this.globalScope.nextLocalIndex = 0;
        this.currentScope = this.globalScope;
    }

    print(): void {
        console.log("--- Symbol Table ---");
        this.printScope(this.globalScope, 0);
        console.log("--------------------");
    }

    private printScope(scope: Scope, depth: number): void {
        const indent = "  ".repeat(depth);
        console.log(`${indent}=== Scope: ${scope.name} (Parent: ${scope.parent ? scope.parent.name : 'null'}, NextLocalIdx: ${scope.nextLocalIndex}) ===`);

        if (scope.symbols.size === 0) {
            console.log(`${indent}(empty)`);
        } else {
            scope.symbols.forEach((entry) => {
                let entryString = `${indent}'${entry.name}' -> { type: '${entry.type}'`;
                if (entry.localIndex !== undefined) entryString += `, localIndex: ${entry.localIndex}`;
                entryString += `, definedInScope: ${entry.definedInScope.name}`;
                if (entry.isFunction) {
                    entryString += `, isFunction: true, return: ${entry.returnType}, params: [${entry.paramTypes?.join(', ')}]`;
                    if (entry.functionBodyScope) entryString += `, funcBodyScopeName: ${entry.functionBodyScope.name}`;
                }
                entryString += ` }`;
                console.log(entryString);
            });
        }
        for (const child of scope.children) {
            this.printScope(child, depth + 1);
        }
    }
}