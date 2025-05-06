Prog        → StmtList
StmtList    → Stmt ; StmtList | ε

Stmt        → VarDecl
| ConstDecl
| FuncDecl
| IfStmt
| WhileStmt
| ForStmt
| ForEach
| Expr
| Comment
| AssignExpr

VarDecl     → var ident : Type = Expr
| var ident : Type

ConstDecl   → const ident : Type = Expr

FuncDecl    → func ident ( ParamList ) : Type Block
ParamList   → Param , ParamList | Param | ε
Param       → ident : Type

Block       → { StmtList }

IfStmt      → if ( Expr ) Block ElseIfList ElseOpt
ElseIfList  → elif ( Expr ) Block ElseIfList | ε
ElseOpt     → else Block | ε

WhileStmt   → while ( Expr ) Block

ForStmt     → for ( ForInit ; ForCond ; ForUpdate ) Block
ForInit     → VarDecl | AssignExpr | ε
ForCond     → Expr
ForUpdate   → AssignExpr

AssignExpr  → ident = Expr

ForEach     → for ( var ident : Type of Expr ) Block

Comment     → // .* | /* .*? */

Expr        → RelExpr
RelExpr     → AddExpr | AddExpr RelOp AddExpr
AddExpr     → MulExpr | MulExpr AddOp MulExpr
MulExpr     → UnaryExpr | UnaryExpr MulOp UnaryExpr
UnaryExpr   → ! UnaryExpr
| & ident
| * ident
| PrimaryExpr

PrimaryExpr → ident
| Literal
| ( Expr )
| CallExpr
| FieldAccess
| ObjectExpr
| ArrayExpr

CallExpr    → ident ( ArgList )
ArgList     → Expr , ArgList | Expr | ε

FieldAccess → PrimaryExpr . ident

ObjectExpr  → { FieldList }
FieldList   → Field , FieldList | Field | ε
Field       → ident : Expr

ArrayExpr   → [ ArrayElemList ]
ArrayElemList → Expr , ArrayElemList | Expr | ε

Type        → number
| boolean
| string
| null
| Type[]
| ( Type ) => Type
| pointer Type
| ObjectType

ObjectType  → { FieldTypeList }
FieldTypeList → FieldType , FieldTypeList | FieldType | ε
FieldType   → ident : Type

Literal     → INT
| FLOAT
| true
| false
| STRING
| ArrayExpr
| null

RelOp       → == | != | < | > | <= | >=
AddOp       → + | -
MulOp       → * | / | %

ident       → [a-zA-Z_][a-zA-Z0-9_]*
INT         → [0-9]+
FLOAT       → [0-9]+ '.' [0-9]+
STRING      → "\"" .*? "\""
