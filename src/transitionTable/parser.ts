import {GrammarRule, Lexeme, Token, TransitionTable} from '@common/types'
import {Stack} from '@common/stack'
import {SEPARATOR_SPACE, STATE_REDUCE, STATE_START, SYMBOL_END, SYMBOL_TILDE} from '@common/consts'
import {arrayEqual} from '@common/utils'
import {ASTNode, Identifier, Literal} from '@src/ast/entity'
import {ASTBuilder} from '@src/ast/builder'
import {SymbolTable} from '@src/symbolTable'

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
    insertionName?: string;
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
    private astStack: Stack<ASTNode | Token>
    private stack: Stack<StackItem>
    private inputQueue: QueueItem[]
    private currToken: QueueItem
    private currState: string
    
    /** Таблицы символов **/
    private symbolTable: SymbolTable

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
        
        // Инициализируем таблицы символов
        this.symbolTable = new SymbolTable()
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
                // this._handleInsertion(this.currToken)
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

        // this.astStack = new Stack<ASTNode | Token>()
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

    private _handleInsertion(shiftedTokenItem: QueueItem): void {
        const token = shiftedTokenItem.token
        switch (token.type) {
            case Lexeme.IDENTIFIER:
                this.astStack.push(new Identifier(token.lexeme))
                break
            case Lexeme.INTEGER:
                this.astStack.push(new Literal(parseInt(token.lexeme, 10)))
                break
            case Lexeme.FLOAT:
                this.astStack.push(new Literal(parseFloat(token.lexeme)))
                break
            default:
                if (token.type !== Lexeme.EOF && token.lexeme !== SYMBOL_END) {
                    if (['+', '-', '*', '/'].includes(token.lexeme)) {
                        this.astStack.push(token)
                    }
                }
                break
        }
    }

    /** Возвращает правило для свёртки, если текущее действие - свёртка (R(n) или R(n)~action) **/
    private _findRuleForReduce(currAction: string[]): ReduceInfo | null {
        const actionString = currAction[0]
        if (!actionString || actionString[0] !== STATE_REDUCE) {
            return null
        }

        let ruleIndexPart = actionString.substring(1)
        let insertionName: string | undefined = undefined
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

        if (insertionName) {
            const newNode = ASTBuilder.buildNode(insertionName, astChildren, rule);
            
            // Обработка идентификаторов и функций для таблиц символов
            this._processSymbolsForAST(insertionName, astChildren, newNode);
            
            this.astStack.push(newNode)
        } else if (astChildren.length === 1 && astChildren[0] instanceof ASTNode) {
            this.astStack.push(astChildren[0]);
        } else if (astChildren.length > 0) {
            console.warn(`Rule ${left} -> ${right.join(' ')} produced children but has no AST action. Children:`, astChildren);
            const actualAstNodes = astChildren.filter(c => c instanceof ASTNode);
            if(actualAstNodes.length === 1) {
                this.astStack.push(actualAstNodes[0]);
            } else if (actualAstNodes.length > 1) {
                console.warn(`Multiple ASTNodes [${actualAstNodes.map(n => n.constructor.name).join(', ')}] resulted from reduction of ${left} -> ${right.join(' ')} without specific action. This might lead to an invalid AST structure.`);
                this.astStack.push(actualAstNodes[0]);
            }
        }
    }

    /**
     * Обработка символов для добавления в таблицы символов
     */
    private _processSymbolsForAST(actionName: string, children: ASTChildren, node: ASTNode): void {
        switch(actionName) {
            case 'Ident':
                if (children.length === 1 && 'lexeme' in children[0]) {
                    const identName = children[0].lexeme;
                    // Add as a general identifier if not already declared in the current scope
                    // If it's a function call, it should already be declared.
                    // If it's a variable declaration, this is the place to add it.
                    if (!this.symbolTable.lookupCurrentScope(identName)) {
                         // Assuming it's a variable for now. 
                         // Function declarations will be handled by specific grammar rules and actions like 'FunctionDecl'.
                        this.symbolTable.add(identName, 'identifier');
                        console.log(`Added identifier to symbol table: ${identName}`);
                    } else {
                        console.log(`Identifier ${identName} already in symbol table or is a function.`);
                    }
                }
                break;
                
            case 'Num':
                if (children.length === 1 && 'lexeme' in children[0]) {
                    const numValue = children[0].lexeme;
                    // Adding number literal. In a real compiler, this might not be needed
                    // or handled differently (e.g., direct value in AST, not in symbol table)
                    this.symbolTable.add(`lit_${numValue}`, 'number_literal', parseFloat(numValue));
                }
                break;
            
            // Example cases for function declaration and definition
            // These actionNames ('FunctionDecl', 'FunctionDef') must match your grammar rules actions
            case 'FunctionDecl': // Example: <FuncDecl> -> type id ( <ParamsOpt> ) ~FunctionDecl
                // Assuming children are [returnTypeToken, idToken, paramsNode_or_Tokens]
                // This is a simplified example. You'll need to extract actual types and names from tokens/nodes.
                if (children.length >= 2 && 'lexeme' in children[1]) { // Expecting at least idToken
                    const funcName = children[1].lexeme;
                    const returnType = children[0] && 'lexeme' in children[0] ? children[0].lexeme : 'void'; // Simplified
                    // paramTypes would need to be extracted from children[2] (params part of the rule)
                    const paramTypes: string[] = []; // Placeholder - extract from actual AST node for params
                    this.symbolTable.add(funcName, 'function', undefined, true, paramTypes, returnType, false);
                    console.log(`Declared function: ${funcName}`);
                }
                break;

            case 'FunctionDef': // Example: <FuncDef> -> <FuncDecl> <Block> ~FunctionDef
                // Assuming children are [funcDeclNode, blockNode]
                // funcDeclNode would contain the name and signature.
                if (children.length > 0 && children[0] instanceof ASTNode && children[0].type === 'FunctionDecl') {
                    // This is highly dependent on your AST structure for FunctionDecl
                    const funcDeclNode = children[0]; // This node would have the function name, params, return type
                    // Let's assume funcDeclNode.name or similar holds the function name
                    const funcName = (funcDeclNode as any).name; // Adjust based on your ASTNode structure for FunctionDecl
                    if(funcName && typeof funcName === 'string'){
                        const existingEntry = this.symbolTable.lookup(funcName);
                        if (existingEntry && existingEntry.isFunction) {
                            this.symbolTable.add(funcName, 'function', undefined, true, existingEntry.paramTypes, existingEntry.returnType, true);
                            console.log(`Defined function: ${funcName}`);
                        }
                    } else {
                        console.error("Could not define function: name not found in FunctionDecl node.")
                    }
                }
                break;

            case 'Program':
                console.log("\n=== Parsed Program ===");
                this.symbolTable.print();
                break;
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

        for (let k = 0; k < n; k++) {
            this.stack.pop()
        }
        this.inputQueue.unshift(this.currToken)
        this.inputQueue.unshift({grammarSymbol: left, token: {} as Token})

        if (left === STATE_START) {
            controlObj.isEnd = true
        }

        // const astChildren: (ASTNode | Token)[] = [];
        // if (n > 0) { // Only pop from astStack if RHS is not empty
        //     for (let k = 0; k < n; k++) {
        //         if (this.astStack.isEmpty()) {
        //             // This can happen if a grammar symbol on RHS didn't push anything to astStack
        //             // (e.g., structural punctuation that isn't part of an AST node's data)
        //             // Or if an epsilon production is involved for one of the RHS symbols.
        //             // This needs careful grammar design.
        //             console.warn(`AST stack empty while expecting child for rule ${rule.ruleIndex}: ${left} -> ${right.join(' ')}. RHS symbol: ${right[n-1-k]}`);
        //             // Decide what to do: push a placeholder, skip, or error
        //             // For now, let's assume valid grammar pushes something or action handles it.
        //         } else {
        //             astChildren.push(this.astStack.pop()!);
        //         }
        //     }
        //     astChildren.reverse(); // Children were popped in reverse order of RHS
        // }
        // console.log(`Reduce by ${left} -> ${right.join(' ')} ~${actionName || ''}. Children from astStack:`, astChildren);

        // if (insertionName) {
        //     // const newNode = ASTBuilder.buildNode(insertionName, astChildren, rule);
        //     // console.log({newNode})
        //     // this.astStack.push(newNode);
        // } else if (astChildren.length === 1 && astChildren[0] instanceof ASTNode) {
        //     // If no action name, but RHS reduced to a single ASTNode (e.g. E -> T),
        //     // propagate that node up.
        //     this.astStack.push(astChildren[0]);
        // } else if (astChildren.length > 0) {
        //     // Multiple children but no action name. What to do?
        //     // This might be an error in grammar design for AST or an intermediate rule not meant to produce a single node.
        //     // For now, let's re-push them if they are nodes, or log a warning.
        //     // This behavior is highly dependent on the grammar and desired AST.
        //     console.warn(`Rule ${left} -> ${right.join(' ')} produced children but has no AST action. Children:`, astChildren);
        //     // A common strategy is if only one child is an ASTNode, it's passed up.
        //     // If multiple, it's often an error unless the grammar is designed for it.
        //     const actualAstNodes = astChildren.filter(c => c instanceof ASTNode);
        //     if(actualAstNodes.length === 1) {
        //         this.astStack.push(actualAstNodes[0]);
        //     } else if (actualAstNodes.length > 1) {
        //         console.warn(`Multiple ASTNodes [${actualAstNodes.map(n => n.constructor.name).join(', ')}] resulted from reduction of ${left} -> ${right.join(' ')} without specific action. This might lead to an invalid AST structure.`);
        //         // Potentially push the first one, or a list, or error.
        //         // For now, pushing the first one to avoid breaking the stack for subsequent operations.
        //         this.astStack.push(actualAstNodes[0]); // This is a guess, may need adjustment
        //     }
        // }
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

        // if (this.astStack.size() !== 1) {
        //     throw new Error(`AST стек имеет ${this.astStack.size()} элементов. Ожидался один элемент (root). AST стек: ${this.astStack.toArray()}`);
        // }
        console.log("Разбор успешно завершён!")
    }
    
    /**
     * Возвращает таблицу символов
     */
    getSymbolTable(): SymbolTable {
        return this.symbolTable;
    }
}

export {
    SLRTableParser,
    TOKEN_TYPE_TO_GRAMMAR_SYMBOL_MAP,
}