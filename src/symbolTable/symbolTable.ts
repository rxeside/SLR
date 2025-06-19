export interface SymbolEntry {
    name: string;           
    type: string;           
    value?: any;           
    localIndex: number;    
    address?: number;      
    
    isFunction?: boolean;       
    paramTypes?: string[];      
    returnType?: string;        
    isFunctionDefined?: boolean;
    argCount?: number;         
}

interface Scope {
    name: string;
    symbols: Map<string, SymbolEntry>;
    parent: Scope | null;
    children: Scope[];
}

export class SymbolTable {
    private currentScope: Scope;
    private globalScope: Scope;

    constructor() {
        this.globalScope = {
            name: "GLOBAL",
            symbols: new Map<string, SymbolEntry>(),
            parent: null,
            children: []
        };
        this.currentScope = this.globalScope;
    }

    enterScope(name: string = "anonymous"): void {
        const newScope: Scope = {
            name,
            symbols: new Map<string, SymbolEntry>(),
            parent: this.currentScope,
            children: []
        };
        this.currentScope.children.push(newScope);
        this.currentScope = newScope;
    }

    exitScope(): boolean {
        if (this.currentScope === this.globalScope) {
            return false;
        }
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
        isFunctionDefined: boolean = false
    ): SymbolEntry | null {
        // Проверяем существование символа ТОЛЬКО в текущей области видимости
        const existingEntry = this.currentScope.symbols.get(name);

        if (existingEntry) {
            if (existingEntry.isFunction && isFunction) {
                if (existingEntry.isFunctionDefined && isFunctionDefined) {
                    return null;
                }
                existingEntry.isFunctionDefined = existingEntry.isFunctionDefined || isFunctionDefined;
                if (paramTypes) {
                    existingEntry.paramTypes = paramTypes;
                    existingEntry.argCount = paramTypes.length;
                }
                if (returnType) existingEntry.returnType = returnType;
                return existingEntry;
            } else {
                return null;
            }
        }

        const entry: SymbolEntry = {
            name,
            type,
            value,
            localIndex: this.getNextLocalIndex(this.currentScope),
            isFunction: isFunction || false,
            paramTypes: isFunction ? (paramTypes || []) : undefined,
            returnType: isFunction ? (returnType || 'void') : undefined,
            isFunctionDefined: isFunction ? (isFunctionDefined || false) : undefined,
            argCount: isFunction && paramTypes ? paramTypes.length : undefined
        };

        // Добавляем символ ТОЛЬКО в текущую область видимости
        this.currentScope.symbols.set(name, entry);
        return entry;
    }

    lookupGlobal(name: string): SymbolEntry | undefined {
        // Ищем ТОЛЬКО в глобальной области видимости
        return this.globalScope.symbols.get(name);
    }

    lookup(name: string): SymbolEntry | undefined {
        // Сначала ищем в текущей области видимости
        const entry = this.currentScope.symbols.get(name);
        if (entry) {
            return entry;
        }

        // Если не нашли и есть родительская область, ищем рекурсивно вверх по цепочке
        let scope = this.currentScope.parent;
        while (scope) {
            const parentEntry = scope.symbols.get(name);
            if (parentEntry) {
                return parentEntry;
            }
            scope = scope.parent;
        }

        return undefined;
    }

    lookupCurrentScope(name: string): SymbolEntry | undefined {
        // Ищем ТОЛЬКО в текущей области видимости
        return this.currentScope.symbols.get(name);
    }

    resolve(name: string): { entry: SymbolEntry; depth: number, scope: Scope } | undefined {
        let depth = 0;
        let scope = this.currentScope;
        while (scope) {
            const entry = scope.symbols.get(name);
            if (entry) {
                return { entry, depth, scope };
            }
            if (scope === this.globalScope) break;
            scope = scope.parent;
            depth++;
        }
        return undefined;
    }

    getGlobalScope(): Scope {
        return this.globalScope;
    }

    private getNextLocalIndex(scope: Scope): number {
        let maxIndex = -1;
        for (const entry of scope.symbols.values()) {
            if (!entry.isFunction && entry.localIndex !== undefined) {
                maxIndex = Math.max(maxIndex, entry.localIndex);
            }
        }
        return maxIndex + 1;
    }

    clear(): void {
        this.globalScope.symbols.clear();
        this.globalScope.children = [];
        this.currentScope = this.globalScope;
    }

    print(): void {
        console.log("--- Symbol Table ---");
        this.printScope(this.globalScope, 0);
        console.log("--------------------");
    }

    private printScope(scope: Scope, depth: number): void {
        const indent = "  ".repeat(depth);
        console.log(`${indent}=== ${scope.name} ===`);
        
        if (scope.symbols.size === 0) {
            console.log(`${indent}(empty)`);
        } else {
            scope.symbols.forEach((entry, name) => {
                let entryString = `${indent}'${name}' -> { type: '${entry.type}', index: ${entry.localIndex}`;
                
                if (entry.value !== undefined) {
                    entryString += `, value: ${entry.value}`;
                }
                
                if (entry.isFunction) {
                    entryString += `, returnType: ${entry.returnType || 'void'}`;
                    entryString += `, params: [${entry.paramTypes ? entry.paramTypes.join(', ') : ''}]`;
                    entryString += `, argCount: ${entry.argCount}`;
                    if (entry.address !== undefined) {
                        entryString += `, address: ${entry.address}`;
                    }
                    entryString += `, defined: ${entry.isFunctionDefined}`;
                }
                
                entryString += ` }`;
                console.log(entryString);
            });
        }

        // Recursively print child scopes
        for (const child of scope.children) {
            this.printScope(child, depth + 1);
        }
    }
} 