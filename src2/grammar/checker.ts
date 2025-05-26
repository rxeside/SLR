import { Grammar } from "./types";
import { EPSILON } from "../lexer/constants";

/**
 * Проверяет достижимость нетерминалов из стартового символа
 * @param grammar Грамматика для проверки
 * @returns Множество достижимых нетерминалов
 */
export function checkReachable(grammar: Grammar): Set<string> {
    const reachable = new Set<string>();
    const queue: string[] = [grammar.startSymbol];
    
    // Добавляем стартовый символ в достижимые
    reachable.add(grammar.startSymbol);
    
    // Обходим грамматику в ширину
    while (queue.length > 0) {
        const current = queue.shift()!;
        
        // Находим все правила для текущего нетерминала
        const rules = grammar.rules.filter(rule => rule.nonTerminal === current);
        
        // Для каждого правила проверяем все символы в правой части
        for (const rule of rules) {
            for (const symbol of rule.production) {
                // Если символ - нетерминал и он еще не достижим
                if (grammar.nonTerminals.has(symbol) && !reachable.has(symbol)) {
                    reachable.add(symbol);
                    queue.push(symbol);
                }
            }
        }
    }
    
    return reachable;
}

/**
 * Проверяет продуктивность нетерминалов
 * @param grammar Грамматика для проверки
 * @returns Множество продуктивных нетерминалов
 */
export function checkProductive(grammar: Grammar): Set<string> {
    const productive = new Set<string>();
    let changed = true;
    
    // Инициализация: добавляем все нетерминалы, которые могут порождать только терминалы или ε
    for (const rule of grammar.rules) {
        if (rule.production.length === 0 || // ε
            rule.production.every(symbol => grammar.terminals.has(symbol))) {
            productive.add(rule.nonTerminal);
        }
    }
    
    // Итеративно находим все продуктивные нетерминалы
    while (changed) {
        changed = false;
        
        for (const rule of grammar.rules) {
            // Если нетерминал еще не продуктивен
            if (!productive.has(rule.nonTerminal)) {
                // Проверяем, все ли символы в правой части продуктивны
                const isProductive = rule.production.every(symbol => 
                    grammar.terminals.has(symbol) || 
                    symbol === EPSILON || 
                    productive.has(symbol)
                );
                
                if (isProductive) {
                    productive.add(rule.nonTerminal);
                    changed = true;
                }
            }
        }
    }
    
    return productive;
}

/**
 * Проверяет, что все нетерминалы достижимы и продуктивны
 * @param grammar Грамматика для проверки
 * @returns Объект с результатами проверки
 */
export function checkGrammar(grammar: Grammar): {
    isReachable: boolean;
    isProductive: boolean;
    unreachable: Set<string>;
    unproductive: Set<string>;
} {
    const reachable = checkReachable(grammar);
    const productive = checkProductive(grammar);
    
    const unreachable = new Set<string>();
    const unproductive = new Set<string>();
    
    // Находим недостижимые нетерминалы
    for (const nonTerminal of grammar.nonTerminals) {
        if (!reachable.has(nonTerminal)) {
            unreachable.add(nonTerminal);
        }
    }
    
    // Находим непродуктивные нетерминалы
    for (const nonTerminal of grammar.nonTerminals) {
        if (!productive.has(nonTerminal)) {
            unproductive.add(nonTerminal);
        }
    }
    
    return {
        isReachable: unreachable.size === 0,
        isProductive: unproductive.size === 0,
        unreachable,
        unproductive
    };
}
