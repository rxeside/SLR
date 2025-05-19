import {GrammarRule, Lexeme, Token, TransitionTable} from '@common/types'
import {Stack} from '@common/stack'
import {SEPARATOR_SPACE, STATE_REDUCE, STATE_START, SYMBOL_END, SYMBOL_TILDE} from '@common/consts'
import {arrayEqual} from '@common/utils'

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

const TOKEN_TYPE_TO_GRAMMAR_SYMBOL_MAP: Partial<Record<Lexeme, string>> = {
    [Lexeme.IDENTIFIER]: 'id',
    [Lexeme.INTEGER]: 'num',
    [Lexeme.FLOAT]: 'num',
}

class Parser {
    /** Переменные определяющие парсер, то есть он напрямую связан с токенами, таблицей, грамматикой **/
    private readonly tokens: Token[]
    private readonly table: TransitionTable
    private readonly grammar: GrammarRule[]

    /** Рабочие переменные **/
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

            const ruleForReduce = this._findRuleForReduce(currAction)
            if (ruleForReduce === null) {
                this.stack.push({
                    symbol: this.currToken.grammarSymbol,
                    state: currAction.join(SEPARATOR_SPACE)
                })
                // console.log(JSON.stringify({stack: this.stack.toArray()}, null, 2))
                continue
            }

            this._reduceByGrammarRule(ruleForReduce, controlObj)
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

    /** Возвращает правило для свёртки, если текущее действие - свёртка (R(n) или R(n)~action) **/
    private _findRuleForReduce(currAction: string[]): GrammarRule | null {
        const actionString = currAction[0];
        if (!actionString || actionString[0] !== STATE_REDUCE) {
            return null;
        }

        let ruleIndexPart = actionString.substring(1);
        const tildePosition = ruleIndexPart.indexOf(SYMBOL_TILDE);
        if (tildePosition !== -1) {
            ruleIndexPart = ruleIndexPart.substring(0, tildePosition);
        }

        const ruleIndex = parseInt(ruleIndexPart, 10);
        if (isNaN(ruleIndex)) {
            throw new Error(`Невалидный формат действия свёртки: ${actionString}. Не удалось извлечь индекс правила`);
        }

        const ruleForReduce = this.grammar[ruleIndex];
        if (!ruleForReduce) {
            throw new Error(`Правило грамматики с индексом ${ruleIndex} не найдено`);
        }

        return ruleForReduce;
    }

    /** Свёртка по конкретному правилу **/
    private _reduceByGrammarRule(ruleForReduce: GrammarRule, controlObj: ControlObj) {
        const {left, right} = ruleForReduce
        const stackSymbolArr: string[] = this.stack.toArray().map(item => item.symbol)
        const n = right.length

        if (n <= 0 ||
            stackSymbolArr.length < n ||
            !arrayEqual(stackSymbolArr.slice(-n), right)
        ) {
            throw new Error('Таблица неверно составлена: стек неправильно заполняется')
        }

        for (let k = 0; k < n; k++) {
            this.stack.pop()
        }
        this.inputQueue.unshift(this.currToken)
        this.inputQueue.unshift({grammarSymbol: left, token: {} as Token})

        if (left === STATE_START) {
            controlObj.isEnd = true
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
    }
}

export {
    Parser,
}