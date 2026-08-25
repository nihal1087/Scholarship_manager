const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { Parser } = require('json2csv');
const { checkEligibility } = require('./utils/logic');
const { SCHEME_LIST } = require('./utils/schemes');

const app = express();
const prisma = new PrismaClient();
const uploadDirectory = path.join(__dirname, 'uploads');
const maxUploadBytes = Number.parseInt(process.env.MAX_UPLOAD_BYTES || '', 10) || 5 * 1024 * 1024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
    dest: uploadDirectory,
    limits: { fileSize: maxUploadBytes },
    fileFilter: (req, file, callback) => {
        if (path.extname(file.originalname).toLowerCase() !== '.csv') {
            const error = new Error('Only CSV files are supported.');
            error.statusCode = 400;
            callback(error);
            return;
        }

        callback(null, true);
    },
});

const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : null;

if (allowedOrigins) {
    app.use(cors({ origin: allowedOrigins }));
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const asyncRoute = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const cleanString = (value) => {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
};

const parseDecimal = (value) => {
    const cleaned = cleanString(value);
    if (cleaned === null) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseInteger = (value) => {
    const cleaned = cleanString(value);
    if (cleaned === null) return null;
    const parsed = Number.parseInt(cleaned, 10);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeEmail = (email) => cleanString(email)?.toLowerCase() || null;

function normalizeCsvRow(row) {
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.trim(), cleanString(value) || ''])
    );
}

function validateImportRow(row) {
    const errors = [];
    const email = normalizeEmail(row.email);

    if (!email || !emailPattern.test(email)) errors.push('valid email');
    if (parseDecimal(row.income) === null) errors.push('income');

    return errors;
}

function toStudentInput(row) {
    return {
        email: normalizeEmail(row.email),
        firstName: cleanString(row.first_name),
        lastName: cleanString(row.last_name),
        mobile: cleanString(row.mobile),
        gender: cleanString(row.gender),
        dob: cleanString(row.dob),
        state: cleanString(row.state),
        district: cleanString(row.district),
        income: parseDecimal(row.income),
        category: cleanString(row.category),
        currentLevel: cleanString(row.current_level),
        currentClass: cleanString(row.current_class),
        diplomaType: cleanString(row.diploma_type),
        percent10th: parseDecimal(row.percent_10th),
        passYear10th: parseInteger(row.passing_year_10th),
        percent12th: parseDecimal(row.percent_12th),
        passYear12th: parseInteger(row.passing_year_12th),
        percentLast: parseDecimal(row.percent_last),
        entranceExam: cleanString(row.entrance_exam),
        entranceRank: parseInteger(row.entrance_rank),
        father: cleanString(row.father),
    };
}

function readCsvRows(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];

        fs.createReadStream(filePath)
            .on('error', reject)
            .pipe(csvParser({
                mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
            }))
            .on('data', (row) => rows.push(normalizeCsvRow(row)))
            .on('error', reject)
            .on('end', () => resolve(rows));
    });
}

async function seedSchemes() {
    await prisma.$transaction(
        SCHEME_LIST.map((name) =>
            prisma.scheme.upsert({
                where: { name },
                update: {},
                create: { name },
            })
        )
    );
    const schemes = await prisma.scheme.findMany();
    return new Map(schemes.map((scheme) => [scheme.name, scheme]));
}

function resolveSchemeName(value) {
    if (!value || value === 'All') return 'All';
    return SCHEME_LIST.find((name) => name.toLowerCase() === String(value).toLowerCase()) || null;
}

async function persistEligibleStudent(row, eligibleFor, schemeMap) {
    const student = await prisma.student.upsert({
        where: { email: normalizeEmail(row.email) },
        update: toStudentInput(row),
        create: toStudentInput(row),
    });

    const status = eligibleFor.length > 1 ? 'CONFLICT' : 'CONFIRMED';
    const schemes = eligibleFor.map((name) => schemeMap.get(name)).filter(Boolean);

    await prisma.enrollment.deleteMany({
        where: {
            studentId: student.id,
            scheme: { name: { notIn: eligibleFor } },
        },
    });

    await prisma.$transaction(
        schemes.map((scheme) =>
            prisma.enrollment.upsert({
                where: {
                    studentId_schemeId: {
                        studentId: student.id,
                        schemeId: scheme.id,
                    },
                },
                update: { status },
                create: {
                    studentId: student.id,
                    schemeId: scheme.id,
                    status,
                },
            })
        )
    );

    return status;
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/upload', upload.single('file'), asyncRoute(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Please attach a CSV file.' });
    }

    const schemeMap = await seedSchemes();

    let rows = [];
    try {
        rows = await readCsvRows(req.file.path);
    } finally {
        await fs.promises.unlink(req.file.path).catch(() => {});
    }

    const invalidRows = [];
    let processed = 0;
    let imported = 0;
    let ineligible = 0;
    let conflicts = 0;

    for (const row of rows) {
        const errors = validateImportRow(row);

        if (errors.length > 0) {
            invalidRows.push({
                email: row.email || null,
                missing: errors,
            });
            continue;
        }

        processed++;

        const eligibleFor = checkEligibility(row);
        if (eligibleFor.length === 0) {
            ineligible++;
            continue;
        }

        const status = await persistEligibleStudent(row, eligibleFor, schemeMap);
        imported++;

        if (status === 'CONFLICT') {
            conflicts++;
        }
    }

    res.json({
        processed,
        imported,
        ineligible,
        missing: invalidRows.length,
        conflicts,
    });
}));

app.post('/resolve-all', asyncRoute(async (req, res) => {
    const { action, priorityScheme } = req.body;

    if (action === 'KEEP_ALL') {
        const result = await prisma.enrollment.updateMany({
            where: { status: 'CONFLICT' },
            data: { status: 'CONFIRMED' },
        });

        return res.json({
            success: true,
            message: `${result.count} conflicting enrollments were confirmed.`,
        });
    }

    if (action !== 'PRIORITIZE') {
        return res.status(400).json({ error: 'Unsupported conflict resolution action.' });
    }

    const resolvedScheme = resolveSchemeName(priorityScheme);
    if (!resolvedScheme || resolvedScheme === 'All') {
        return res.status(400).json({ error: 'Please choose a valid priority scheme.' });
    }

    const conflicts = await prisma.student.findMany({
        where: { enrollments: { some: { status: 'CONFLICT' } } },
        include: {
            enrollments: {
                where: { status: 'CONFLICT' },
                include: { scheme: true },
            },
        },
    });

    let resolvedCount = 0;

    for (const student of conflicts) {
        const priorityEnrollment = student.enrollments.find(
            (enrollment) => enrollment.scheme.name === resolvedScheme
        );

        if (!priorityEnrollment) continue;

        await prisma.$transaction([
            prisma.enrollment.update({
                where: { id: priorityEnrollment.id },
                data: { status: 'CONFIRMED' },
            }),
            prisma.enrollment.deleteMany({
                where: {
                    studentId: student.id,
                    status: 'CONFLICT',
                    id: { not: priorityEnrollment.id },
                },
            }),
        ]);
        resolvedCount++;
    }

    res.json({
        success: true,
        message: `${resolvedCount} students were assigned to ${resolvedScheme}.`,
    });
}));

app.get('/stats', asyncRoute(async (req, res) => {
    const students = await prisma.student.findMany({
        orderBy: { createdAt: 'desc' },
        include: { enrollments: { include: { scheme: true } } },
    });

    res.json(students);
}));

app.get('/scheme/:name', asyncRoute(async (req, res) => {
    const schemeName = resolveSchemeName(req.params.name);

    if (!schemeName) {
        return res.status(400).json({ error: 'Unknown scholarship scheme.' });
    }

    if (schemeName === 'All') {
        const students = await prisma.student.findMany({
            orderBy: { createdAt: 'desc' },
            include: { enrollments: { include: { scheme: true } } },
        });
        return res.json(students);
    }

    const enrollments = await prisma.enrollment.findMany({
        where: {
            status: 'CONFIRMED',
            scheme: { name: schemeName },
        },
        include: { student: true, scheme: true },
    });

    res.json(enrollments.map((enrollment) => ({
        ...enrollment.student,
        enrollments: [enrollment],
    })));
}));

app.get('/export', asyncRoute(async (req, res) => {
    const schemeName = resolveSchemeName(req.query.scheme);

    if (!schemeName) {
        return res.status(400).json({ error: 'Unknown scholarship scheme.' });
    }

    const whereClause = { status: 'CONFIRMED' };
    if (schemeName !== 'All') {
        whereClause.scheme = { name: schemeName };
    }

    const enrollments = await prisma.enrollment.findMany({
        where: whereClause,
        include: { student: true, scheme: true },
    });

    const fields = [
        'email',
        'username',
        'password',
        'role1',
        'firstname',
        'lastname',
        'profile_field_Gender',
        'profile_field_DOB',
        'profile_field_State',
        'profile_field_domicile_district',
        'course1',
        'profile_field_mobile',
        'profile_field_father',
        'profile_field_schemename',
        'profile_field_percentage_12',
        'profile_field_Family_income',
        'profile_field_college_name',
        'profile_field_course',
        'profile_field_applicationyear',
        'profile_field_application_type',
    ];

    const data = enrollments.map(({ student, scheme }) => ({
        email: student.email,
        username: student.email.split('@')[0],
        password: 'ChangeMe123!',
        role1: 'student',
        firstname: student.firstName,
        lastname: student.lastName,
        profile_field_Gender: student.gender,
        profile_field_DOB: student.dob,
        profile_field_State: student.state,
        profile_field_domicile_district: student.district,
        course1: 'scholarship_portal',
        profile_field_mobile: student.mobile,
        profile_field_father: student.father || 'Unknown',
        profile_field_schemename: scheme.name,
        profile_field_percentage_12: student.percent12th,
        profile_field_Family_income: student.income,
        profile_field_college_name: 'ABC College',
        profile_field_course: student.currentLevel,
        profile_field_applicationyear: '2025-2026',
        profile_field_application_type: 'New',
    }));

    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    const suffix = schemeName === 'All' ? 'All' : schemeName.replace(/[^a-z0-9]+/gi, '_');

    res.header('Content-Type', 'text/csv');
    res.attachment(`Moodle_Export_${suffix}.csv`);
    res.send(csv);
}));

app.delete('/clear-data', asyncRoute(async (req, res) => {
    await prisma.enrollment.deleteMany({});
    await prisma.student.deleteMany({});

    res.json({ success: true, message: 'Student and enrollment data was cleared.' });
}));

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? `CSV file is too large. Maximum size is ${Math.round(maxUploadBytes / 1024 / 1024)} MB.`
            : err.message;
        return res.status(400).json({ error: message });
    }

    const statusCode = err.statusCode || 500;
    const message = statusCode >= 500 ? 'Unexpected server error.' : err.message;

    if (statusCode >= 500) {
        console.error(err);
    }

    res.status(statusCode).json({ error: message });
});

function startServer() {
    const port = process.env.PORT || 3002;
    const server = app.listen(port, () => {
        console.log(`Scholarship Manager listening at http://localhost:${port}`);
    });

    const shutdown = async () => {
        await prisma.$disconnect();
        server.close(() => process.exit(0));
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

if (require.main === module) {
    startServer();
}

module.exports = { app };
