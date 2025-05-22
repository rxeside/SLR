import { SEPARATOR_SPACED_FALLOW } from "@common/consts";
import { GrammarRule } from "@common/types";

function parseGrammar(raw: string[]): GrammarRule[] {
    return raw.map((rule, index) => {
        const [left, rightPart] = rule.split(SEPARATOR_SPACED_FALLOW);
        const leftSymbol = left.trim();
// Убираем пустые строки, если есть, и разделяем по пробелам
        let rightSymbols = rightPart.trim().split(/\s+/).filter(s => s !== '');
        let semanticAction: string | undefined = undefined;
// Проверяем, есть ли семантическое действие в конце правила
        if (rightSymbols.length > 0 && rightSymbols[rightSymbols.length - 1].startsWith('~')) {
            const actionToken = rightSymbols.pop(); // Извлекаем токен действия
            if (actionToken) { // TypeScript null check
                semanticAction = actionToken.substring(1); // Удаляем тильду
            }
        }

        // Обработка пустого правила 'e' (если нужно, сейчас грамматика его не содержит)
        if (rightSymbols.length === 1 && rightSymbols[0] === 'e') {
            rightSymbols = []; // Представляем эпсилон как пустой массив
        }

        return {
            left: leftSymbol,
            right: rightSymbols, // rightSymbols теперь не содержит токен действия
            ruleIndex: index,
            semanticAction: semanticAction, // Сохраняем действие
        };
    });
}

export {
    parseGrammar
}