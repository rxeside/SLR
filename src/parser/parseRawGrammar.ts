function parseRawGrammar(fileName: string): string[] {
    const fs = require('fs');
    const grammarText = fs.readFileSync(fileName, 'utf8');
    return grammarText.split('\n').filter((line: string) => line.trim() !== '');
}

export {
    parseRawGrammar
}