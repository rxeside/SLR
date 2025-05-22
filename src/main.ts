import { SLRTableBuilder } from '@src/transitionTable/builder'
import { SLRTableParser } from '@src/transitionTable/parser'
import { Lexer } from '@src/lexer/lexer'

const main = () => {
    const potGrammar = [
        '<Z> -> <BlockList> # ~Program',
        '<Z> -> # ~Program',

        '<BlockList> -> <Block> <BlockList>',
        '<BlockList> -> <Block>',
        '<Block> -> <Stmt> ;',
        '<Block> -> <Decl> ;',

        '<Decl> -> let id',
        '<Decl> -> const id = num',
        
        '<Stmt> -> <Expr>',
        '<Stmt> -> if <Expr> { <Block> }',
        '<Stmt> -> if <Expr> { <Block> } else { <Block> }',
        '<Stmt> -> while <Expr> { <Block> }',

        '<Expr> -> ( <Expr> )',
        '<Expr> -> <BinExpr>',

        '<BinExpr> -> <T> + <T> ~BinaryExpr',
        '<BinExpr> -> <T> - <T> ~BinaryExpr',
        '<BinExpr> -> <T> * <T> ~BinaryExpr',
        '<BinExpr> -> <T> / <T> ~BinaryExpr',

        '<T> -> id ~Ident',
        '<T> -> num ~Num',
    ];

    const builder = new SLRTableBuilder(potGrammar);
    const transitionTable = builder.buildTable();

    try {
        const inputs = [
            `
                const a3 = 4 ;
                let a ;
                let b ;
                if ( 1 + 2 ) {
                    1 + 2 ;
                } ;
            `,
            ' if ( 1 + 2 ) { ( 1 + 2 ) ; } else { ( 1 + 2 ) ; } ;'
        ]

        inputs.forEach(element => {
            const lexer = new Lexer()
            const tokens = lexer.tokenize(element)

            const parser = new SLRTableParser(tokens, transitionTable, builder.rules);
            parser.parse()
        });

    } catch (error) {
        console.log(error)
    }
}

main()