const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { checkEligibility } = require('./utils/logic');
const { Parser } = require('json2csv');

const app = express();
const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- 1. UPLOAD & PROCESS ---
app.post('/upload', upload.single('file'), async (req, res) => {
    const results = [];
    const missingData = [];
    
    const schemes = ["IFFCO TOKIO", "NSF", "FFE", "PRIF"];
    for (const name of schemes) {
        await prisma.scheme.upsert({ where: { name }, update: {}, create: { name } });
    }

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            let processed = 0;
            let conflictCount = 0;

            for (const row of results) {
                if (!row.email || !row.income) {
                    missingData.push(row);
                    continue;
                }

                const eligibleFor = checkEligibility(row);
                
                if (eligibleFor.length > 0) {
                    const student = await prisma.student.upsert({
                        where: { email: row.email },
                        update: {},
                        create: {
                            email: row.email,
                            firstName: row.first_name,
                            lastName: row.last_name,
                            income: parseFloat(row.income),
                            state: row.state,
                            district: row.district,
                            currentLevel: row.current_level,
                            percent12th: parseFloat(row.percent_12th),
                            mobile: row.mobile,
                            gender: row.gender,
                            dob: row.dob,
                            father: row.father
                        }
                    });

                    const status = eligibleFor.length > 1 ? "CONFLICT" : "CONFIRMED";
                    if (status === "CONFLICT") conflictCount++;

                    for (const schemeName of eligibleFor) {
                        const scheme = await prisma.scheme.findUnique({ where: { name: schemeName } });
                        await prisma.enrollment.create({
                            data: {
                                studentId: student.id,
                                schemeId: scheme.id,
                                status: status
                            }
                        }).catch(() => {}); 
                    }
                }
                processed++;
            }
            fs.unlinkSync(req.file.path);
            res.json({ processed, missing: missingData.length, conflicts: conflictCount });
        });
});

// --- 2. BULK RESOLVE ---
app.post('/resolve-all', async (req, res) => {
    const { action, priorityScheme } = req.body;

    if (action === "KEEP_ALL") {
        await prisma.enrollment.updateMany({
            where: { status: "CONFLICT" },
            data: { status: "CONFIRMED" }
        });
        return res.json({ success: true, message: "All students enrolled in all eligible schemes." });
    }

    if (action === "PRIORITIZE") {
        const conflicts = await prisma.student.findMany({
            where: { enrollments: { some: { status: "CONFLICT" } } },
            include: { enrollments: { include: { scheme: true } } }
        });

        let resolvedCount = 0;

        for (const s of conflicts) {
            const hasPriority = s.enrollments.find(e => e.scheme.name === priorityScheme);

            if (hasPriority) {
                await prisma.enrollment.update({
                    where: { id: hasPriority.id },
                    data: { status: "CONFIRMED" }
                });
                await prisma.enrollment.deleteMany({
                    where: {
                        studentId: s.id,
                        status: "CONFLICT",
                        id: { not: hasPriority.id }
                    }
                });
                resolvedCount++;
            }
        }
        return res.json({ success: true, message: `Prioritized ${priorityScheme} for ${resolvedCount} students.` });
    }
});

// --- 3. GET DATA & STATS ---
app.get('/stats', async (req, res) => {
    const students = await prisma.student.findMany({
        include: { enrollments: { include: { scheme: true } } }
    });
    res.json(students);
});

app.get('/scheme/:name', async (req, res) => {
    const schemeName = req.params.name;
    
    // Build query based on status and scheme
    let whereClause = { status: "CONFIRMED" };
    if (schemeName !== "All") {
        whereClause.scheme = { name: schemeName };
    } else {
        // If All, we don't filter by scheme, just confirmed status? 
        // Actually for "All" view we usually want everything including conflicts
        const students = await prisma.student.findMany({
            include: { enrollments: { include: { scheme: true } } }
        });
        return res.json(students);
    }

    const enrollments = await prisma.enrollment.findMany({
        where: whereClause,
        include: { student: true, scheme: true }
    });
    res.json(enrollments.map(e => ({ ...e.student, enrollments: [e] })));
});

// --- 4. EXPORT MOODLE (Filtered) ---
app.get('/export', async (req, res) => {
    const schemeName = req.query.scheme || "All";
    
    let whereClause = { status: "CONFIRMED" };
    if (schemeName !== "All") {
        whereClause.scheme = { name: schemeName };
    }

    const enrollments = await prisma.enrollment.findMany({
        where: whereClause,
        include: { student: true, scheme: true }
    });

    const fields = [
        "email", "username", "password", "role1", "firstname", "lastname",
        "profile_field_Gender", "profile_field_DOB", "profile_field_State", 
        "profile_field_domicile_district", "course1", "profile_field_mobile", 
        "profile_field_father", "profile_field_schemename", 
        "profile_field_percentage_12", "profile_field_Family_income", 
        "profile_field_college_name", "profile_field_course", 
        "profile_field_applicationyear", "profile_field_application_type"
    ];

    const data = enrollments.map(e => {
        const s = e.student;
        return {
            email: s.email,
            username: s.email.split('@')[0],
            password: "ChangeMe123!",
            role1: "student",
            firstname: s.firstName,
            lastname: s.lastName,
            profile_field_Gender: s.gender,
            profile_field_DOB: s.dob,
            profile_field_State: s.state,
            profile_field_domicile_district: s.district,
            course1: "scholarship_portal",
            profile_field_mobile: s.mobile,
            profile_field_father: s.father || "Unknown",
            profile_field_schemename: e.scheme.name,
            profile_field_percentage_12: s.percent12th,
            profile_field_Family_income: s.income,
            profile_field_college_name: "ABC College",
            profile_field_course: s.currentLevel,
            profile_field_applicationyear: "2025-2026",
            profile_field_application_type: "New"
        };
    });

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);
    
    const filename = schemeName === "All" ? "Moodle_Export_All.csv" : `Moodle_Export_${schemeName}.csv`;

    res.header('Content-Type', 'text/csv');
    res.attachment(filename);
    res.send(csv);
});

// --- 5. RESET DB ---
app.delete('/clear-data', async (req, res) => {
    try {
        await prisma.enrollment.deleteMany({});
        await prisma.student.deleteMany({});
        res.json({ success: true, message: "Database cleared." });
    } catch (e) {
        res.status(500).json({ error: "Failed to clear data" });
    }
});

app.listen(3000, () => console.log('Server running on port http://localhost:3000'));