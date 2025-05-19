export const testInputs = [
    // Variable declarations
    "var x: number = 42;",
    "var y: string = \"hello\";",
    "var z: boolean = true;",
    
    // Constant declarations
    "const PI: number = 3.14;",
    "const GREETING: string = \"Hello, World!\";",
    
    // Function declarations
    "func add(a: number, b: number): number { return a + b; }",
    "func greet(name: string): string { return \"Hello, \" + name; }",
    
    // If statements
    "if (x > 0) { var y: number = 1; }",
    "if (x > 0) { var y: number = 1; } else { var y: number = 0; }",
    "if (x > 0) { var y: number = 1; } elif (x < 0) { var y: number = -1; } else { var y: number = 0; }",
    
    // While loops
    "while (x > 0) { x = x - 1; }",
    
    // For loops
    "for (var i: number = 0; i < 10; i = i + 1) { var sum: number = sum + i; }",
    
    // Expressions
    "var result: number = (1 + 2) * 3;",
    "var bool: boolean = !(x > 0);",
    
    // Object expressions
    "var person: { name: string, age: number } = { name: \"John\", age: 30 };",
    
    // Array expressions
    "var numbers: number[] = [1, 2, 3, 4, 5];",
    
    // Function calls
    "var sum: number = add(1, 2);",
    
    // Comments
    "// This is a single line comment",
    "/* This is a multi-line comment */",
    
    // Complex example
    `func calculate(x: number, y: number): number {
        if (x > 0) {
            var result: number = x + y;
            return result;
        } else {
            return 0;
        }
    }`
]; 