const { SCHEME_NAMES } = require('./schemes');

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
    const income = toNumber(student.income);
    const p10 = toNumber(student.percent_10th);
    const y10 = toInteger(student.passing_year_10th);
    const p12 = toNumber(student.percent_12th);
    const y12 = toInteger(student.passing_year_12th);
    const pLast = toNumber(student.percent_last);

    if (income > 300000 || !sameText(student.state, 'Bihar')) {
        return false;
    }

    if (sameText(student.current_level, 'School')) {
        const isClass11 = sameText(student.current_class, 'Class 11') && y10 === 2025 && pLast >= 60 && p10 >= 60 && p10 === pLast;
        const isClass12 = sameText(student.current_class, 'Class 12') && y10 === 2024 && pLast >= 60 && p10 >= 60;
        return isClass11 || isClass12;
    }

    if (sameText(student.current_level, 'Diploma')) {
        const after10th = sameText(student.diploma_type, 'After 10th') && y10 === 2025 && pLast >= 60 && p10 >= 60;
        const after12th = sameText(student.diploma_type, 'After 12th') && y10 === 2023 && pLast >= 60 && p10 >= 60 && y12 === 2025 && p12 >= 60;
        return after10th || after12th;
    }

    if (sameText(student.current_level, 'Undergraduate')) {
        return pLast >= 60 && p10 >= 60 && y10 > 2023 && p12 >= 60 && y12 === 2025;
    }

    return false;
}

function qualifiesForNsf(student) {
    const p10 = toNumber(student.percent_10th);
    const y10 = toInteger(student.passing_year_10th);
    const p12 = toNumber(student.percent_12th);
    const y12 = toInteger(student.passing_year_12th);
    const rank = toInteger(student.entrance_rank);

    if (
        toNumber(student.income) > 200000 ||
        !sameText(student.state, 'Bihar') ||
        !sameText(student.current_level, 'Diploma') ||
        !sameText(student.entrance_exam, 'DCECE') ||
        rank > 4000
    ) {
        return false;
    }

    const after10th = sameText(student.diploma_type, 'After 10th') && p10 >= 80 && y10 === 2025;
    const after12th = sameText(student.diploma_type, 'After 12th') && y10 === 2023 && p12 >= 80 && y12 === 2025;

    return after10th || after12th;
}

function qualifiesForFfe(student) {
    const validYear10 = [2021, 2022, 2023].includes(toInteger(student.passing_year_10th));
    const validYear12 = [2023, 2024, 2025].includes(toInteger(student.passing_year_12th));
    const rank = toInteger(student.entrance_rank);

    if (
        toNumber(student.income) > 300000 ||
        !sameText(student.state, 'Bihar') ||
        toNumber(student.percent_10th) < 70 ||
        toNumber(student.percent_12th) < 70 ||
        !validYear10 ||
        !validYear12
    ) {
        return false;
    }

    return (
        (sameText(student.entrance_exam, 'JEE Mains') && rank <= 90000) ||
        (sameText(student.entrance_exam, 'JEE Advanced') && rank <= 20000) ||
        (sameText(student.entrance_exam, 'NEET') && rank <= 40000) ||
        (sameText(student.entrance_exam, 'BCECE') && rank <= 10000)
    );
}

function qualifiesForPrif(student) {
    return sameText(student.district, 'Patna');
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
