import {ValueType, VMValue} from './value';

export class Chunk {
    public code: number[]; // Массив байт (чисел от 0 до 255)
    public constants: VMValue[];
    public lines: number[]; // Номера строк исходного кода для каждого байта (для отладки)

    constructor() {
        this.code = [];
        this.constants = [];
        this.lines = [];
    }

    public writeByte(byte: number, line: number): void {
        this.code.push(byte);
        this.lines.push(line);
    }

    public addConstant(value: VMValue): number {
        // Проверяем, есть ли уже такая константа (для экономии места)
        // Для простых типов (num, bool) можно сравнивать значения.
        // Для объектов (строки, функции) - нужно будет аккуратнее, пока просто добавляем.
        // TODO: Оптимизировать добавление констант для строк и других объектов
        const existingIndex = this.constants.findIndex(c => {
            if (c.type === value.type) {
                if (c.type === ValueType.NUM) return c.as.number === value.as.number;
                if (c.type === ValueType.BOOL) return c.as.boolean === value.as.boolean;
                // Для объектов пока просто добавляем новые
            }
            return false;
        });

        if (existingIndex !== -1) {
            return existingIndex;
        }

        this.constants.push(value);
        return this.constants.length - 1;
    }

    // Метод для записи 16-битного операнда (например, индекса константы или смещения)
    public writeShort(short: number, line: number): void {
        this.writeByte((short >> 8) & 0xFF, line); // Старший байт
        this.writeByte(short & 0xFF, line);        // Младший байт
    }
}