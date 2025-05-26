import { SLRTableBuilder } from '@src/transitionTable/builder'
import { SLRTableParser } from '@src/transitionTable/parser'
import { Lexer } from 'src2/lexer';

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
        // '<Decl> -> function id',

        // '<ParamList> -> id , <ParamList>',
        // '<ParamList> -> id',
        
        '<Stmt> -> <Expr>',
        '<Stmt> -> if <Expr> { <BlockList> }',
        '<Stmt> -> if <Expr> { <BlockList> } else { <BlockList> }',
        '<Stmt> -> while <Expr> { <BlockList> }',

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
                let a ;
                let b ;
                if ( 1 + 2 ) {
                    1 + 2 ;
                    let a ;
                    let b ;
                } ;
            `,
            ' if ( 1 + 2 ) { ( 1 + 2 ) ; } else { ( 1 + 2 ) ; } ;',
            // `
            //     func foo ( x, y ) {
            //         x + y ;
            //     }
            // `
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