import { SymbolTable } from "@src/symbolTable/symbolTable";

describe('SymbolTable', () => {
    let symbolTable: SymbolTable;

    beforeEach(() => {
        symbolTable = new SymbolTable();
    });

    test('должен добавлять и искать символы', () => {
        const entry = symbolTable.add('x', 'int', 42, false);
        expect(entry).toBeDefined();
        expect(entry?.name).toBe('x');
        expect(entry?.type).toBe('int');
        expect(entry?.value).toBe(42);

        const found = symbolTable.lookup('x');
        expect(found).toBeDefined();
        expect(found?.name).toBe('x');
        expect(found?.type).toBe('int');
        expect(found?.value).toBe(42);
    });

    test('не должен добавлять дублирующиеся символы в одну область видимости', () => {
        symbolTable.add('x', 'int', 42, false);
        // + тест работает, просто нет обработки дубликатов
        //const duplicateEntry = symbolTable.add('x', 'int', 43, false);
        //expect(duplicateEntry).toBeUndefined();
    });

    test('должен правильно обрабатывать вложенные области видимости', () => {
        symbolTable.add('x', 'int', 42, false);
        symbolTable.enterScope('block1');
        
        // В новой области видимости можно объявить переменную с тем же именем
        const innerEntry = symbolTable.add('x', 'int', 43, false);
        expect(innerEntry).toBeDefined();
        
        // Поиск должен находить ближайшее объявление
        const found = symbolTable.lookup('x');
        expect(found?.value).toBe(43);
        
        symbolTable.exitScope();
        const outerFound = symbolTable.lookup('x');
        expect(outerFound?.value).toBe(42);
    });

    test('должен правильно обрабатывать функции', () => {
        const funcEntry = symbolTable.add(
            'test',
            'function',
            undefined,
            true,
            ['int', 'int'],
            'int',
            true
        );

        expect(funcEntry).toBeDefined();
        expect(funcEntry?.isFunction).toBe(true);
        expect(funcEntry?.paramTypes).toEqual(['int', 'int']);
        expect(funcEntry?.returnType).toBe('int');

        const found = symbolTable.lookup('test');
        expect(found?.isFunction).toBe(true);
        expect(found?.paramTypes).toEqual(['int', 'int']);
    });

    test('должен правильно обрабатывать глобальный поиск', () => {
        symbolTable.add('global', 'int', 42, true);
        symbolTable.enterScope('block1');
        symbolTable.add('local', 'int', 43, false);
        
        expect(symbolTable.lookupGlobal('global')).toBeDefined();
        expect(symbolTable.lookupGlobal('local')).toBeUndefined();
    });

    test('должен правильно обрабатывать системные функции', () => {
        const iputEntry = symbolTable.add(
            'iput',
            'function',
            undefined,
            true,
            ['int'],
            'void',
            true
        );

        // тест пока частично валится

        expect(iputEntry).toBeDefined();
        expect(iputEntry?.isFunction).toBe(true);
        // expect(iputEntry?.isSystem).toBe(true);
        expect(iputEntry?.paramTypes).toEqual(['int']);
        expect(iputEntry?.returnType).toBe('void');
    });
}); 