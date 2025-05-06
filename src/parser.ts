import {GrammarRule, Token, TransitionTable} from '@common/types'
import {Stack} from '@common/stack'
import {STATE_REDUCE, STATE_START, SYMBOL_END} from '@common/consts'
import {arrayEqual} from '@common/utils'

type StackItem = {
    symbol: string,
    state: string,
}

type ControlObj = {
    isEnd: boolean
}

class Parser {
    /** Переменные определяющие парсер, то есть он напрямую связан с токенами, таблицей, грамматикой **/
    private readonly tokens: Token[]
    private readonly table: TransitionTable
    private readonly grammar: GrammarRule[]

    /** Рабочие переменные **/
    private stack: Stack<StackItem>
    private inputQueue: string[]
    private currToken: string
    private currState: string

    /**
     * Сдвиг-сверточный парсер по SLR(1)-таблице
     * @param tokens — массив токенов, заканчивается Lexeme.GRID ('#')
     * @param table — SLR(1)-таблица переходов
     * @param grammar — список правил вида {left: string, right: string[], ruleIndex: number}
     */
    constructor(tokens: Token[],table: TransitionTable, grammar: GrammarRule[]) {
        this.tokens = tokens
        this.table = table
        this.grammar = grammar
    }

    parse(): void {
        this._initialize()

        let controlObj: ControlObj = {isEnd: false}
        while (this.inputQueue.length > 0 && !controlObj.isEnd) {
            const currAction = this._shift()

            const ruleForReduce = this._findRuleForReduce(currAction)
            if (ruleForReduce === null) {
                this.stack.push({symbol: this.currToken, state: currAction.join(' ')})
                continue
            }

            this._reduceByGrammarRule(ruleForReduce, controlObj)
        }

        this._verifyCompletedCorrectly()
    }

    /** Инициализация по параметрам конструктора парсера **/
    private _initialize() {
        this.inputQueue = this.tokens.map(token => token.lexeme)
        this.inputQueue.push(SYMBOL_END)

        this.stack = new Stack<StackItem>()
        this.stack.push({symbol: STATE_START, state: STATE_START})
    }

    /** Возвращает переход по состоянию и символу, т.е ячейку таблицы на пересечении состояния и символа **/
    private _shift(): string[] {
        this.currToken = this.inputQueue.shift()!
        this.currState = this.stack.peek()!.state

        const currAction = this.table[this.currState]?.[this.currToken]

        if (!currAction || currAction.length === 0) {
            throw new Error(`Нет перехода из состояния '${this.currState}' по токену '${this.currToken}'`)
        }

        return currAction
    }

    /** Возвращает правило для свёртки, если текущее действие - свёртка (R(n)) **/
    private _findRuleForReduce(currAction: string[]): GrammarRule | null {
        const maybeSymbolReduce = currAction[0]!
        if (maybeSymbolReduce[0] !== STATE_REDUCE) {
            return null
        }
        let ruleForReduce: GrammarRule
        const reduceGrammarIndex = maybeSymbolReduce[1]
        try {
            ruleForReduce = this.grammar[reduceGrammarIndex]
        } catch (error) {
            throw new Error(`Нет правила с индексом ${reduceGrammarIndex}`)
        }

        return ruleForReduce
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
        this.inputQueue.unshift(left)

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
            !arrayEqual(this.inputQueue, [STATE_START, SYMBOL_END])
        ) {
            throw new Error('Таблица неверно составлена: недоделанные символы/состояния')
        }
    }
}

export {
    Parser,
}