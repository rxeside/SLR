import { Token } from '@src/lexer/type'; // Или constants
import { TT, EOF_SYMBOL, EPSILON } from '@src/lexer/constants'; // Или constants
import { Grammar } from '@src/grammar/types';
import { ActionTable, GotoTable, Action, buildSLRTable } from '@src/slr/slr';
import { processGrammar } from '@src/grammar/grammar'; // Ваша функция обработки грамматики
import { AstBuilder } from '@src/ast/newAST/builder';
import { ProgramNode, AstNode, SemanticValue } from '@src/ast/newAST/nodes';

export class SLRParser {
    private grammar: Grammar;
    private actionTable: ActionTable;
    private gotoTable: GotoTable;
    private valueStack: SemanticValue[];
    private debug: boolean;

    constructor(grammarLines: string[], debug = false) {
        this.grammar = processGrammar(grammarLines); // Грамматика должна содержать actionName
        const { action, goto } = buildSLRTable(this.grammar);
        this.actionTable = action;
        this.gotoTable = goto;
        this.debug = debug;
        this.valueStack = [];
    }

    public parse(tokens: Token[]): ProgramNode | string {
        this.valueStack = [];
        const stateStack: number[] = [0];
        let tokenIndex = 0;

        const inputTokens = [...tokens];
        const lastMeaningfulToken = tokens.length > 0 ? tokens[tokens.length - 1] : undefined;
        const eofLine = lastMeaningfulToken ? lastMeaningfulToken.line : 1;
        const eofColumn = lastMeaningfulToken ? lastMeaningfulToken.column + lastMeaningfulToken.value.length : 1;

        if (inputTokens.length === 0 || inputTokens[inputTokens.length - 1].type !== TT.EOF) {
            inputTokens.push({ type: TT.EOF, value: EOF_SYMBOL, line: eofLine, column: eofColumn });
        }

        const defaultStartToken: Token = inputTokens[0]; // Первый токен или EOF, если вход пуст

        while (true) {
            const currentState = stateStack[stateStack.length - 1];
            // Гарантируем, что currentToken всегда определен, даже если tokenIndex выходит за пределы
            const currentToken = inputTokens[tokenIndex] || inputTokens[inputTokens.length -1]; // Последний (EOF)

            let actionEntry = this.actionTable.get(currentState)?.get(currentToken.type);
            // Попытка найти действие по значению для ключевых слов и специальных терминалов
            if (!actionEntry) {
                const terminalValue = currentToken.value;
                if (this.grammar.terminals.has(terminalValue)) { // Проверяем, есть ли такой терминал в грамматике
                    actionEntry = this.actionTable.get(currentState)?.get(terminalValue);
                }
            }
            // Специальная обработка для 'number', 'string', 'bool' как терминалов в Factor
            if (!actionEntry) {
                if (currentToken.type === TT.NUMBER && this.grammar.terminals.has('number')) {
                    actionEntry = this.actionTable.get(currentState)?.get('number');
                } else if (currentToken.type === TT.STRING_LITERAL && this.grammar.terminals.has('string')) {
                    actionEntry = this.actionTable.get(currentState)?.get('string');
                } else if (currentToken.type === TT.KEYWORD_TRUE || TT.KEYWORD_FALSE && this.grammar.terminals.has('bool')) {
                    actionEntry = this.actionTable.get(currentState)?.get('bool'); // 'bool' как терминал для true/false
                } else if (currentToken.type === TT.KEYWORD_TRUE || TT.KEYWORD_FALSE && this.grammar.terminals.has(currentToken.value)) { // true/false
                    actionEntry = this.actionTable.get(currentState)?.get(currentToken.value);
                }
            }


            const finalAction = actionEntry ?? { type: "error" } as Action;

            if (this.debug) {
                console.log(
                    `State: ${currentState}, Token: ${currentToken.type} ('${currentToken.value}' L${currentToken.line}C${currentToken.column}), ` +
                    `Action: ${finalAction.type}${finalAction.type === 'shift' ? ` to ${finalAction.to}` : finalAction.type === 'reduce' ? ` by rule ${finalAction.rule}` : ''}`
                );
                // console.log('Value Stack:', this.valueStack.map(v => v instanceof AstNode ? v.kind : (v instanceof Token ? `{${v.value}}` : (Array.isArray(v) ? `Arr[${v.length}]` : v ))));
            }

            if (finalAction.type === "shift") {
                stateStack.push(finalAction.to);
                this.valueStack.push(currentToken);
                tokenIndex++;
            } else if (finalAction.type === "reduce") {
                const rule = this.grammar.rules[finalAction.rule];
                // Не извлекаем для эпсилон-символов, если они есть в production
                const numToPop = rule.production.filter(s => s !== EPSILON && s !== "ε").length;

                const childrenValues: SemanticValue[] = [];
                for (let i = 0; i < numToPop; i++) {
                    if (stateStack.length === 0) {
                        return `ОШИБКА ПАРСЕРА: Попытка извлечь из пустого стека состояний при редукции правила ${rule.id}.`;
                    }
                    stateStack.pop();
                    if (this.valueStack.length === 0) {
                        return `ОШИБКА ПАРСЕРА: Попытка извлечь из пустого стека значений при редукции правила ${rule.id}. Ожидалось ${numToPop} элементов.`;
                    }
                    childrenValues.unshift(this.valueStack.pop()!);
                }

                const prevState = stateStack[stateStack.length - 1];
                const gotoState = this.gotoTable.get(prevState)?.get(rule.nonTerminal);

                if (gotoState === undefined) {
                    return `ОШИБКА ПАРСЕРА: Нет GOTO для состояния ${prevState} и нетерминала ${rule.nonTerminal}. Правило: ${rule.id} ${rule.nonTerminal} -> ${rule.production.join(' ')}. Токен: ${currentToken.value}`;
                }
                stateStack.push(gotoState);

                // Определяем defaultToken для AstBuilder из текущих children или currentToken
                const firstTokenOfRule =
                    (childrenValues.find(c => c instanceof AstNode) as AstNode)?.startToken ||
                    (childrenValues.find(c => c instanceof Token) as Token) ||
                    currentToken ||
                    defaultStartToken;

                try {
                    const newNode = AstBuilder.buildNode(rule.actionName, childrenValues, rule, firstTokenOfRule);
                    this.valueStack.push(newNode);
                } catch (e: any) {
                    return `ОШИБКА ПОСТРОЕНИЯ AST: ${e.message}`;
                }

            } else if (finalAction.type === "accept") {
                const finalAstRoot = this.valueStack.pop();
                if (finalAstRoot instanceof ProgramNode) {
                    return finalAstRoot;
                } else if (this.valueStack.length === 0 && finalAstRoot === null && this.grammar.startSymbol) {
                    // Возможно, пустая программа (Program -> ε), если грамматика это позволяет и AstBuilder возвращает ProgramNode
                    // Ваша грамматика не имеет Program -> ε, но если бы имела...
                    // const startRule = this.grammar.rules.find(r => r.nonTerminal === this.grammar.startSymbol && r.production.length === 0);
                    // if (startRule) return new ProgramNode([], defaultStartToken); // Или как обрабатывается пустая программа
                    return "ОШИБКА: Пустой стек значений после accept, ожидался ProgramNode. Возможно, входной код пуст и грамматика не обрабатывает это как ProgramNode.";
                }
                else {
                    console.error("Ошибка: после accept на стеке не ProgramNode", finalAstRoot);
                    return `ОШИБКА: Корневой узел AST не является ProgramNode, получен ${finalAstRoot?.constructor.name}.`;
                }
            } else { // Error
                let expectedTokens = [];
                const actionsForState = this.actionTable.get(currentState);
                if (actionsForState) {
                    for (const [tokenKey, act] of actionsForState.entries()) {
                        expectedTokens.push(tokenKey);
                    }
                }
                return `ОШИБКА РАЗБОРА: Неожиданный токен '${currentToken.value}' (тип: ${currentToken.type}) в строке ${currentToken.line}, колонке ${currentToken.column}. Состояние: ${currentState}. Ожидались токены типа: ${expectedTokens.join(', ')}.`;
            }
        }
    }
}