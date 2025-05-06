/** Простейшее сравнение двух массивов на полное совпадение */
const arrayEqual = <T>(a: T[], b: T[]): boolean => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

export {
    arrayEqual,
}