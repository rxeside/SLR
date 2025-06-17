// src/vm/value.ts

import {Chunk} from "@src/vm/chunk";

export enum ValueType {
    NUM,
    BOOL,
    STRING_OBJ, // Указывает на объект строки в куче/пуле строк
    ARRAY_OBJ,  // Указывает на объект массива в куче
    FUNCTION_OBJ,// Указывает на объект функции (скомпилированный)
    VOID,
    // Можно добавить NULL, NATIVE_FN (для встроенных функций)
}

// Базовый интерфейс для объектов, хранимых в куче ВМ
export interface VMObject {
    type: ValueType; // Конкретный тип объекта (STRING_OBJ, ARRAY_OBJ, etc.)
    // Можно добавить поля для сборки мусора (isMarked, next) в будущем
}

export interface VMString extends VMObject {
    type: ValueType.STRING_OBJ;
    value: string;
}

export interface VMArray extends VMObject {
    type: ValueType.ARRAY_OBJ;
    elements: VMValue[];
}

// Дескриптор скомпилированной функции
export interface CompiledFunction extends VMObject {
    type: ValueType.FUNCTION_OBJ;
    name: string;
    arity: number;            // Количество ожидаемых аргументов
    numLocals: number;        // Общее количество слотов для локальных переменных и параметров
    chunk: Chunk;             // Байт-код функции
    // upvalueCount: number;  // Для замыканий (пока 0)
}

// Представление значения в ВМ (на стеке, в переменных)
export interface VMValue {
    type: ValueType;
    // Для примитивов значение хранится прямо здесь
    // Для объектов (строки, массивы, функции) здесь будет ID/указатель на объект в куче,
    // но для простоты на начальном этапе можно хранить сам объект, если он иммутабельный (строка)
    // или если мы не беспокоимся о GC и копировании.
    // Начнем с простого:
    as: {
        boolean?: boolean;
        number?: number;
        obj?: VMObject; // Для STRING_OBJ, ARRAY_OBJ, FUNCTION_OBJ
    };
}

// Вспомогательные функции для создания VMValue
export function numValue(value: number): VMValue {
    return { type: ValueType.NUM, as: { number: value } };
}

export function boolValue(value: boolean): VMValue {
    return { type: ValueType.BOOL, as: { boolean: value } };
}

export function voidValue(): VMValue {
    return { type: ValueType.VOID, as: {} };
}

export function objectValue(obj: VMObject): VMValue {
    return { type: obj.type, as: { obj } };
}

// Вспомогательные функции для проверки и извлечения
export function isNumber(value: VMValue): boolean { return value.type === ValueType.NUM; }
export function isBoolean(value: VMValue): boolean { return value.type === ValueType.BOOL; }
export function isVoid(value: VMValue): boolean { return value.type === ValueType.VOID; }
export function isObject(value: VMValue): boolean {
    return value.type === ValueType.STRING_OBJ ||
        value.type === ValueType.ARRAY_OBJ ||
        value.type === ValueType.FUNCTION_OBJ;
}

export function asNumber(value: VMValue): number { return value.as.number!; }
export function asBoolean(value: VMValue): boolean { return value.as.boolean!; }
export function asObject(value: VMValue): VMObject { return value.as.obj!; }
export function asString(value: VMValue): VMString { return value.as.obj as VMString; }
export function asArray(value: VMValue): VMArray { return value.as.obj as VMArray; }
export function asFunction(value: VMValue): CompiledFunction { return value.as.obj as CompiledFunction; }