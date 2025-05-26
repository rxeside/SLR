import {
    AssignExpr,
    ASTNode,
    BinaryExpr,
    Block,
    ConstDecl, FuncDecl,
    Identifier,
    Literal, ParamList, ParamNode,
    Program,
    UnaryExpr,
    VarDecl,
} from '@src/ast/entity'
import {GrammarRule, Lexeme, Token} from '@common/types'

class ASTBuilder {
    static buildNode(actionName: string, children: (ASTNode | Token)[], rule: GrammarRule): ASTNode {
        console.log(`ASTBuilder.buildNode: action=${actionName}, правило: ${rule.left} -> ${rule.right.join(' ')}, дети=`, children.map(c => (c instanceof ASTNode ? c.constructor.name : (c as Token).lexeme)))

        switch (actionName) {
            case 'Program':
                // Ожидаем, что Program состоит из списка выражений/инструкций.
                // Все дочерние элементы, являющиеся ASTNode, станут частью Program.
                // Пример правила: <Z> -> <StatementList> # ~Program
                // children будет содержать [ASTNode_for_StatementList]
                const programStatements = children.filter(c => c instanceof ASTNode)
                return new Program(programStatements);

            case 'Block':
                // Блок также состоит из списка выражений/инструкций.
                // Пример правила: <Block> -> { <StatementList> } ~Block
                // children может быть: [Token_for_{, ASTNode_for_StatementList, Token_for_}]
                // или если { и } не попадают в children: [ASTNode_for_StatementList]
                const blockStatements = children.filter(c => c instanceof ASTNode)
                return new Block(blockStatements);

            case 'VarDecl':
                // Пример правила: <VarDecl> -> var id : type ; ~VarDecl
                // Или <VarDecl> -> var id : type = <Expression> ; ~VarDecl
                // children могут быть:
                // [Token_var, IdentifierNode_name, Token_colon, IdentifierNode_type, Token_semicolon]
                // [Token_var, IdentifierNode_name, Token_colon, IdentifierNode_type, Token_eq, ASTNode_initializer, Token_semicolon]
                // Важно: мы должны извлекать имена и типы из IdentifierNode или Token,
                // а инициализатор - это ASTNode.
                // Будем считать, что токены типа 'var', ':', '=', ';' отфильтровываются парсером
                // и не попадают в `children` для `_createASTNode`, либо мы их здесь отфильтруем.
                // Для простоты предположим, что в children приходят только нужные компоненты:
                // [IdentifierNode_name, IdentifierNode_type] или [IdentifierNode_name, IdentifierNode_type, ASTNode_initializer]
                // Либо, если идентификаторы для имени и типа приходят как токены:
                // [Token_name, Token_type, (ASTNode_initializer)?]

                // Более реалистичный сценарий, если парсер передает все значимые части:
                // Rule: <VarDecl> -> 'var' <id> ':' <type_id> ['=' <Expr>] ';' ~VarDecl
                // Children for 'var id : type ;': [Token(var), Identifier(id), Token(:), Identifier(type), Token(;)]
                // Children for 'var id : type = expr ;': [Token(var), Identifier(id), Token(:), Identifier(type), Token(=), ExprNode, Token(;)]

                let varNameNode: Identifier | undefined;
                let varTypeNode: Literal | undefined; // Предполагаем, что тип тоже может быть Identifier
                let varInitializer: ASTNode | undefined;

                let childIndex = 0;
                // Пропускаем токен 'var', если он есть
                if (children[childIndex] instanceof Token && (children[childIndex] as Token).type === Lexeme.VAR) {
                    childIndex++;
                }

                if (children[childIndex] instanceof Identifier) {
                    varNameNode = children[childIndex] as Identifier;
                    childIndex++;
                } else {
                    throw new Error(`VarDecl: ожидался идентификатор имени переменной. Получено: ${children[childIndex]?.constructor.name}`);
                }

                // Пропускаем токен ':'
                if (children[childIndex] instanceof Token && (children[childIndex] as Token).lexeme === ':') {
                    childIndex++;
                }

                if (children[childIndex] instanceof Literal) { // Или Literal, если тип - базовый (e.g. "int", "string")
                    varTypeNode = children[childIndex] as Literal; // Для примера используем Identifier, но может быть и Literal("int")
                    childIndex++;
                }
                else {
                    throw new Error(`VarDecl: ожидался идентификатор типа переменной. Получено: ${children[childIndex]?.constructor.name}`);
                }


                // Проверяем наличие инициализатора
                if (children[childIndex] instanceof Token && (children[childIndex] as Token).lexeme === '=') {
                    childIndex++;
                    if (children[childIndex] instanceof ASTNode) {
                        varInitializer = children[childIndex] as ASTNode;
                        childIndex++;
                    } else {
                        throw new Error(`VarDecl: ожидался ASTNode для инициализатора. Получено: ${children[childIndex]?.constructor.name}`);
                    }
                }
                // Пропускаем токен ';' , если он есть
                if (children[childIndex] instanceof Token && (children[childIndex] as Token).lexeme === ';') {
                    childIndex++;
                }

                if (!varNameNode || !varTypeNode) {
                    throw new Error(`VarDecl: не удалось извлечь имя или тип переменной из детей: ${JSON.stringify(children.map(c => c instanceof ASTNode ? c.constructor.name : c))}`);
                }

                return new VarDecl(varNameNode, varTypeNode, varInitializer);

            case 'VarDeclNoInit': {
                // Правило: <VarDecl> -> var id : <Type> ~VarDeclNoInit
                // Ожидаемые children: [Token('var'), Token('id'), Token(':'), NodeForType(Literal)]

                let varNameNode: Identifier | undefined;
                let varTypeNode: Literal | undefined; // Предполагаем, что тип тоже может быть Identifier
                let varInitializer: ASTNode | undefined = undefined;

                let childIndex = 0;
                if (children[childIndex] instanceof Token && (children[childIndex] as Token).type === Lexeme.VAR) {
                    childIndex++;
                }

                if (children[childIndex] instanceof Identifier) {
                    varNameNode = children[childIndex] as Identifier;
                    childIndex++;
                } else {
                    throw new Error(`VarDecl: ожидался идентификатор имени переменной. Получено: ${children[childIndex]?.constructor.name}`);
                }

                // Пропускаем токен ':'
                if (children[childIndex] instanceof Token && (children[childIndex] as Token).lexeme === ':') {
                    childIndex++;
                }

                if (children[childIndex] instanceof Literal) { // Или Literal, если тип - базовый (e.g. "int", "string")
                    varTypeNode = children[childIndex] as Literal; // Для примера используем Identifier, но может быть и Literal("int")
                    childIndex++;
                }
                else {
                    throw new Error(`VarDecl: ожидался идентификатор типа переменной. Получено: ${children[childIndex]?.constructor.name}`);
                }

                // Пропускаем токен ';' , если он есть
                if (children[childIndex] instanceof Token && (children[childIndex] as Token).lexeme === ';') {
                    childIndex++;
                }

                if (!varNameNode || !varTypeNode) {
                    throw new Error(`VarDecl: не удалось извлечь имя или тип переменной из детей: ${JSON.stringify(children.map(c => c instanceof ASTNode ? c.constructor.name : c))}`);
                }

                return new VarDecl(varNameNode, varTypeNode, varInitializer);
            }
            case 'ConstDecl':
                // Аналогично VarDecl, но значение обязательно.
                // Пример правила: <ConstDecl> -> const id : type = <Expression> ; ~ConstDecl
                let constNameNode: Identifier | undefined;
                let constTypeNode: Identifier | undefined; // Предполагаем, что тип тоже может быть Identifier
                let constValueNode: ASTNode | undefined;

                let constChildIndex = 0;
                // Пропускаем токен 'const'
                if (children[constChildIndex] instanceof Token && (children[constChildIndex] as Token).lexeme === 'const') {
                    constChildIndex++;
                }

                if (children[constChildIndex] instanceof Identifier) {
                    constNameNode = children[constChildIndex] as Identifier;
                    constChildIndex++;
                } else {
                    throw new Error(`ConstDecl: ожидался идентификатор имени константы.`);
                }

                // Пропускаем токен ':'
                if (children[constChildIndex] instanceof Token && (children[constChildIndex] as Token).lexeme === ':') {
                    constChildIndex++;
                }

                if (children[constChildIndex] instanceof Identifier) { // Или Literal
                    constTypeNode = children[constChildIndex] as Identifier;
                    constChildIndex++;
                } else if (children[constChildIndex] instanceof Token) {
                    constTypeNode = new Identifier((children[constChildIndex] as Token).lexeme);
                    constChildIndex++;
                } else {
                    throw new Error(`ConstDecl: ожидался идентификатор типа константы.`);
                }

                // Пропускаем токен '='
                if (children[constChildIndex] instanceof Token && (children[constChildIndex] as Token).lexeme === '=') {
                    constChildIndex++;
                } else {
                    throw new Error(`ConstDecl: ожидался токен '='.`);
                }

                if (children[constChildIndex] instanceof ASTNode) {
                    constValueNode = children[constChildIndex] as ASTNode;
                    constChildIndex++;
                } else {
                    throw new Error(`ConstDecl: ожидался ASTNode для значения константы.`);
                }

                // Пропускаем токен ';'
                if (children[constChildIndex] instanceof Token && (children[constChildIndex] as Token).lexeme === ';') {
                    constChildIndex++;
                }


                if (!constNameNode || !constTypeNode || !constValueNode) {
                    throw new Error(`ConstDecl: не удалось извлечь все компоненты из детей: ${JSON.stringify(children.map(c => c instanceof ASTNode ? c.constructor.name : c))}`);
                }
                return new ConstDecl(constNameNode, constTypeNode, constValueNode);

            case 'Func': {
                // Правило 1: <FuncDecl> -> func <Ident> ( <ParamList> ) : <Type> <Block> ~Func
                //   children: [Token(func), Ident_name, Token('('), ParamList_node, Token(')'), Token(':'), Type_node, Block_node]
                // Правило 2: <FuncDecl> -> func <Ident> ( ) : <Type> <Block> ~Func
                //   children: [Token(func), Ident_name, Token('('), Token(')'), Token(':'), Type_node, Block_node]

                let funcNameNode: Identifier | undefined;
                let paramsNode: ParamList; // Будет либо ParamList от <ParamList>, либо new ParamList([])
                let returnTypeNode: ASTNode | undefined;
                let bodyNode: Block | undefined;
                let childIdx = 0;

                // 1. Пропускаем 'func' токен, если он есть в children
                if (children[childIdx] instanceof Token && (children[childIdx] as Token).lexeme === 'func') {
                    childIdx++;
                }

                // 2. Имя функции
                if (children[childIdx] instanceof Identifier) {
                    funcNameNode = children[childIdx++] as Identifier;
                } else {
                    throw new Error(`Func: Ожидался Identifier для имени функции. Получено: ${children[childIdx]?.constructor.name}`);
                }

                // 3. Токен '('
                if (children[childIdx] instanceof Token && (children[childIdx] as Token).lexeme === '(') {
                    childIdx++;
                } else {
                    throw new Error(`Func: Ожидался токен '('. Получено: ${children[childIdx]?.constructor.name}`);
                }

                // 4. Обработка списка параметров
                if (children[childIdx] instanceof ParamList) {
                    // Это случай правила с <ParamList>
                    paramsNode = children[childIdx++] as ParamList;
                } else if (children[childIdx] instanceof Token && (children[childIdx] as Token).lexeme === ')') {
                    // Это случай правила с пустыми скобками '()'
                    paramsNode = new ParamList([]); // Создаем пустой ParamList
                    // childIdx НЕ инкрементируем здесь, ')' обработается ниже
                } else {
                    throw new Error(`Func: Ожидался ParamList или ')' для списка параметров. Получено: ${children[childIdx]?.constructor.name}`);
                }

                // 5. Токен ')'
                if (children[childIdx] instanceof Token && (children[childIdx] as Token).lexeme === ')') {
                    childIdx++;
                } else {
                    throw new Error(`Func: Ожидался токен ')' после списка параметров. Получено: ${children[childIdx]?.constructor.name}`);
                }

                // 6. Токен ':'
                if (children[childIdx] instanceof Token && (children[childIdx] as Token).lexeme === ':') {
                    childIdx++;
                } else {
                    throw new Error(`Func: Ожидался токен ':' после параметров. Получено: ${children[childIdx]?.constructor.name}`);
                }

                // 7. Тип возвращаемого значения
                if (children[childIdx] instanceof ASTNode) { // Ожидаем Literal или другой узел типа
                    returnTypeNode = children[childIdx++] as ASTNode;
                } else {
                    throw new Error(`Func: Ожидался ASTNode для типа возвращаемого значения. Получено: ${children[childIdx]?.constructor.name}`);
                }

                // 8. Тело функции
                if (children[childIdx] instanceof Block) {
                    bodyNode = children[childIdx++] as Block;
                } else {
                    throw new Error(`Func: Ожидался Block для тела функции. Получено: ${children[childIdx]?.constructor.name}`);
                }

                if (!funcNameNode || !paramsNode || !returnTypeNode || !bodyNode) {
                    throw new Error(`Func: Не удалось извлечь все компоненты функции (имя, параметры, тип возврата, тело).`);
                }
                return new FuncDecl(funcNameNode, paramsNode, returnTypeNode, bodyNode);
            }

            case 'ParamList': {
                // Правило: <ParamList> -> <Param> , <ParamList> ~ParamList
                // children: [ParamNode_first, Token(','), ParamList_rest]
                // Также нужен базовый случай для ParamList, например, <ParamList> -> <Param> ~ParamListBase
                // Если ваша грамматика *только* <ParamList> -> <Param> , <ParamList>, то она не завершится.
                // Предположим, у вас есть и базовое правило, которое тоже может вызывать ~ParamList
                // или другое действие, которое мы здесь обрабатываем.

                // Вариант 1: Это рекурсивное правило
                if (children.length === 3 &&
                    children[0] instanceof ParamNode &&
                    children[1] instanceof Token && (children[1] as Token).lexeme === ',' &&
                    children[2] instanceof ParamList) {
                    const firstParam = children[0] as ParamNode;
                    const restOfParams = children[2] as ParamList;
                    return new ParamList([firstParam, ...restOfParams.params]);
                }
                // Вариант 2: Это базовый случай, <ParamList> -> <Param> (использует то же действие ~ParamList)
                else if (children.length === 1 && children[0] instanceof ParamNode) {
                    return new ParamList([children[0] as ParamNode]);
                }
                // Вариант 3: Пустой список параметров (если бы было правило <ParamList> -> epsilon ~ParamList)
                else if (children.length === 0 && rule.right.length === 0) {
                    return new ParamList([]);
                }

                throw new Error(`ParamList: Некорректные дети для сборки списка параметров. ` +
                    `Правило: ${rule.left} -> ${rule.right.join(' ')}. Дети: ${JSON.stringify(children.map(c => c?.constructor.name))}`);
            }

            case 'Param': {
                // Правило: <Param> -> <Ident> : <Type> ~Param
                // children: [Identifier_name, Token(':'), ASTNode_type]
                // (Токен ':' может быть или не быть в children в зависимости от _isTokenSignificantForAST)

                let paramNameNode: Identifier | undefined;
                let paramTypeNode: ASTNode | undefined;
                let childIdx = 0;

                // 1. Имя параметра
                if (children[childIdx] instanceof Identifier) {
                    paramNameNode = children[childIdx++] as Identifier;
                } else {
                    throw new Error(`Param: Ожидался Identifier для имени параметра. Получено: ${children[childIdx]?.constructor.name}`);
                }

                // 2. Токен ':' (если он есть в children)
                if (childIdx < children.length && children[childIdx] instanceof Token && (children[childIdx] as Token).lexeme === ':') {
                    childIdx++;
                }
                // Если ':' всегда отфильтровывается, эту проверку можно убрать,
                // но тогда нужно быть уверенным в индексах.

                // 3. Тип параметра
                if (childIdx < children.length && children[childIdx] instanceof ASTNode) {
                    paramTypeNode = children[childIdx++] as ASTNode;
                } else {
                    // Эта ошибка сработает, если ':' был, но типа нет, или если ':' не было и второго элемента тоже нет.
                    throw new Error(`Param: Ожидался ASTNode для типа параметра. Получено: ${children[childIdx]?.constructor.name}`);
                }


                if (!paramNameNode || !paramTypeNode) {
                    throw new Error(`Param: Не удалось извлечь имя или тип параметра.`);
                }
                return new ParamNode(paramNameNode, paramTypeNode);
            }

            // Для <Block> -> { }
            // Если у вас есть специальное действие ~EmptyBlock:
            case 'EmptyBlock': // Предполагаемое действие для <Block> -> { } ~EmptyBlock
                // children могут быть [Token('{'), Token('}')] или []
                if ((children.length === 2 && children[0] instanceof Token && (children[0] as Token).lexeme === '{' && children[1] instanceof Token && (children[1] as Token).lexeme === '}')
                    || (children.length === 0 && rule.right.length === 0) // Для { } где токены отфильтрованы
                    || (children.length === 0 && rule.right.length === 2 && rule.right[0] === '{' && rule.right[1] === '}')) // Для { } где токены были, но не попали в children
                {
                    return new Block([]);
                }
                // Если правило <Block> -> { } использует общее действие ~Block, то:
                // существующий case 'Block' должен это обработать:
                // const blockStatements = children.filter(c => c instanceof ASTNode);
                // return new Block(blockStatements); // Если children пуст (или содержит только токены), blockStatements будет []
                throw new Error(`EmptyBlock: Некорректные дети для пустого блока. Дети: ${JSON.stringify(children.map(c => c?.constructor.name))}`);


            // Существующий case 'Block' для <Block> -> { <StmtList> } ~Block
            case 'Block': {
                // children: [Token('{'), StmtList_node, Token('}')] или [StmtList_node]
                // или для <Block> -> { } ~Block :  [Token('{'), Token('}')] или []
                const blockStatements = children.filter(c => c instanceof ASTNode);
                // Если это был пустой блок и ~Block, то blockStatements будет []
                return new Block(blockStatements);
            }

            case 'AssignExpr':
                // <AssignExpr> -> id = <Expression> ~AssignExpr (возможно, с ';' в конце)
                // children: [IdentifierNode_name, Token_eq, ASTNode_value]
                if (children.length >= 3 &&
                    children[0] instanceof Identifier &&
                    (children[1] instanceof Token && (children[1] as Token).lexeme === '=') &&
                    children[2] instanceof ASTNode) {
                    return new AssignExpr(children[0] as Identifier, children[2] as ASTNode);
                }
                throw new Error(`Invalid children for AssignExpr action.`);

            case 'BinaryExpr':
                // <Expr> -> <Expr> + <Term> ~BinaryExpr
                // children: [ASTNode_left, Token_operator, ASTNode_right]
                if (children.length === 3 &&
                    children[0] instanceof ASTNode &&
                    children[1] instanceof Token &&
                    children[2] instanceof ASTNode) {
                    const left = children[0] as ASTNode;
                    const operator = (children[1] as Token).lexeme;
                    const right = children[2] as ASTNode;
                    return new BinaryExpr(left, operator, right);
                }
                throw new Error(
                    `Invalid children for BinaryExpr action. Rule: ${rule.left} -> ${rule.right.join(' ')}. Children: ${JSON.stringify(children.map(c => c instanceof ASTNode ? c.constructor.name : (c as Token).lexeme))}`
                );

            case 'UnaryExpr':
                // <UnaryExpr> -> - <Factor> ~UnaryExpr  ИЛИ ! <Factor> ~UnaryExpr
                // children: [Token_operator, ASTNode_operand]
                if (children.length === 2 &&
                    children[0] instanceof Token &&
                    children[1] instanceof ASTNode) {
                    return new UnaryExpr((children[0] as Token).lexeme, children[1] as ASTNode);
                }
                throw new Error(`Invalid children for UnaryExpr action.`);

            // case 'CallExpr':
            //     // <CallExpr> -> id ( <ArgList> ) ~CallExpr
            //     // children: [IdentifierNode_callee, Token_(, ASTNode_for_ArgList?, Token_)]
            //     // ASTNode_for_ArgList может быть специальным узлом или просто массивом ASTNode.
            //     // Для простоты будем считать, что ArgList - это массив ASTNode.
            //     let calleeNode!: Identifier;
            //     const callArgs: ASTNode[] = [];
            //     let callChildIndex = 0;
            //
            //     if (children[callChildIndex] instanceof Identifier) {
            //         calleeNode = children[callChildIndex++] as Identifier;
            //     } else throw new Error("CallExpr: Ожидался идентификатор для вызываемой функции.");
            //
            //     // Пропускаем '('
            //     if (children[callChildIndex] instanceof Token && (children[callChildIndex] as Token).lexeme === '(') callChildIndex++;
            //     else throw new Error("CallExpr: Ожидался токен '('.");
            //
            //     // Собираем аргументы
            //     // Аргументы - это ASTNode, разделенные запятыми
            //     while (!(children[callChildIndex] instanceof Token && (children[callChildIndex] as Token).lexeme === ')')) {
            //         if (children[callChildIndex] instanceof ASTNode) {
            //             callArgs.push(children[callChildIndex++] as ASTNode);
            //         } else {
            //             // Если аргументов нет и сразу ')', то это нормально
            //             if (children[callChildIndex] instanceof Token && (children[callChildIndex] as Token).lexeme === ')') break;
            //             throw new Error(`CallExpr: Неожиданный элемент в списке аргументов: ${children[callChildIndex]?.constructor.name}`);
            //         }
            //
            //         if (children[callChildIndex] instanceof Token && (children[callChildIndex] as Token).lexeme === ',') {
            //             callChildIndex++; // Пропускаем запятую
            //         } else if (!(children[callChildIndex] instanceof Token && (children[callChildIndex] as Token).lexeme === ')')) {
            //             throw new Error("CallExpr: Ожидалась ',' или ')' после аргумента.");
            //         }
            //     }
            //     // Пропускаем ')'
            //     if (children[callChildIndex] instanceof Token && (children[callChildIndex] as Token).lexeme === ')') callChildIndex++;
            //     else throw new Error("CallExpr: Ожидался токен ')'.");
            //
            //     return new CallExpr(calleeNode.name, callArgs);

            case 'TypeNumber':
                if (children.length === 1 && children[0] instanceof Token && (children[0] as Token).type === Lexeme.NUMBER_TYPE) {
                    return new Literal("number");
                }
                throw new Error(`TypeNumber: Ожидался токен 'number'. Получено: ${JSON.stringify(children)}`);

            case 'TypeBoolean':
                if (children.length === 1 && children[0] instanceof Token && (children[0] as Token).type === Lexeme.BOOLEAN_TYPE) {
                    return new Literal("boolean");
                }
                throw new Error(`TypeBoolean: Ожидался токен 'boolean'. Получено: ${JSON.stringify(children)}`);

            case 'TypeString':
                if (children.length === 1 && children[0] instanceof Token && (children[0] as Token).type === Lexeme.STRING_TYPE) {
                    return new Literal("string");
                }
                throw new Error(`TypeString: Ожидался токен 'string'. Получено: ${JSON.stringify(children)}`);

            case 'TypeNull':
                if (children.length === 1 && children[0] instanceof Token && (children[0] as Token).type === Lexeme.NULL_TYPE) {
                    return new Literal("null");
                }
                throw new Error(`TypeNull: Ожидался токен 'null'. Получено: ${JSON.stringify(children)}`);

            case 'Literal':
                if (children.length === 1 && children[0] instanceof Token) {
                    const token = children[0] as Token;
                    if (token.type === Lexeme.INTEGER) return new Literal(parseInt(token.lexeme, 10));
                    if (token.type === Lexeme.FLOAT) return new Literal(parseFloat(token.lexeme));
                    if (token.type === Lexeme.STRING_L) return new Literal(token.lexeme);
                    if (token.type === Lexeme.TRUE) return new Literal(true);
                    if (token.type === Lexeme.FALSE) return new Literal(false);
                    if (token.lexeme === 'null') return new Literal(null);
                }
                throw new Error(`Invalid children for Literal action. Expected LiteralNode or a value Token. Got: ${JSON.stringify(children)}`);
            case 'Ident':
                if (children.length === 1 && children[0] instanceof Token && (children[0] as Token).type === Lexeme.IDENTIFIER) {
                    return new Identifier((children[0] as Token).lexeme);
                }
                throw new Error(`Invalid children for Identifier action. Expected Identifier Token. Got: ${JSON.stringify(children)}`);

            // case 'IfStmt':
            //     // <IfStmt> -> if <Expr> then <Block> [elif <Expr> then <Block>]* [else <Block>]? end ~IfStmt
            //     // Это сложный случай, т.к. elif и else опциональны и elif может быть несколько.
            //     // children: [Token(if), ASTNode_cond, Token(then), Block_then, (Token(elif), ASTNode_cond, Token(then), Block_elif)*, (Token(else), Block_else)?, Token(end)]
            //
            //     let ifCondition!: ASTNode;
            //     let ifThenBranch!: Block;
            //     const elifBranches: { condition: ASTNode, block: Block }[] = [];
            //     let ifElseBranch: Block | undefined;
            //
            //     let ifStmtChildIndex = 0;
            //
            //     // 'if'
            //     if (children[ifStmtChildIndex] instanceof Token && (children[ifStmtChildIndex] as Token).lexeme === 'if') ifStmtChildIndex++;
            //     else throw new Error("IfStmt: Ожидался токен 'if'.");
            //
            //     if (children[ifStmtChildIndex] instanceof ASTNode) {
            //         ifCondition = children[ifStmtChildIndex++] as ASTNode;
            //     } else throw new Error("IfStmt: Ожидался ASTNode для условия if.");
            //
            //     // 'then'
            //     if (children[ifStmtChildIndex] instanceof Token && (children[ifStmtChildIndex] as Token).lexeme === 'then') ifStmtChildIndex++;
            //     else throw new Error("IfStmt: Ожидался токен 'then'.");
            //
            //
            //     if (children[ifStmtChildIndex] instanceof Block) {
            //         ifThenBranch = children[ifStmtChildIndex++] as Block;
            //     } else throw new Error("IfStmt: Ожидался Block для then-ветки.");
            //
            //     // Elif ветки
            //     while (children[ifStmtChildIndex] instanceof Token && (children[ifStmtChildIndex] as Token).lexeme === 'elif') {
            //         ifStmtChildIndex++; // 'elif'
            //
            //         let elifCondition!: ASTNode;
            //         let elifBlock!: Block;
            //
            //         if (children[ifStmtChildIndex] instanceof ASTNode) {
            //             elifCondition = children[ifStmtChildIndex++] as ASTNode;
            //         } else throw new Error("IfStmt: Ожидался ASTNode для условия elif.");
            //
            //         // 'then' для elif
            //         if (children[ifStmtChildIndex] instanceof Token && (children[ifStmtChildIndex] as Token).lexeme === 'then') ifStmtChildIndex++;
            //         else throw new Error("IfStmt: Ожидался токен 'then' для elif.");
            //
            //
            //         if (children[ifStmtChildIndex] instanceof Block) {
            //             elifBlock = children[ifStmtChildIndex++] as Block;
            //         } else throw new Error("IfStmt: Ожидался Block для elif-ветки.");
            //         elifBranches.push({ condition: elifCondition, block: elifBlock });
            //     }
            //
            //     // Else ветка
            //     if (children[ifStmtChildIndex] instanceof Token && (children[ifStmtChildIndex] as Token).lexeme === 'else') {
            //         ifStmtChildIndex++; // 'else'
            //         if (children[ifStmtChildIndex] instanceof Block) {
            //             ifElseBranch = children[ifStmtChildIndex++] as Block;
            //         } else throw new Error("IfStmt: Ожидался Block для else-ветки.");
            //     }
            //
            //     // 'end' (или 'fi' в некоторых языках)
            //     if (children[ifStmtChildIndex] instanceof Token && (children[ifStmtChildIndex] as Token).lexeme === 'end') ifStmtChildIndex++;
            //     // else throw new Error("IfStmt: Ожидался токен 'end'."); // Может быть не нужен, если `end` не часть правила АСД
            //
            //     return new IfStmt(ifCondition, ifThenBranch, elifBranches, ifElseBranch);
            //
            // case 'WhileStmt':
            //     // <WhileStmt> -> while <Expr> do <Block> end ~WhileStmt
            //     // children: [Token(while), ASTNode_cond, Token(do), Block_body, Token(end)]
            //     let whileCondition!: ASTNode;
            //     let whileBody!: Block;
            //     let whileChildIndex = 0;
            //
            //     if (children[whileChildIndex] instanceof Token && (children[whileChildIndex] as Token).lexeme === 'while') whileChildIndex++;
            //     else throw new Error("WhileStmt: Ожидался токен 'while'.");
            //
            //     if (children[whileChildIndex] instanceof ASTNode) {
            //         whileCondition = children[whileChildIndex++] as ASTNode;
            //     } else throw new Error("WhileStmt: Ожидался ASTNode для условия while.");
            //
            //     if (children[whileChildIndex] instanceof Token && (children[whileChildIndex] as Token).lexeme === 'do') whileChildIndex++;
            //     else throw new Error("WhileStmt: Ожидался токен 'do'.");
            //
            //     if (children[whileChildIndex] instanceof Block) {
            //         whileBody = children[whileChildIndex++] as Block;
            //     } else throw new Error("WhileStmt: Ожидался Block для тела while.");
            //
            //     // Token(end)
            //     if (children[whileChildIndex] instanceof Token && (children[whileChildIndex] as Token).lexeme === 'end') whileChildIndex++;
            //     // else throw new Error("WhileStmt: Ожидался токен 'end'.");
            //
            //     return new WhileStmt(whileCondition, whileBody);
            //
            // case 'ForStmt':
            //     // <ForStmt> -> for ( <InitExpr>? ; <CondExpr>? ; <UpdateExpr>? ) <Block> ~ForStmt
            //     // children: [Token(for), Token('('), ASTNode_init?, Token(;), ASTNode_cond?, Token(;), ASTNode_update?, Token(')'), Block_body]
            //     // Любая из частей init, condition, update может быть null.
            //     let forInit: ASTNode | null = null;
            //     let forCondition: ASTNode | null = null;
            //     let forUpdate: ASTNode | null = null;
            //     let forBody!: Block;
            //     let forChildIndex = 0;
            //
            //     if (children[forChildIndex] instanceof Token && (children[forChildIndex] as Token).lexeme === 'for') forChildIndex++;
            //     else throw new Error("ForStmt: Ожидался токен 'for'.");
            //
            //     if (children[forChildIndex] instanceof Token && (children[forChildIndex] as Token).lexeme === '(') forChildIndex++;
            //     else throw new Error("ForStmt: Ожидался токен '('.");
            //
            //     // Init
            //     if (!(children[forChildIndex] instanceof Token && (children[forChildIndex] as Token).lexeme === ';')) {
            //         if (children[forChildIndex] instanceof ASTNode) {
            //             forInit = children[forChildIndex++] as ASTNode;
            //         } else throw new Error("ForStmt: Ожидался ASTNode или ';' для инициализации.");
            //     }
            //     if (children[forChildIndex] instanceof Token && (children[forChildIndex] as Token).lexeme === ';') forChildIndex++;
            //     else throw new Error("ForStmt: Ожидался токен ';' после инициализации.");
            //
            //     // Condition
            //     if (!(children[forChildIndex] instanceof Token && (children[forChildIndex] as Token).lexeme === ';')) {
            //         if (children[forChildIndex] instanceof ASTNode) {
            //             forCondition = children[forChildIndex++] as ASTNode;
            //         } else throw new Error("ForStmt: Ожидался ASTNode или ';' для условия.");
            //     }
            //     if (children[forChildIndex] instanceof Token && (children[forChildIndex] as Token).lexeme === ';') forChildIndex++;
            //     else throw new Error("ForStmt: Ожидался токен ';' после условия.");
            //
            //     // Update
            //     if (!(children[forChildIndex] instanceof Token && (children[forChildIndex] as Token).lexeme === ')')) {
            //         if (children[forChildIndex] instanceof ASTNode) {
            //             forUpdate = children[forChildIndex++] as ASTNode;
            //         } else throw new Error("ForStmt: Ожидался ASTNode или ')' для обновления.");
            //     }
            //
            //     if (children[forChildIndex] instanceof Token && (children[forChildIndex] as Token).lexeme === ')') forChildIndex++;
            //     else throw new Error("ForStmt: Ожидался токен ')'.");
            //
            //     if (children[forChildIndex] instanceof Block) {
            //         forBody = children[forChildIndex++] as Block;
            //     } else throw new Error("ForStmt: Ожидался Block для тела for.");
            //
            //     return new ForStmt(forInit, forCondition, forUpdate, forBody);

            // Случаи 'Ident' и 'Num' уже были, но переименую 'Num' в 'Literal' для общего случая,
            // если вы не сделали этого в парсере при вызове _createASTNode (SLRTableParser.ts)
            case 'Num':
                if (children.length === 1 && children[0] instanceof Token &&
                    ((children[0] as Token).type === Lexeme.INTEGER || (children[0] as Token).type === Lexeme.FLOAT)) {
                    const tokenVal = (children[0] as Token).lexeme;
                    const numVal = (children[0] as Token).type === Lexeme.INTEGER ? parseInt(tokenVal, 10) : parseFloat(tokenVal);
                    return new Literal(numVal);
                }
                throw new Error(`Invalid children for Num action. Expected LiteralNode or Number Token. Got: ${JSON.stringify(children)}`);

            default:
                throw new Error(`Неизвестное имя действия АСД: ${actionName}`);
        }
    }
}

export {
    ASTBuilder,
}