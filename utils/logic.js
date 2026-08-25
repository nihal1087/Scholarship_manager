const { SCHEME_NAMES } = require('./schemes');

const getVal = (obj, snakeKey, camelKey) =>
    obj && obj[snakeKey] !== undefined ? obj[snakeKey] : (obj ? obj[camelKey] : undefined);

const toNumber = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toInteger = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
};

const sameText = (value, expected) =>
    String(value || '').trim().toLowerCase() === expected.toLowerCase();

function qualifiesForIffcoTokio(student) {
    const income = toNumber(getVal(student, 'income', 'income'));
    const p10 = toNumber(getVal(student, 'percent_10th', 'percent10th'));
    const y10 = toInteger(getVal(student, 'passing_year_10th', 'passYear10th'));
    const p12 = toNumber(getVal(student, 'percent_12th', 'percent12th'));
    const y12 = toInteger(getVal(student, 'passing_year_12th', 'passYear12th'));
    const pLast = toNumber(getVal(student, 'percent_last', 'percentLast'));
    const currentLevel = getVal(student, 'current_level', 'currentLevel');
    const currentClass = getVal(student, 'current_class', 'currentClass');
    const diplomaType = getVal(student, 'diploma_type', 'diplomaType');
    const state = getVal(student, 'state', 'state');

    if (income > 300000 || !sameText(state, 'Bihar')) {
        return false;
    }

    if (sameText(currentLevel, 'School')) {
        const isClass11 = sameText(currentClass, 'Class 11') && y10 === 2025 && pLast >= 60 && p10 >= 60 && p10 === pLast;
        const isClass12 = sameText(currentClass, 'Class 12') && y10 === 2024 && pLast >= 60 && p10 >= 60;
        return isClass11 || isClass12;
    }

    if (sameText(currentLevel, 'Diploma')) {
        const after10th = sameText(diplomaType, 'After 10th') && y10 === 2025 && pLast >= 60 && p10 >= 60;
        const after12th = sameText(diplomaType, 'After 12th') && y10 === 2023 && pLast >= 60 && p10 >= 60 && y12 === 2025 && p12 >= 60;
        return after10th || after12th;
    }

    if (sameText(currentLevel, 'Undergraduate')) {
        return pLast >= 60 && p10 >= 60 && y10 > 2023 && p12 >= 60 && y12 === 2025;
    }

    return false;
}

function qualifiesForNsf(student) {
    const income = toNumber(getVal(student, 'income', 'income'));
    const state = getVal(student, 'state', 'state');
    const currentLevel = getVal(student, 'current_level', 'currentLevel');
    const diplomaType = getVal(student, 'diploma_type', 'diplomaType');
    const entranceExam = getVal(student, 'entrance_exam', 'entranceExam');
    const p10 = toNumber(getVal(student, 'percent_10th', 'percent10th'));
    const y10 = toInteger(getVal(student, 'passing_year_10th', 'passYear10th'));
    const p12 = toNumber(getVal(student, 'percent_12th', 'percent12th'));
    const y12 = toInteger(getVal(student, 'passing_year_12th', 'passYear12th'));
    const rank = toInteger(getVal(student, 'entrance_rank', 'entranceRank'));

    if (
        income > 200000 ||
        !sameText(state, 'Bihar') ||
        !sameText(currentLevel, 'Diploma') ||
        !sameText(entranceExam, 'DCECE') ||
        rank > 4000
    ) {
        return false;
    }

    const after10th = sameText(diplomaType, 'After 10th') && p10 >= 80 && y10 === 2025;
    const after12th = sameText(diplomaType, 'After 12th') && y10 === 2023 && p12 >= 80 && y12 === 2025;

    return after10th || after12th;
}

function qualifiesForFfe(student) {
    const income = toNumber(getVal(student, 'income', 'income'));
    const state = getVal(student, 'state', 'state');
    const p10 = toNumber(getVal(student, 'percent_10th', 'percent10th'));
    const y10 = toInteger(getVal(student, 'passing_year_10th', 'passYear10th'));
    const p12 = toNumber(getVal(student, 'percent_12th', 'percent12th'));
    const y12 = toInteger(getVal(student, 'passing_year_12th', 'passYear12th'));
    const entranceExam = getVal(student, 'entrance_exam', 'entranceExam');
    const rank = toInteger(getVal(student, 'entrance_rank', 'entranceRank'));

    const validYear10 = [2021, 2022, 2023].includes(y10);
    const validYear12 = [2023, 2024, 2025].includes(y12);

    if (
        income > 300000 ||
        !sameText(state, 'Bihar') ||
        p10 < 70 ||
        p12 < 70 ||
        !validYear10 ||
        !validYear12
    ) {
        return false;
    }

    return (
        (sameText(entranceExam, 'JEE Mains') && rank <= 90000) ||
        (sameText(entranceExam, 'JEE Advanced') && rank <= 20000) ||
        (sameText(entranceExam, 'NEET') && rank <= 40000) ||
        (sameText(entranceExam, 'BCECE') && rank <= 10000)
    );
}

function qualifiesForPrif(student) {
    const district = getVal(student, 'district', 'district');
    return sameText(district, 'Patna');
}

function checkEligibility(student) {
    const eligibleSchemes = [];

    if (qualifiesForIffcoTokio(student)) eligibleSchemes.push(SCHEME_NAMES.IFFCO_TOKIO);
    if (qualifiesForNsf(student)) eligibleSchemes.push(SCHEME_NAMES.NSF);
    if (qualifiesForFfe(student)) eligibleSchemes.push(SCHEME_NAMES.FFE);
    if (qualifiesForPrif(student)) eligibleSchemes.push(SCHEME_NAMES.PRIF);

    return eligibleSchemes;
}

module.exports = { checkEligibility };
