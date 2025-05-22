import {
    ASTNode,
    Program,
    Block,
    VarDecl,
    ConstDecl,
    FuncDecl,
    Param,
    AssignExpr,
    BinaryExpr,
    UnaryExpr,
    CallExpr,
    Literal,
    Identifier,
    IfStmt,
    WhileStmt,
    ForStmt,
} from '@src/ast/entity'
import {GrammarRule, Token, Lexeme, Position} from '@common/types'

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
                let varTypeNode: Identifier | undefined; // Предполагаем, что тип тоже может быть Identifier
                let varInitializer: ASTNode | undefined;

                let childIndex = 0;
                // Пропускаем токен 'var', если он есть
                if (children[childIndex] instanceof Token && (children[childIndex] as Token).lexeme === 'var') {
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

                if (children[childIndex] instanceof Identifier) { // Или Literal, если тип - базовый (e.g. "int", "string")
                    varTypeNode = children[childIndex] as Identifier; // Для примера используем Identifier, но может быть и Literal("int")
                    childIndex++;
                } else if (children[childIndex] instanceof Token) { // Если тип это просто строковый токен
                    varTypeNode = new Identifier((children[childIndex] as Token).lexeme); // Оборачиваем в Identifier для консистентности с AST
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

                return new VarDecl(varNameNode.name, varTypeNode.name, varInitializer);


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
                return new ConstDecl(constNameNode.name, constTypeNode.name, constValueNode);

            // case 'FuncDecl':
            //     // <FuncDecl> -> func id ( <ParamList> ) : <type_id> <Block> ~FuncDecl
            //     // children: [Token(func), Identifier(name), Token('('), ASTNode_for_ParamList?, Token(')'), Token(:), Identifier(returnType), BlockNode_body]
            //     // ASTNode_for_ParamList может быть специальным узлом или массивом Param объектов.
            //     // Для простоты предположим, что ParamList - это массив Param объектов, которые мы соберем здесь.
            //     // Или что ParamList - это один ASTNode, который содержит массив Param (напр. new ParamList(...))
            //
            //     let funcNameNode!: Identifier;
            //     const funcParams: Param[] = [];
            //     let funcReturnTypeNode!: Identifier; // Или Literal для базовых типов
            //     let funcBodyNode!: Block;
            //
            //     let funcChildIndex = 0;
            //
            //     // Пропускаем 'func'
            //     if (children[funcChildIndex] instanceof Token && (children[funcChildIndex] as Token).lexeme === 'func') funcChildIndex++;
            //
            //     if (children[funcChildIndex] instanceof Identifier) {
            //         funcNameNode = children[funcChildIndex++] as Identifier;
            //     } else throw new Error("FuncDecl: Ожидался идентификатор имени функции.");
            //
            //     // Пропускаем '('
            //     if (children[funcChildIndex] instanceof Token && (children[funcChildIndex] as Token).lexeme === '(') funcChildIndex++;
            //     else throw new Error("FuncDecl: Ожидался токен '('.");
            //
            //     // Собираем параметры
            //     // Предположим, параметры идут как [Identifier(name), Token(:), Identifier(type), Token(,), ...]
            //     // Либо у вас может быть правило <ParamList> -> <Param> | <Param> , <ParamList>
            //     // И дети для ParamList будут уже [ParamNode1, ParamNode2, ...]
            //     // Для примера, если параметры передаются как отдельные узлы Param:
            //     while (!(children[funcChildIndex] instanceof Token && (children[funcChildIndex] as Token).lexeme === ')')) {
            //         if (children[funcChildIndex] instanceof Param) { // Если Param это уже ASTNode
            //             funcParams.push(children[funcChildIndex++] as Param);
            //         }
            //         // Если параметры приходят как (name: Identifier, type: Identifier)
            //         else if (children[funcChildIndex] instanceof Identifier &&
            //             children[funcChildIndex+1] instanceof Token && (children[funcChildIndex+1] as Token).lexeme === ':' &&
            //             children[funcChildIndex+2] instanceof Identifier) {
            //             const paramName = (children[funcChildIndex] as Identifier).name;
            //             const paramType = (children[funcChildIndex+2] as Identifier).name;
            //             funcParams.push(new Param(paramName, paramType));
            //             funcChildIndex += 3;
            //         }
            //         else {
            //             // Если параметров нет, и сразу идет ')', то это нормально.
            //             if (children[funcChildIndex] instanceof Token && (children[funcChildIndex] as Token).lexeme === ')') break;
            //             throw new Error(`FuncDecl: Неожиданный элемент в списке параметров: ${children[funcChildIndex]?.constructor.name}`);
            //         }
            //
            //         if (children[funcChildIndex] instanceof Token && (children[funcChildIndex] as Token).lexeme === ',') {
            //             funcChildIndex++; // Пропускаем запятую
            //         } else if (!(children[funcChildIndex] instanceof Token && (children[funcChildIndex] as Token).lexeme === ')')) {
            //             throw new Error("FuncDecl: Ожидалась ',' или ')' после параметра.");
            //         }
            //     }
            //     // Пропускаем ')'
            //     if (children[funcChildIndex] instanceof Token && (children[funcChildIndex] as Token).lexeme === ')') funcChildIndex++;
            //     else throw new Error("FuncDecl: Ожидался токен ')'.");
            //
            //     // Пропускаем ':'
            //     if (children[funcChildIndex] instanceof Token && (children[funcChildIndex] as Token).lexeme === ':') funcChildIndex++;
            //     else throw new Error("FuncDecl: Ожидался токен ':'.");
            //
            //     if (children[funcChildIndex] instanceof Identifier) { // Или Literal
            //         funcReturnTypeNode = children[funcChildIndex++] as Identifier;
            //     } else if (children[funcChildIndex] instanceof Token) {
            //         funcReturnTypeNode = new Identifier((children[funcChildIndex++] as Token).lexeme);
            //     }
            //     else throw new Error("FuncDecl: Ожидался идентификатор типа возвращаемого значения.");
            //
            //     if (children[funcChildIndex] instanceof Block) {
            //         funcBodyNode = children[funcChildIndex++] as Block;
            //     } else throw new Error("FuncDecl: Ожидался Block для тела функции.");
            //
            //     return new FuncDecl(funcNameNode.name, funcParams, funcReturnTypeNode.name, funcBodyNode);
            //
            // // Param не является ASTNode в вашем определении, он используется в FuncDecl.
            // // Если бы Param был ASTNode, то для него было бы свое правило и действие:
            // // case 'Param':
            // //     // <Param> -> id : <type_id> ~Param
            // //     // children: [Identifier_name, Token_colon, Identifier_type]
            // //     if (children.length >= 3 && children[0] instanceof Identifier && children[2] instanceof Identifier) {
            // //         return new Param((children[0] as Identifier).name, (children[2] as Identifier).name);
            // //     }
            // //     throw new Error(`Invalid children for Param action.`);

            case 'AssignExpr':
                // <AssignExpr> -> id = <Expression> ~AssignExpr (возможно, с ';' в конце)
                // children: [IdentifierNode_name, Token_eq, ASTNode_value]
                if (children.length >= 3 &&
                    children[0] instanceof Identifier &&
                    (children[1] instanceof Token && (children[1] as Token).lexeme === '=') &&
                    children[2] instanceof ASTNode) {
                    return new AssignExpr((children[0] as Identifier).name, children[2] as ASTNode);
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

            case 'Literal':
                if (children.length === 1 && children[0] instanceof Token) {
                    const token = children[0] as Token;
                    if (token.type === Lexeme.INTEGER) return new Literal(parseInt(token.lexeme, 10));
                    if (token.type === Lexeme.FLOAT) return new Literal(parseFloat(token.lexeme));
                    if (token.type === Lexeme.STRING) return new Literal(token.lexeme);
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