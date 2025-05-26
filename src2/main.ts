import { EOF_SYMBOL } from "./lexer/constants";
import { Lexer } from "./lexer/lexer";

const main = () => {
    // Адаптированная грамматика с использованием EOF_SYMBOL ('$') и пустых строк для эпсилон
    const potGrammar = [
        `<Z> -> <BlockList> ${EOF_SYMBOL} ~Program`,
        `<Z> -> ${EOF_SYMBOL} ~ProgramEmptyBody`, // Эпсилон-правило

        '<BlockList> -> <Block> <BlockList>',
        '<BlockList> -> <Block>',
        '<Block> -> <Stmt> ;',
        '<Block> -> <Decl> ;',

        '<Decl> -> let id',
        '<Decl> -> const id = num',
        '<Decl> -> function id ( ) { <ScopedBody> } ~FuncDeclNoParams',
        '<Decl> -> function id ( <ParamList> ) { <ScopedBody> } ~FuncDeclWithParams',

        '<ScopedBody> -> <BlockList>',
        '<ScopedBody> -> ~EmptyScopedBody', // Эпсилон для пустого тела (пустая правая часть)

        '<ParamList> -> id',
        '<ParamList> -> id , <ParamList>',

        '<Stmt> -> <Expr>',
        '<Stmt> -> return <Expr> ~ReturnStmt', // Пример добавления return
        '<Stmt> -> return ~ReturnStmtEmpty',    // Пример return без значения
        '<Stmt> -> if <Expr> { <ScopedBody> }',
        '<Stmt> -> if <Expr> { <ScopedBody> } else { <ScopedBody> }',
        '<Stmt> -> while <Expr> { <ScopedBody> }',

        '<Expr> -> ( <Expr> )',
        '<Expr> -> <BinExpr>',
        '<Expr> -> <T>',

        '<BinExpr> -> <T> + <T> ~BinaryExpr',
        '<BinExpr> -> <T> - <T> ~BinaryExpr',
        '<BinExpr> -> <T> * <T> ~BinaryExpr',
        '<BinExpr> -> <T> / <T> ~BinaryExpr',

        '<T> -> id ~Ident',
        '<T> -> num ~Num',
    ];


    const inputs = [
        `
            const a3 = 4 ;
            let a ;
            let b ;
            if ( 1 + 2 ) {
                1 + 2 ;
                let x ;
                let y ;
            } ;
        `,
        `if ( 1 + 2 ) { ( 1 + 2 ) ; } else { ( 1 + 2 ) ; } ;`,
        `
            function foo ( x , y ) {
                return x + y ;
            } ;
            let z ; 
        `,
        `let emptyFunc ; function bar ( ) { } ; `, // Тест пустой функции
        ` `, // Тест пустой программы
        `1 + 2 ;` // Простой стейтмент
    ];

    inputs.forEach((inputString, index) => {
        console.log(`\n--- Parsing input ${index + 1} ---`);
        console.log(inputString.trim());
        try {
            const lexer = new Lexer();
            const tokens = lexer.tokenize(inputString); 
        
            console.log("Tokens:", tokens.map(t => `${t.type}(${t.value})`).join(' '));

        } catch (error: any) {
            console.error("Parsing error:", error.message);
            if (error.stack) {
                console.error(error.stack);
            }
        }
        console.log(`--- End of input ${index + 1} ---`);
    });
}

main();