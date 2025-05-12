Prog        → StmtList ~~Prog

StmtList    → Stmt ; ~~AddStmt StmtList
| ε ~~EmptyStmtList

Stmt        → VarDecl ~~StmtVarDecl
| ConstDecl ~~StmtConstDecl
| FuncDecl ~~StmtFuncDecl
| IfStmt ~~StmtIf
| WhileStmt ~~StmtWhile
| ForStmt ~~StmtFor
| ForEach ~~StmtForEach
| Expr ~~StmtExpr
| Comment ~~StmtComment
| AssignExpr ~~StmtAssign

VarDecl     → var ident : Type = Expr ~~VarDeclInit
| var ident : Type ~~VarDeclNoInit

ConstDecl   → const ident : Type = Expr ~~ConstDecl

FuncDecl    → func ident ( ParamList ) : Type Block ~~FuncDecl

ParamList   → Param , ParamList ~~ParamListMulti
| Param ~~ParamListSingle
| ε ~~EmptyParamList

Param       → ident : Type ~~Param

Block       → { StmtList } ~~Block

IfStmt      → if ( Expr ) Block ~~IfMain ElseIfList ElseOpt ~~IfStmt

ElseIfList  → elif ( Expr ) Block ~~ElseIf ElseIfList
| ε ~~EmptyElseIfList

ElseOpt     → else Block ~~Else
| ε ~~NoElse

WhileStmt   → while ( Expr ) Block ~~WhileStmt

ForStmt     → for ( ForInit ; ForCond ; ForUpdate ) Block ~~ForStmt
ForInit     → VarDecl ~~ForInitVar
| AssignExpr ~~ForInitAssign
| ε ~~EmptyForInit

ForCond     → Expr ~~ForCond
ForUpdate   → AssignExpr ~~ForUpdate

AssignExpr  → ident = Expr ~~Assign

ForEach     → for ( var ident : Type of Expr ) Block ~~ForEach

Comment     → // .* ~~LineComment
| /* .*? */ ~~BlockComment

Expr        → RelExpr ~~Expr

RelExpr     → AddExpr ~~RelExprSingle
| AddExpr RelOp AddExpr ~~RelExprOp

AddExpr     → MulExpr ~~AddExprSingle
| MulExpr AddOp MulExpr ~~AddExprOp

MulExpr     → UnaryExpr ~~MulExprSingle
| UnaryExpr MulOp UnaryExpr ~~MulExprOp

UnaryExpr   → ! UnaryExpr ~~UnaryNot
| & ident ~~UnaryAddr
| * ident ~~UnaryDeref
| PrimaryExpr ~~UnaryPrimary

PrimaryExpr → ident ~~PrimaryIdent
| Literal ~~PrimaryLiteral
| ( Expr ) ~~PrimaryParen
| CallExpr ~~PrimaryCall
| FieldAccess ~~PrimaryField
| ObjectExpr ~~PrimaryObject
| ArrayExpr ~~PrimaryArray

CallExpr    → ident ( ArgList ) ~~CallExpr

ArgList     → Expr , ArgList ~~ArgListMulti
| Expr ~~ArgListSingle
| ε ~~EmptyArgList

FieldAccess → PrimaryExpr . ident ~~FieldAccess

ObjectExpr  → { FieldList } ~~ObjectExpr
FieldList   → Field , FieldList ~~FieldListMulti
| Field ~~FieldListSingle
| ε ~~EmptyFieldList

Field       → ident : Expr ~~Field

ArrayExpr   → [ ArrayElemList ] ~~ArrayExpr
ArrayElemList → Expr , ArrayElemList ~~ArrayElemListMulti
| Expr ~~ArrayElemListSingle
| ε ~~EmptyArrayElemList

Type        → number ~~TypeNumber
| boolean ~~TypeBoolean
| string ~~TypeString
| null ~~TypeNull
| Type[] ~~TypeArray
| ( Type ) => Type ~~TypeFunc
| pointer Type ~~TypePointer
| ObjectType ~~TypeObject

ObjectType  → { FieldTypeList } ~~ObjectType
FieldTypeList → FieldType , FieldTypeList ~~FieldTypeListMulti
| FieldType ~~FieldTypeListSingle
| ε ~~EmptyFieldTypeList

FieldType   → ident : Type ~~FieldType

Literal     → INT ~~LitInt
| FLOAT ~~LitFloat
| true ~~LitTrue
| false ~~LitFalse
| STRING ~~LitString
| ArrayExpr ~~LitArray
| null ~~LitNull
