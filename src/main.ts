import {buildTransitionTable, parseGrammar} from '@src/transitionTable/generator'
import {Parser} from '@src/transitionTable/parser'
import {TransitionTable} from '@common/types'
import {Lexer} from '@src/lexer/lexer'

const main = () => {
/*    const rawGrammar = [
        '<Z> -> <S> #',
        '<S> -> a <S> b',
        '<S> -> a b',
        '<S> -> <S> c',
        '<S> -> c'
    ]
    */
    // const rawGrammar = [
    //     '<Z> -> <S> #',
    //     '<S> -> <S> + <T>',
    //     '<S> -> <T>',
    //     '<T> -> <T> * <F>',
    //     '<T> -> <F>',
    //     '<F> -> - <F>',
    //     '<F> -> ( <S> )',
    //     '<F> -> id'
    // ]

    // const rawGrammar = [
    //     '<Z> -> <S> #',
    //     '<S> -> ( )',
    //     '<S> -> ( <S> <B> )',
    //     '<S> -> ( <S> )',
    //     '<S> -> <A>',
    //     '<B> -> * <S> <B>',
    //     '<B> -> * <S>',
    //     '<A> -> a',
    //     '<A> -> b'
    // ]

    // const rawGrammar = [
    //     '<Z> -> <S> #',
    //     '<S> -> ( )',
    //     '<S> -> ( <S> <B> )',
    //     '<S> -> ( <S> )',
    //     '<S> -> <A>',
    //     '<B> -> , <S> <B>',
    //     '<B> -> , <S>',
    //     '<A> -> a',
    //     '<A> -> b'
    // ]
    // const rawGrammar = [
    //     '<Z> -> <PROG> #',
    //     '<PROG> -> begin d ; <X> end',
    //     '<X> -> d ; <X>',
    //     '<X> -> s <Y>',
    //     '<X> -> s',
    //     '<Y> -> ; s <Y>',
    //     '<Y> -> ; s'
    // ]
    // const rawGrammar = [
    //     '<Z> -> <A> #',
    //     '<Z> -> #',
    //     '<A> -> 0 <A>',
    //     '<A> -> 0',
    //     '<A> -> 1 <A>',
    //     '<A> -> 1',
    //     '<A> -> 2 <A>',
    //     '<A> -> 2'
    // ]
    
    // const rawGrammar = [
    //     '<Z> -> <S> #',
    //     '<S> -> <A> <B> <C>',
    //     '<S> -> <B> <C>',
    //     '<S> -> <A> <C>',
    //     '<S> -> <A> <B>',
    //     '<A> -> <A> a',
    //     '<A> -> a',
    //     '<B> -> b <B>',
    //     '<B> -> b',
    //     '<C> -> c',
    //     '<C> -> <C> c'
    // ]
    const rawGrammar = [

        '<Z> -> <Prog> #',
        '<Prog> -> <StmtList>',
        '<Prog> -> #',

        '<StmtList> -> <Stmt> ; <StmtList>',

        '<Stmt> -> <VarDecl>',
        // '<Stmt> -> <ConstDecl>',
        // '<Stmt> -> <FuncDecl>',
        // '<Stmt> -> <IfStmt>',
        // '<Stmt> -> <WhileStmt>',
        // '<Stmt> -> <ForStmt>',
        // '<Stmt> -> <Expr>',
        // '<Stmt> -> <Comment>',
        // '<Stmt> -> <AssignExpr>',

        '<VarDecl> -> var ident : <Type> = <Expr>',
        '<VarDecl> -> var ident : <Type>',

        // '<ConstDecl> -> const ident : <Type> = <Expr>',

        // '<FuncDecl> -> func ident ( <ParamList> ) : <Type> <Block>',

        // '<ParamList> -> <Param> , <ParamList>',
        // '<Param> -> ident : <Type>',
        //
        // '<Block> -> { <StmtList> }',
        //
        // '<IfStmt> -> if ( <Expr> ) <Block> <ElseIfList> <ElseOpt>',
        // '<ElseIfList> -> elif ( <Expr> ) <Block> <ElseIfList>',
        // '<ElseOpt> -> else <Block>',
        //
        // '<WhileStmt> -> while ( <Expr> ) <Block>',
        //
        // '<ForStmt> -> for ( <ForInit> ; <ForCond> ; <ForUpdate> ) <Block>',
        // '<ForInit> -> <VarDecl>',
        // '<ForInit> -> <AssignExpr>',
        // '<ForCond> -> <Expr>',
        // '<ForUpdate> -> <AssignExpr>',
        //
        // '<AssignExpr> -> ident = <Expr>',
        //
        '<Expr> -> <RelExpr>',
        //
        '<RelExpr> -> <AddExpr>',
        //
        '<AddExpr> -> <MulExpr>',

        '<MulExpr> -> <UnaryExpr>',


        '<UnaryExpr> -> <PrimaryExpr>',

        '<PrimaryExpr> -> ident',
        // '<PrimaryExpr> -> <Literal>',
        // '<PrimaryExpr> -> ( <Expr> )',
        // '<PrimaryExpr> -> <CallExpr>',
        // '<PrimaryExpr> -> <FieldAccess>',
        // '<PrimaryExpr> -> <ObjectExpr>',
        // '<PrimaryExpr> -> <ArrayExpr>',
        //
        // '<CallExpr> -> ident ( <ArgList> )',
        //
        // '<ArgList> -> <Expr> , <ArgList>',
        // '<ArgList> -> <Expr>',
        //
        // '<FieldAccess> -> <PrimaryExpr> . ident',
        //
        // '<ObjectExpr> -> { <FieldList> }',
        //
        // '<FieldList> -> <Field> , <FieldList>',
        // '<FieldList> -> <Field>',
        //
        // '<Field> -> ident : <Expr>',
        //
        // '<ArrayExpr> -> [ <ArrayElemList> ]',
        //
        // '<ArrayElemList> -> <Expr> , <ArrayElemList>',
        // '<ArrayElemList> -> <Expr>',
        //
         '<Type> -> number',
        // '<Type> -> boolean',
        // '<Type> -> string',
        // '<Type> -> null',
        // '<Type> -> <Type> []',
        // '<Type> -> ( <Type> ) => <Type>',
        // '<Type> -> pointer <Type>',
        // '<Type> -> <ObjectType>',
        //
        // '<ObjectType> -> { <FieldTypeList> }',
        //
        // '<FieldTypeList> -> <FieldType> , <FieldTypeList>',
        // '<FieldTypeList> -> <FieldType>',
        //
        // '<FieldType> -> ident : <Type>',
        //
        // '<Literal> -> INT',
        // '<Literal> -> FLOAT',
        // '<Literal> -> true',
        // '<Literal> -> false',
        // '<Literal> -> STRING',
        // '<Literal> -> <ArrayExpr>',
        // '<Literal> -> null'
    ]


    const grammar = parseGrammar(rawGrammar);
    const transitionTable = buildTransitionTable(grammar);
    console.log(transitionTable)

    try {
        const lexer = new Lexer()
        //const input = '( a )'
        //const input = '- ( id + id ) * ( id + - id ) + id + id'
        //const input = '( a )'
        //const input = '( a , b )'
        //const input = 'begin d ; s end'
        //const input = '0 1'
        //const input = 'a b c'
        const input = 'var ident : number = ident ;'

        const tokens = lexer.tokenize(input)
        const parser = new Parser(tokens, transitionTable, grammar)
        parser.parse()
        console.log("Разбор успешно завершён!")
    } catch (error) {
        console.log(error)
    }
}

if (require.main === module) {
    main()
}