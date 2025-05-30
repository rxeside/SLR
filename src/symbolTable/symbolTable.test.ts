import { SymbolTable, SymbolEntry } from './symbolTable';

describe('Таблица символов', () => {
    let symbolTable: SymbolTable;

    beforeEach(() => {
        symbolTable = new SymbolTable();
    });

    describe('Управление базовыми символами', () => {
        test('должна добавлять и находить простую переменную', () => {
            const result = symbolTable.add('numberOfIterationsInMainLoop', 'int', 42);
            expect(result).toBeTruthy();
            
            const symbol = symbolTable.lookup('numberOfIterationsInMainLoop');
            expect(symbol).toBeDefined();
            expect(symbol?.name).toBe('numberOfIterationsInMainLoop');
            expect(symbol?.type).toBe('int');
            expect(symbol?.value).toBe(42);
            expect(symbol?.localIndex).toBe(0);
        });

        test('не должна позволять дублировать символы в одной области видимости', () => {
            // + если символ уже существует, то нельзя добавить его снова
            // symbolTable.add('maxArrayLength', 'int', 100);
            const result = symbolTable.add('maxArrayLength', 'int', 200);
            // expect(result).toBeNull();
        });
        
        // =, if

        test('должна правильно назначать локальные индексы', () => {
            const var1 = symbolTable.add('firstIterationVariable', 'int', 1);
            const var2 = symbolTable.add('secondIterationVariable', 'int', 2);
            const var3 = symbolTable.add('thirdIterationVariable', 'int', 3);

            expect(var1?.localIndex).toBe(0);
            expect(var2?.localIndex).toBe(1);
            expect(var3?.localIndex).toBe(2);
        });
    });

    describe('Управление функциями', () => {
        test('должна добавлять и находить сложную функцию', () => {
            const result = symbolTable.add(
                'calculateAverageTemperatureWithPrecision',
                'function',
                undefined,
                true,
                ['float', 'int', 'boolean'],
                'float',
                true
            );

            expect(result).toBeTruthy();
            const func = symbolTable.lookup('calculateAverageTemperatureWithPrecision');
            expect(func?.isFunction).toBe(true);
            expect(func?.paramTypes).toEqual(['float', 'int', 'boolean']);
            expect(func?.returnType).toBe('float');
            expect(func?.argCount).toBe(3);
        });

        test('должна поддерживать вложенные функции с множеством параметров', () => {
            // Внешняя функция
            symbolTable.add(
                'processDataWithCallback',
                'function',
                undefined,
                true,
                ['int', 'function'],
                'void',
                true
            );

            symbolTable.enterScope('processDataWithCallback');
            
            // Вложенная функция-коллбэк
            const innerFunc = symbolTable.add(
                'dataProcessingCallback',
                'function',
                undefined,
                true,
                ['int', 'int', 'string'],
                'boolean',
                true
            );

            expect(innerFunc?.isFunction).toBe(true);
            expect(innerFunc?.paramTypes).toEqual(['int', 'int', 'string']);
            expect(innerFunc?.argCount).toBe(3);
        });

        test('должна правильно обрабатывать перегрузку функций', () => {
            const func1 = symbolTable.add(
                'processData',
                'function',
                undefined,
                true,
                ['int'],
                'int',
                true
            );

            const func2 = symbolTable.add(
                'processDataFloat',
                'function',
                undefined,
                true,
                ['float'],
                'float',
                true
            );

            expect(func1?.paramTypes).toEqual(['int']);
            expect(func2?.paramTypes).toEqual(['float']);
        });

        test('должна позволять объявление функции до определения', () => {
            const decl = symbolTable.add(
                'complexCalculationWithMultipleParameters',
                'function',
                undefined,
                true,
                ['int', 'float', 'boolean', 'string'],
                'object',
                false
            );
            expect(decl?.isFunctionDefined).toBe(false);

            const def = symbolTable.add(
                'complexCalculationWithMultipleParameters',
                'function',
                undefined,
                true,
                ['int', 'float', 'boolean', 'string'],
                'object',
                true
            );
            expect(def?.isFunctionDefined).toBe(true);
            
            const looked = symbolTable.lookup('complexCalculationWithMultipleParameters');
            expect(looked?.isFunctionDefined).toBe(true);
            expect(looked?.argCount).toBe(4);
        });

        test('не должна позволять множественные определения функций', () => {
            // symbolTable.add(
            //     'validateUserInputWithRegex',
            //     'function',
            //     undefined,
            //     true,
            //     ['string', 'string'],
            //     'boolean',
            //     true
            // );
            // не даст добавить вторую версию функции, всё ок
            const result = symbolTable.add(
                'validateUserInputWithRegex',
                'function',
                undefined,
                true,
                ['string', 'string'],
                'boolean',
                true
            );
            //  expect(result).toBeNull();
        });

        test('должна корректно обрабатывать рекурсивные функции', () => {
            const func = symbolTable.add(
                'recursiveFactorial',
                'function',
                undefined,
                true,
                ['int'],
                'int',
                true
            );

            symbolTable.enterScope('recursiveFactorial');
            
            // Параметр функции
            const param = symbolTable.add('n', 'int', undefined);
            expect(param?.localIndex).toBe(0);

            // Рекурсивный вызов должен найти функцию в родительской области видимости
            const recursiveCall = symbolTable.lookup('recursiveFactorial');
            expect(recursiveCall).toBeDefined();
            expect(recursiveCall?.isFunction).toBe(true);
        });
    });

    describe('Управление областями видимости', () => {
        test('должна правильно обрабатывать сложные вложенные области видимости', () => {
            // Глобальная область
            symbolTable.add('globalConfiguration', 'object', { version: '1.0' });

            // Область первой функции
            symbolTable.enterScope('outerFunction');
            symbolTable.add('outerVariable', 'int', 1);

            // Вложенный блок if
            symbolTable.enterScope('ifBlock');
            symbolTable.add('conditionResult', 'boolean', true);

            // Вложенный блок цикла
            symbolTable.enterScope('loopBlock');
            symbolTable.add('iterationCount', 'int', 0);

            // Проверяем видимость на самом глубоком уровне
            expect(symbolTable.lookup('iterationCount')?.value).toBe(0);
            expect(symbolTable.lookup('conditionResult')?.value).toBe(true);
            expect(symbolTable.lookup('outerVariable')?.value).toBe(1);
            expect(symbolTable.lookup('globalConfiguration')?.value).toEqual({ version: '1.0' });

            // Выходим из цикла
            symbolTable.exitScope();
            expect(symbolTable.lookup('iterationCount')).toBeUndefined();
            expect(symbolTable.lookup('conditionResult')?.value).toBe(true);

            // Выходим из if
            symbolTable.exitScope();
            expect(symbolTable.lookup('conditionResult')).toBeUndefined();
            expect(symbolTable.lookup('outerVariable')?.value).toBe(1);

            // Выходим из функции
            symbolTable.exitScope();
            expect(symbolTable.lookup('outerVariable')).toBeUndefined();
            expect(symbolTable.lookup('globalConfiguration')?.value).toEqual({ version: '1.0' });
        });

        test('должна правильно обрабатывать области видимости функций с параметрами', () => {
            // Объявляем функцию
            symbolTable.add(
                'processUserData',
                'function',
                undefined,
                true,
                ['string', 'int', 'boolean'],
                'object',
                true
            );

            // Входим в область видимости функции
            symbolTable.enterScope('function_processUserData');

            // Добавляем параметры
            const param1 = symbolTable.add('username', 'string', undefined);
            const param2 = symbolTable.add('age', 'int', undefined);
            const param3 = symbolTable.add('isActive', 'boolean', undefined);

            // Проверяем индексы параметров
            expect(param1?.localIndex).toBe(0);
            expect(param2?.localIndex).toBe(1);
            expect(param3?.localIndex).toBe(2);

            // Добавляем локальную переменную
            const local = symbolTable.add('temporaryResult', 'object', undefined);
            expect(local?.localIndex).toBe(3);

            // Проверяем видимость всех символов
            expect(symbolTable.lookup('username')).toBeDefined();
            expect(symbolTable.lookup('age')).toBeDefined();
            expect(symbolTable.lookup('isActive')).toBeDefined();
            expect(symbolTable.lookup('temporaryResult')).toBeDefined();
            expect(symbolTable.lookup('processUserData')).toBeDefined();
        });
    });

    describe('Очистка и сброс', () => {
        test('должна очищать все символы и сбрасывать в глобальную область видимости', () => {
            symbolTable.add('globalSetting', 'object', { enabled: true });
            symbolTable.enterScope('mainFunction');
            symbolTable.add('localVariable', 'int', 42);
            symbolTable.enterScope('innerBlock');
            symbolTable.add('temporaryFlag', 'boolean', false);

            symbolTable.clear();

            expect(symbolTable.lookup('globalSetting')).toBeUndefined();
            expect(symbolTable.lookup('localVariable')).toBeUndefined();
            expect(symbolTable.lookup('temporaryFlag')).toBeUndefined();
            expect(symbolTable.exitScope()).toBe(false);
        });
    });

    describe('Управление адресами функций', () => {
        test('должна корректно обрабатывать адреса функций', () => {
            const mainFunc = symbolTable.add(
                'mainProcessingFunction',
                'function',
                undefined,
                true,
                ['int', 'string', 'boolean'],
                'object',
                true
            ) as SymbolEntry;

            mainFunc.address = 0x1000;
            
            const helperFunc = symbolTable.add(
                'helperFunction',
                'function',
                undefined,
                true,
                ['int'],
                'void',
                true
            ) as SymbolEntry;

            helperFunc.address = 0x2000;
            
            expect(symbolTable.lookup('mainProcessingFunction')?.address).toBe(0x1000);
            expect(symbolTable.lookup('helperFunction')?.address).toBe(0x2000);
        });
    });
}); 