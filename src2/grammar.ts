import { EOF_SYMBOL } from "./lexer/constants";
// Предположим, что `#` в конце правил Z - это EOF_SYMBOL, а `#` в одиночку - эпсилон.
export const yourGrammarAdapte1d = [
    `<Z> -> <BlockList> ${EOF_SYMBOL} ~Program`,
    `<Z> -> ${EOF_SYMBOL} ~ProgramEmptyBody`, // Было: <Z> -> # ~Program

    '<BlockList> -> <Block> <BlockList>',
    '<BlockList> -> <Block>',
    '<Block> -> <Stmt> ;',
    '<Block> -> <Decl> ;',

    '<Decl> -> let id',
    '<Decl> -> const id = num',
    // Для ScopedBody используем явный эпсилон, если тело может быть пустым
    '<Decl> -> function id ( ) { <ScopedBody> } ~FuncDeclNoParams',
    '<Decl> -> function id ( <ParamList> ) { <ScopedBody> } ~FuncDeclWithParams',
    
    '<ScopedBody> -> <BlockList>',
    '<ScopedBody> -> ', // Эпсилон для пустого тела ~EmptyScopedBody

    '<ParamList> -> id',
    '<ParamList> -> id , <ParamList>',
    
    '<Stmt> -> <Expr>',
    // ... остальные Stmt
    '<Stmt> -> if <Expr> { <ScopedBody> }',
    '<Stmt> -> if <Expr> { <ScopedBody> } else { <ScopedBody> }',
    '<Stmt> -> while <Expr> { <ScopedBody> }',


    '<Expr> -> ( <Expr> )',
    '<Expr> -> <BinExpr>',
    '<Expr> -> <T>', // Добавил для полноты

    '<BinExpr> -> <T> + <T> ~BinaryExpr',
    '<BinExpr> -> <T> - <T> ~BinaryExpr',
    '<BinExpr> -> <T> * <T> ~BinaryExpr',
    '<BinExpr> -> <T> / <T> ~BinaryExpr',

    '<T> -> id ~Ident',
    '<T> -> num ~Num',
];

export const yourGrammarAdapted = [
    // --- Program Structure ---
    // '#' здесь - маркер конца ввода
    `<Z> -> <BlockList> ${EOF_SYMBOL} ~Program`,
    `<Z> -> ${EOF_SYMBOL} ~ProgramEmptyBody`, // Было: <Z> -> # ~Program

    // <BlockList> не может быть пустым по своей природе, если нет эпсилон-правил
    '<BlockList> -> <BlockList> <Block>',         // R1
    '<BlockList> -> <Block>',                     // R2

    '<Block> -> <Decl> ;',                        // R3
    '<Block> -> <Stmt> ;',                        // R4

    // --- Declarations ---
    '<Decl> -> let id',                           // R5
    '<Decl> -> const id = num',                   // R6
    // Для тел функций:
    '<Decl> -> function id ( ) { <BlockList> } ~FuncDeclWithBody',    // R7a
    '<Decl> -> function id ( ) { } ~FuncDeclEmptyBody',               // R7b (пустое тело)
    '<Decl> -> function id ( <ParamList> ) { <BlockList> } ~FuncDeclParamsWithBody', // R8a
    '<Decl> -> function id ( <ParamList> ) { } ~FuncDeclParamsEmptyBody', // R8b (пустое тело)
    // Для списков параметров:
    // '<Decl> -> function id ( <ParamList_Opt> ) ... '
    // Если <ParamList_Opt> должен быть, то его нельзя сделать опциональным без эпсилон.
    // Если параметры всегда обязательны, если скобки есть, или список может быть пустым, но распознается через правила:
    // <ParamList> -> id
    // <ParamList> -> id , <ParamList>
    // Тогда вызов без параметров - это отдельное правило для Decl.
    // Это уже сделано в R7a/R7b - отдельные правила для '()'

    '<ParamList> -> id',                          // R9
    '<ParamList> -> id , <ParamList>',            // R10

    // --- Statements ---
    // Для if/while, если тело может быть пустым:
    '<Stmt> -> <Expr>',                           // R11
    '<Stmt> -> return <Expr> ~ReturnStmt',        // R12
    '<Stmt> -> return ~ReturnStmt',               // R13

    '<Stmt> -> if <Expr> { <BlockList> }',        // R14a
    '<Stmt> -> if <Expr> { }',                    // R14b (пустое тело if)

    '<Stmt> -> if <Expr> { <BlockList> } else { <BlockList> }', // R15a
    '<Stmt> -> if <Expr> { <BlockList> } else { }',             // R15b (пустое тело else)
    '<Stmt> -> if <Expr> { } else { <BlockList> }',             // R15c (пустое тело if)
    '<Stmt> -> if <Expr> { } else { }',                         // R15d (оба тела пустые)

    '<Stmt> -> while <Expr> { <BlockList> }',     // R16a
    '<Stmt> -> while <Expr> { }',                 // R16b (пустое тело while)


    // --- Expressions ---
    '<Expr> -> ( <Expr> )',                       // R17
    '<Expr> -> <BinExpr>',                        // R18
    '<Expr> -> <T>',                              // R19

    '<BinExpr> -> <T> + <T> ~BinaryExpr',         // R20
    '<BinExpr> -> <T> - <T> ~BinaryExpr',         // R21
    '<BinExpr> -> <T> * <T> ~BinaryExpr',         // R22
    '<BinExpr> -> <T> / <T> ~BinaryExpr',         // R23

    '<T> -> id ~Ident',                           // R24
    '<T> -> num ~Num',                            // R25
];