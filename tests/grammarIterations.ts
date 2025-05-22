const firstGrammar = [
    '<Z> -> <BlockList> # ~Program',
    '<Z> -> # ~Program',

    '<BlockList> -> <Block> <BlockList>',
    '<BlockList> -> <Block>',
    '<Block> -> <Stmt> ;',
    '<Block> -> <Decl> ;',

    '<Decl> -> let id',
    '<Stmt> -> <Expr>',
    '<Stmt> -> if <Expr> { <Expr> }',
    '<Stmt> -> if <Expr> { <Expr> } else { <Expr> }',

    '<Expr> -> ( <Expr> )',
    '<Expr> -> <BinExpr>',

    '<BinExpr> -> <T> + <T> ~BinaryExpr',
    '<BinExpr> -> <T> - <T> ~BinaryExpr',
    '<BinExpr> -> <T> * <T> ~BinaryExpr',
    '<BinExpr> -> <T> / <T> ~BinaryExpr',
    '<T> -> id ~Ident',
    '<T> -> num ~Num',
];

const inputs = [
    `
        if ( 1 + 2 ) { 1 + 2 } ;
    `,
    ' if ( 1 + 2 ) { ( 1 + 2 ) } else { ( 1 + 2 ) } ;'
]