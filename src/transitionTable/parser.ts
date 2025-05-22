import {GrammarRule, Lexeme, Token, TransitionTable} from '@common/types'
import {Stack} from '@common/stack'
import {SEPARATOR_SPACE, STATE_REDUCE, STATE_START, SYMBOL_END, SYMBOL_TILDE} from '@common/consts'
import {arrayEqual} from '@common/utils'
import {ASTNode} from '@src/ast/entity'
import {ASTBuilder} from '@src/ast/builder'

type ASTStackItem = ASTNode | Token

type ASTChildren = ASTStackItem[]

type StackItem = {
    symbol: string,
    state: string,
}

type ControlObj = {
    isEnd: boolean
}

type QueueItem = {
    grammarSymbol: string,
    token: Token
}

type ReduceInfo = {
    rule: GrammarRule;
    insertionName: string;
};

const TOKEN_TYPE_TO_GRAMMAR_SYMBOL_MAP: Partial<Record<Lexeme, string>> = {
    [Lexeme.IDENTIFIER]: 'id',
    [Lexeme.INTEGER]: 'num',
    [Lexeme.FLOAT]: 'num',
}

class SLRTableParser {
    /** Переменные определяющие парсер, то есть он напрямую связан с токенами, таблицей, грамматикой **/
    private readonly tokens: Token[]
    private readonly table: TransitionTable
    private readonly grammar: GrammarRule[]

    /** Рабочие переменные **/
    private astStack: Stack<ASTStackItem>
    private stack: Stack<StackItem>
    private inputQueue: QueueItem[]
    private currToken: QueueItem
    private currState: string

    /**
     * Сдвиг-сверточный парсер по SLR(1)-таблице
     * @param tokens — массив токенов, заканчивается Lexeme.GRID ('#')
     * @param table — SLR(1)-таблица переходов
     * @param grammar — список правил вида {left: string, right: string[], ruleIndex: number}
     */
    constructor(tokens: Token[], table: TransitionTable, grammar: GrammarRule[]) {
        this.tokens = tokens
        this.table = table
        this.grammar = grammar
    }

    parse(): void {
        this._initialize()
        // console.log(JSON.stringify({queue: this.inputQueue}, null, 2))

        let controlObj: ControlObj = {isEnd: false}
        while (this.inputQueue.length > 0 && !controlObj.isEnd) {
            const currAction = this._shift()
            // console.log('shift ', {currAction})

            const reduceInfo = this._findRuleForReduce(currAction)
            if (reduceInfo === null) {
                this.stack.push({
                    symbol: this.currToken.grammarSymbol,
                    state: currAction.join(SEPARATOR_SPACE)
                })
                // console.log(JSON.stringify({stack: this.stack.toArray()}, null, 2))
                const shiftedToken = this.currToken.token
                if (this._isTokenSignificantForAST(shiftedToken)) {
                    this.astStack.push(shiftedToken)
                }
                // console.log({ast: this.astStack.toArray()})
                continue
            }

            this._reduceByGrammarRule(reduceInfo, controlObj)
            // console.log('reduce')
            // console.log(JSON.stringify({queue: this.inputQueue}, null, 2))
            // console.log(JSON.stringify({stack: this.stack.toArray()}, null, 2))
        }

        this._verifyCompletedCorrectly()
    }

    /** Инициализация по параметрам конструктора парсера **/
    private _initialize() {
        this.inputQueue = this.tokens.map(token => ({
            grammarSymbol: TOKEN_TYPE_TO_GRAMMAR_SYMBOL_MAP[token.type] || token.lexeme,
            token: token,
        }))
        this.inputQueue.push({
            grammarSymbol: SYMBOL_END,
            token: {type: Lexeme.EOF, lexeme: SYMBOL_END} as Token},
        )

        this.stack = new Stack<StackItem>()
        this.stack.push({symbol: STATE_START, state: STATE_START})

        this.astStack = new Stack<ASTNode | Token>()
    }

    /** Возвращает переход по состоянию и символу, т.е ячейку таблицы на пересечении состояния и символа **/
    private _shift(): string[] {
        this.currToken = this.inputQueue.shift()!
        this.currState = this.stack.peek()!.state

        const currAction = this.table[this.currState]?.[this.currToken.grammarSymbol]
        if (!currAction || currAction.length === 0) {
            throw new Error(`Нет перехода из состояния '${this.currState}' по символу '${this.currToken.grammarSymbol}' (оригинальный токен: '${this.currToken.token.lexeme}' типа ${this.currToken.token.type})`)
        }

        return currAction
    }

    /** Возвращает правило для свёртки, если текущее действие - свёртка (R(n) или R(n)~insertion) **/
    private _findRuleForReduce(currAction: string[]): ReduceInfo | null {
        const actionString = currAction[0]
        if (!actionString || actionString[0] !== STATE_REDUCE) {
            return null
        }

        let ruleIndexPart = actionString.substring(1)
        let insertionName: string
        const tildePosition = ruleIndexPart.indexOf(SYMBOL_TILDE)
        if (tildePosition !== -1) {
            insertionName = ruleIndexPart.substring(tildePosition + 1)
            ruleIndexPart = ruleIndexPart.substring(0, tildePosition)
        }

        const ruleIndex = parseInt(ruleIndexPart, 10)
        if (isNaN(ruleIndex)) {
            throw new Error(`Невалидный формат действия свёртки: ${actionString}. Не удалось извлечь индекс правила`)
        }

        const ruleForReduce = this.grammar[ruleIndex]
        if (!ruleForReduce) {
            throw new Error(`Правило грамматики с индексом ${ruleIndex} не найдено`)
        }

        return { rule: ruleForReduce, insertionName }
    }

    /** Свёртка по конкретному правилу **/
    private _reduceByGrammarRule(reduceInfo: ReduceInfo, controlObj: ControlObj) {
        const { rule } = reduceInfo
        const { left } = rule

        this._verifyCanReduce(rule)
        if (left === STATE_START) {
            controlObj.isEnd = true
        }

        const astChildren: ASTChildren = this._pop(reduceInfo)
        this._addToAST(reduceInfo, astChildren)

        this.inputQueue.unshift(this.currToken)
        this.inputQueue.unshift({grammarSymbol: left, token: {} as Token})
    }

    /** Вырезает из стека и AST-стека элементы для свёртки, элементы из AST-стека возвращает **/
    private _pop(reduceInfo: ReduceInfo): ASTChildren {
        const {rule, insertionName} = reduceInfo

        const astChildren: ASTChildren = []
        for (let k = 0; k < rule.right.length; k++) {
            const stackItem = this.stack.pop()
            if (stackItem.symbol === SYMBOL_END) {
                continue
            }
            if (this.astStack.isEmpty()) {
                throw new Error(`AST stack empty while expecting child for rule ${rule.ruleIndex}: ${rule.left} -> ${rule.right.join(' ')}. RHS symbol: ${rule.right[rule.right.length-1-k]}`)
            } else {
                astChildren.push(this.astStack.pop()!)
            }
        }
        astChildren.reverse()
        console.log(`Reduce by ${rule.left} -> ${rule.right.join(' ')} ~${insertionName || ''}. Children from astStack:`, astChildren)

        return astChildren
    }

    /** Вставка в AST **/
    private _addToAST(reduceInfo: ReduceInfo, astChildren: ASTStackItem[]) {
        const {rule, insertionName} = reduceInfo
        const {left, right} = rule

        // TODO: понять по грамматике нужны ли условия из else if
        if (insertionName) {
            const newNode = ASTBuilder.buildNode(insertionName, astChildren, rule);
            this.astStack.push(newNode)
        } else if (astChildren.length === 1 && astChildren[0] instanceof ASTNode) {
            this.astStack.push(astChildren[0]);
        } else if (astChildren.length > 0) {
            // Multiple children but no action name. What to do?
            // This might be an error in grammar design for AST or an intermediate rule not meant to produce a single node.
            // For now, let's re-push them if they are nodes, or log a warning.
            // This behavior is highly dependent on the grammar and desired AST.
            console.warn(`Rule ${left} -> ${right.join(' ')} produced children but has no AST action. Children:`, astChildren);
            // A common strategy is if only one child is an ASTNode, it's passed up.
            // If multiple, it's often an error unless the grammar is designed for it.
            const actualAstNodes = astChildren.filter(c => c instanceof ASTNode);
            if(actualAstNodes.length === 1) {
                this.astStack.push(actualAstNodes[0]);
            } else if (actualAstNodes.length > 1) {
                console.warn(`Multiple ASTNodes [${actualAstNodes.map(n => n.constructor.name).join(', ')}] resulted from reduction of ${left} -> ${right.join(' ')} without specific action. This might lead to an invalid AST structure.`);
                // Potentially push the first one, or a list, or error.
                // For now, pushing the first one to avoid breaking the stack for subsequent operations.
                this.astStack.push(actualAstNodes[0]); // This is a guess, may need adjustment
            }
        }
    }

    private _isTokenSignificantForAST(token: Token): boolean {
        if (token.type === Lexeme.EOF || token.lexeme === SYMBOL_END || token.type === undefined) {
            return false;
        }
        // Можно добавить фильтрацию ненужных токенов (запятые, точки с запятой, если они НИКОГДА не нужны билдеру)
        // const purelySyntacticLexemes = [';']; // Пример
        // if (purelySyntacticLexemes.includes(token.lexeme)) return false;
        return true;
    }

    /** Проверяет, можно ли свернуться **/
    private _verifyCanReduce(rule: GrammarRule) {
        const { right } = rule
        const stackSymbolArr: string[] = this.stack.toArray().map(item => item.symbol)
        const n = right.length

        if (n <= 0 ||
            stackSymbolArr.length < n ||
            !arrayEqual(stackSymbolArr.slice(-n), right)
        ) {
            throw new Error('Таблица неверно составлена: стек неправильно заполняется')
        }
    }

    /** Проверяет, успешно ли завершился разбор **/
    private _verifyCompletedCorrectly() {
        if (this.stack.isEmpty() ||
            this.stack.toArray().length !== 1 ||
            this.stack.toArray().map(item => item.symbol).join('') !== STATE_START ||
            this.stack.toArray().map(item => item.state).join('') !== STATE_START ||
            this.inputQueue.length !== 2 ||
            this.inputQueue[0].grammarSymbol !== STATE_START ||
            this.inputQueue[1].grammarSymbol !== SYMBOL_END
        ) {
            throw new Error('Таблица неверно составлена: недоделанные символы/состояния')
        }

        if (this.astStack.size() !== 1) {
            throw new Error(`AST стек имеет ${this.astStack.size()} элементов. Ожидался один элемент (root). AST стек: ${this.astStack.toArray()}`);
        }

        console.log("Разбор успешно завершён!")
    }
}

export {
    SLRTableParser,
}