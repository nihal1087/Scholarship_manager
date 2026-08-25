const test = require('node:test');
const assert = require('node:assert/strict');
const { checkEligibility } = require('../utils/logic');
const { SCHEME_NAMES } = require('../utils/schemes');

const baseStudent = {
    income: 500000,
    state: 'Delhi',
    district: 'Other',
    current_level: 'School',
    current_class: 'Class 11',
    diploma_type: 'NA',
    percent_10th: 50,
    passing_year_10th: 2020,
    percent_12th: 0,
    passing_year_12th: 0,
    percent_last: 50,
    entrance_exam: 'None',
    entrance_rank: 0,
};

test('marks a qualifying Bihar class 11 student eligible for IFFCO TOKIO', () => {
    const result = checkEligibility({
        ...baseStudent,
        income: 250000,
        state: 'Bihar',
        current_level: 'School',
        current_class: 'Class 11',
        percent_10th: 72,
        passing_year_10th: 2025,
        percent_last: 72,
    });

    assert.deepEqual(result, [SCHEME_NAMES.IFFCO_TOKIO]);
});

test('marks DCECE diploma students eligible for NSF when rank and scores qualify', () => {
    const result = checkEligibility({
        ...baseStudent,
        income: 180000,
        state: 'Bihar',
        current_level: 'Diploma',
        diploma_type: 'After 10th',
        percent_10th: 88,
        passing_year_10th: 2025,
        entrance_exam: 'DCECE',
        entrance_rank: 1200,
    });

    assert.deepEqual(result, [SCHEME_NAMES.NSF]);
});

test('marks eligible engineering entrance records for FFE', () => {
    const result = checkEligibility({
        ...baseStudent,
        income: 280000,
        state: 'Bihar',
        current_level: 'Undergraduate',
        percent_10th: 82,
        passing_year_10th: 2023,
        percent_12th: 84,
        passing_year_12th: 2025,
        percent_last: 74,
        entrance_exam: 'JEE Mains',
        entrance_rank: 85000,
    });

    assert.deepEqual(result, [SCHEME_NAMES.FFE]);
});

test('adds PRIF eligibility for Patna district records', () => {
    const result = checkEligibility({
        ...baseStudent,
        district: 'Patna',
    });

    assert.deepEqual(result, [SCHEME_NAMES.PRIF]);
});

test('returns no schemes when the record does not satisfy any rule', () => {
    assert.deepEqual(checkEligibility(baseStudent), []);
});

test('supports camelCase DB student object format for IFFCO TOKIO eligibility', () => {
    const result = checkEligibility({
        income: 250000,
        state: 'Bihar',
        currentLevel: 'School',
        currentClass: 'Class 11',
        percent10th: 72,
        passYear10th: 2025,
        percentLast: 72,
    });

    assert.deepEqual(result, [SCHEME_NAMES.IFFCO_TOKIO]);
});

