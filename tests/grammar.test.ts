
describe('Grammar Tests', () => {
    beforeAll(() => {
        // Читаем грамматику из файла
        const fs = require('fs');
        const grammarText = fs.readFileSync('Grammar.txt', 'utf8');
        const grammarLines = grammarText.split('\n').filter((line: string) => line.trim() !== '');
        
        // Создаем генератор таблицы переходов
    });
}); 