import fs from 'fs';
import path from 'path';
// Импорты для полного конвейера временно отключены, чтобы избежать ошибок
// import { Lexer } from './lexer/Lexer';
// import { SLRParser } from './slr/SLRParser'; 
// import { SemanticAnalyzer } from './analyzer/analyzer';
// import { SymbolTable } from './symbolTable/SymbolTable';
import { CodeGenerator } from './generator/CodeGenerator';

function main() {
    // Этот скрипт теперь сам читает аргументы командной строки
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.error("Использование: yarn compile <source_file.txt>");
        process.exit(1);
    }

    const sourcePath = args[0];
    if (!fs.existsSync(sourcePath)) {
        console.error(`Ошибка: Исходный файл не найден: ${sourcePath}`);
        process.exit(1);
    }

    const outputBasename = path.basename(sourcePath, path.extname(sourcePath));
    const outputPath = `${outputBasename}.prmbc`;

    try {
        console.log(`Компиляция ${sourcePath}...`);
        
        console.log("⚠️ ВНИМАНИЕ: Используется тестовое AST для сортировки пузырьком. Реальный парсер отключен.");
        const bubbleSortAST = { 
            type: 'Program', 
            body: [
                {
                    type: 'VariableDeclaration', line: 1, declarations: [{
                        type: 'VariableDeclarator', line: 1, id: { type: 'Identifier', name: 'a' }, init: {
                            type: 'ArrayExpression', line: 1, elements: [
                                { type: 'NumericLiteral', value: 123, line: 1 },
                                { type: 'NumericLiteral', value: 2, line: 1 },
                                { type: 'NumericLiteral', value: 19, line: 1 }
                            ]
                        }
                    }]
                },
                {
                    type: 'FunctionDeclaration', line: 3, id: { type: 'Identifier', name: 'bubbleSort', line: 3 }, params: [{ type: 'Identifier', name: 'arr', line: 3 }], body: {
                        type: 'BlockStatement', line: 4, body: [
                            {
                                type: 'VariableDeclaration', line: 5, declarations: [{
                                    type: 'VariableDeclarator', line: 5, id: { type: 'Identifier', name: 'size' }, init: {
                                        type: 'CallExpression', line: 5, callee: { type: 'Identifier', name: 'arrayLength', line: 5 }, arguments: [{ type: 'Identifier', name: 'arr', line: 5 }]
                                    }
                                }]
                            },
                            {
                                type: 'ForStatement', line: 7,
                                init: { type: 'VariableDeclaration', line: 7, declarations: [{ type: 'VariableDeclarator', line: 7, id: { type: 'Identifier', name: 'i' }, init: { type: 'NumericLiteral', value: 0, line: 7 } }] },
                                test: { type: 'BinaryExpression', operator: '<', line: 7, left: { type: 'Identifier', name: 'i', line: 7 }, right: { type: 'Identifier', name: 'size', line: 7 } },
                                update: { type: 'AssignmentExpression', operator: '=', line: 7, left: { type: 'Identifier', name: 'i', line: 7 }, right: { type: 'BinaryExpression', operator: '+', line: 7, left: { type: 'Identifier', name: 'i', line: 7 }, right: { type: 'NumericLiteral', value: 1, line: 7 } } },
                                body: { type: 'BlockStatement', line: 8, body: [{
                                    type: 'ForStatement', line: 9,
                                    init: { type: 'VariableDeclaration', line: 9, declarations: [{ type: 'VariableDeclarator', line: 9, id: { type: 'Identifier', name: 'j' }, init: { type: 'NumericLiteral', value: 0, line: 9 } }] },
                                    test: { type: 'BinaryExpression', operator: '<', line: 9, left: { type: 'Identifier', name: 'j', line: 9 }, right: { type: 'BinaryExpression', operator: '-', line: 9, left: { type: 'BinaryExpression', operator: '-', line: 9, left: { type: 'Identifier', name: 'size', line: 9 }, right: { type: 'Identifier', name: 'i', line: 9 } }, right: { type: 'NumericLiteral', value: 1, line: 9 } } },
                                    update: { type: 'AssignmentExpression', operator: '=', line: 9, left: { type: 'Identifier', name: 'j', line: 9 }, right: { type: 'BinaryExpression', operator: '+', line: 9, left: { type: 'Identifier', name: 'j', line: 9 }, right: { type: 'NumericLiteral', value: 1, line: 9 } } },
                                    body: { type: 'BlockStatement', line: 10, body: [{
                                        type: 'IfStatement', line: 11,
                                        test: { type: 'BinaryExpression', operator: '>', line: 11,
                                            left: { type: 'MemberExpression', line: 11, object: { type: 'Identifier', name: 'arr', line: 11 }, property: { type: 'Identifier', name: 'j', line: 11 } },
                                            right: { type: 'MemberExpression', line: 11, object: { type: 'Identifier', name: 'arr', line: 11 }, property: { type: 'BinaryExpression', operator: '+', line: 11, left: { type: 'Identifier', name: 'j', line: 11 }, right: { type: 'NumericLiteral', value: 1, line: 11 } } }
                                        },
                                        consequent: { type: 'BlockStatement', line: 12, body: [
                                            { type: 'VariableDeclaration', line: 13, declarations: [{ type: 'VariableDeclarator', line: 13, id: { type: 'Identifier', name: 'temp' }, init: { type: 'MemberExpression', line: 13, object: { type: 'Identifier', name: 'arr', line: 13 }, property: { type: 'Identifier', name: 'j', line: 13 } } }] },
                                            { type: 'ExpressionStatement', line: 14, expression: { type: 'AssignmentExpression', operator: '=', line: 14, left: { type: 'MemberExpression', line: 14, object: { type: 'Identifier', name: 'arr', line: 14 }, property: { type: 'Identifier', name: 'j', line: 14 } }, right: { type: 'MemberExpression', line: 14, object: { type: 'Identifier', name: 'arr', line: 14 }, property: { type: 'BinaryExpression', operator: '+', line: 14, left: { type: 'Identifier', name: 'j', line: 14 }, right: { type: 'NumericLiteral', value: 1, line: 14 } } } } },
                                            { type: 'ExpressionStatement', line: 15, expression: { type: 'AssignmentExpression', operator: '=', line: 15, left: { type: 'MemberExpression', line: 15, object: { type: 'Identifier', name: 'arr', line: 15 }, property: { type: 'BinaryExpression', operator: '+', line: 15, left: { type: 'Identifier', name: 'j', line: 15 }, right: { type: 'NumericLiteral', value: 1, line: 15 } } }, right: { type: 'Identifier', name: 'temp', line: 15 } } }
                                        ]},
                                        alternate: null
                                    }]}
                                }]},
                            },
                            { type: 'ReturnStatement', line: 20, argument: { type: 'Identifier', name: 'arr', line: 20 } }
                        ]
                    }
                },
                {
                    type: 'ExpressionStatement', line: 23, expression: {
                        type: 'CallExpression', line: 23, callee: { type: 'Identifier', name: 'println', line: 23 }, arguments: [{
                            type: 'CallExpression', line: 23, callee: { type: 'Identifier', name: 'bubbleSort', line: 23 }, arguments: [{ type: 'Identifier', name: 'a', line: 23 }]
                        }]
                    }
                }
            ]
        };

        const generator = new CodeGenerator();
        const bytecode = generator.generate(bubbleSortAST);
        console.log("✅ Генератор успешно создал байт-код.");

        fs.writeFileSync(outputPath, bytecode);

        console.log(`\n🎉 Успешно скомпилировано!`);
        console.log(`   Байт-код сохранен в: ${outputPath}`);
        console.log(`\nЧтобы запустить, используйте команду:`);
        console.log(`   prima/PVM.exe ${outputPath}`);

    } catch (e: any) {
        console.error("\n❌ Ошибка компиляции:", e.message);
        if (e.stack) {
            console.error(e.stack);
        }
        process.exit(1);
    }
}

main(); 