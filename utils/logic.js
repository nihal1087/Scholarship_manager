// utils/logic.js

const checkEligibility = (s) => {
    let eligibleSchemes = [];

    // Helper to safely parse numbers
    const getInt = (val) => parseInt(val) || 0;
    const getFloat = (val) => parseFloat(val) || 0.0;
    
    // Normalize Data
    const income = getFloat(s.income);
    const state = s.state?.trim();
    const currentLevel = s.current_level?.trim(); // School, Diploma, Undergraduate
    const p10 = getFloat(s.percent_10th);
    const y10 = getInt(s.passing_year_10th);
    const p12 = getFloat(s.percent_12th);
    const y12 = getInt(s.passing_year_12th);
    const pLast = getFloat(s.percent_last);
    
    // --- 1. IFFCO TOKIO Logic ---
    let isIffco = false;
    if (income <= 300000 && state === "Bihar") {
        if (currentLevel === "School") {
            if (s.current_class === "Class 11" && y10 === 2025 && pLast >= 60 && p10 >= 60 && p10 === pLast) isIffco = true;
            if (s.current_class === "Class 12" && y10 === 2024 && pLast >= 60 && p10 >= 60) isIffco = true;
        } else if (currentLevel === "Diploma") {
            if (s.diploma_type === "After 10th" && y10 === 2025 && pLast >= 60 && p10 >= 60) isIffco = true;
            if (s.diploma_type === "After 12th" && y10 === 2023 && pLast >= 60 && p10 >= 60 && y12 === 2025 && p12 >= 60) isIffco = true;
        } else if (currentLevel === "Undergraduate") {
            if (pLast >= 60 && p10 >= 60 && y10 > 2023 && p12 >= 60 && y12 === 2025) isIffco = true;
        }
    }
    if (isIffco) eligibleSchemes.push("IFFCO TOKIO");

    // --- 2. NSF Logic ---
    let isNsf = false;
    if (income <= 200000 && state === "Bihar" && currentLevel === "Diploma") {
        if (s.entrance_exam === "DCECE" && getInt(s.entrance_rank) <= 4000) {
            if (s.diploma_type === "After 10th" && p10 >= 80 && y10 === 2025) isNsf = true;
            if (s.diploma_type === "After 12th" && y10 === 2023 && p12 >= 80 && y12 === 2025) isNsf = true;
        }
    }
    if (isNsf) eligibleSchemes.push("NSF");

    // --- 3. FFE Logic ---
    let isFfe = false;
    if (income <= 300000 && state === "Bihar") {
        const validYear10 = [2021, 2022, 2023].includes(y10);
        const validYear12 = [2023, 2024, 2025].includes(y12);
        
        if (p10 >= 70 && validYear10 && p12 >= 70 && validYear12) {
            let rankOk = false;
            const rank = getInt(s.entrance_rank);
            if (s.entrance_exam === "JEE Mains" && rank <= 90000) rankOk = true;
            if (s.entrance_exam === "JEE Advanced" && rank <= 20000) rankOk = true;
            if (s.entrance_exam === "NEET" && rank <= 40000) rankOk = true;
            if (s.entrance_exam === "BCECE" && rank <= 10000) rankOk = true;

            if (rankOk) isFfe = true;
        }
    }
    if (isFfe) eligibleSchemes.push("FFE");

    // --- 4. PRIF Logic ---
    if (s.district === "Patna") eligibleSchemes.push("PRIF");

    return eligibleSchemes;
};

module.exports = { checkEligibility };