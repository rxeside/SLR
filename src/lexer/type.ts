export class Token {
    constructor(
        public readonly type: string,
        public readonly value: string,
        public readonly line: number,
        public readonly column: number
    ) {}

    toString(): string {
        return `Token(type=${this.type}, value='${this.value}', L${this.line}C${this.column})`;
    }
}