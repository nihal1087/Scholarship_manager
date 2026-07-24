# Scholarship Manager

Scholarship Manager is a small internal admin dashboard built to simplify scholarship intake, eligibility review, conflict handling, and enrollment export. It is designed for teams that still receive student applications as CSV files and need a structured way to review them before sending confirmed students to a learning platform such as Moodle.

This project turns a spreadsheet-driven workflow into a lightweight application that can import data, validate it, evaluate scholarships, flag conflicts, and export the final results in a clean CSV format.

## What the project does

Scholarship Manager helps administrators:

- import student records from CSV files
- validate incoming rows before they are stored
- evaluate scholarship eligibility for multiple schemes
- detect students who qualify for more than one scholarship
- resolve conflicts by keeping all eligible enrollments or prioritizing one scheme
- export confirmed enrollments as Moodle-ready CSV data
- store student, scheme, and enrollment records locally using Prisma and SQLite

The goal is not to replace a full enterprise system, but to make scholarship review faster, more consistent, and easier to manage.

## Why this project exists

Scholarship review often starts with a spreadsheet. That works for a while, but it quickly becomes difficult to track:

- which students were imported
- which ones met the rules
- which ones fell into more than one category
- which applications should be confirmed or rejected
- how to export everything in a format that another system can use

This project solves that by giving the team one place to do the process end to end.

## Main features

### CSV upload and import
The app accepts CSV files, parses the contents, and validates the incoming rows. Missing or malformed data is handled in a controlled way, and summary information is returned after each import.

### Eligibility evaluation
Each student record is checked against scholarship rules for the following schemes:

- IFFCO TOKIO
- NSF
- FFE
- PRIF

The logic is implemented in the eligibility engine and returns the schemes a student qualifies for.

### Conflict detection
If a student becomes eligible for multiple schemes, the system marks that record as a conflict. This gives administrators a clear signal that the student needs a manual decision.

### Conflict resolution
The UI offers two resolution paths:

- keep all eligible enrollments
- prioritize one selected scheme and remove the others

This makes it easy to decide how a conflict should be treated without editing the source data manually.

### Export to Moodle-style CSV
Once the review is complete, the app can export confirmed enrollments in a CSV format that is suitable for Moodle bulk user or enrollment import workflows.

## Eligibility rules

The current eligibility rules are implemented in the logic layer and are based on a practical set of conditions around income, state, district, academic performance, and entrance exam details.

### IFFCO TOKIO
A student may qualify for IFFCO TOKIO if they meet Bihar-based criteria and satisfy academic thresholds based on their current education level.

The rules depend on factors such as:

- income
- state
- current education level
- class or diploma stream
- marks in the 10th and/or 12th examinations
- passing years

### NSF
NSF eligibility is focused on students from Bihar who are in the diploma stream and meet entrance exam and rank thresholds.

### FFE
FFE evaluates students using academic performance and entrance exam rank criteria. It is designed around students who meet score thresholds and fall within acceptable rank ranges.

### PRIF
PRIF eligibility is currently evaluated based on district, with a rule that checks whether the student is from Patna.

These rules are intentionally straightforward and easy to modify as policies change.

## Tech stack

The project uses a lightweight stack that is easy to run locally:

- Node.js
- Express
- Prisma ORM
- SQLite
- Vanilla HTML, CSS, and JavaScript
- Multer for file uploads
- csv-parser for CSV parsing
- json2csv for export generation

The stack is simple by design, which makes the project easy to understand and extend.

## Project structure

The repository is organized around a clear workflow:

- server.js: main Express server and API routes
- public/index.html: dashboard layout
- public/script.js: client-side behavior and API calls
- public/style.css: styling for the admin UI
- utils/logic.js: scholarship eligibility rules
- utils/schemes.js: scholarship constants
- prisma/schema.prisma: Prisma schema and database models
- tests/eligibility.test.js: unit tests for eligibility logic
- dummy.py: script used to generate sample CSV data
- test.py: duplicate or supporting sample data generator
- Comprehensive_Test_Data.csv: example input dataset

## Getting started

### Prerequisites

You will need:

- Node.js 18 or newer
- npm

### Install dependencies

Run:

```bash
npm install
```

### Prepare the database

Generate the Prisma client and push the schema:

```bash
npm run prisma:generate
npm run db:push
```

### Start the app

Run:

```bash
npm start
```

Then open the app in your browser at:

```text
http://localhost:3002
```

If you set a different PORT value in your environment, the app will use that instead.

## Environment variables

The app supports a few environment variables:

```text
PORT=3002
MAX_UPLOAD_BYTES=5242880
CORS_ORIGIN=http://localhost:3002
```

- PORT sets the server port
- MAX_UPLOAD_BYTES limits uploaded file size
- CORS_ORIGIN is optional and allows specific frontend origins

If CORS_ORIGIN is not set, the server is expected to serve the browser app and API from the same origin.

## CSV input format

The importer expects CSV headers in snake_case format, similar to:

```text
first_name,last_name,email,mobile,gender,dob,father,income,state,district,current_level,current_class,diploma_type,percent_10th,passing_year_10th,percent_12th,passing_year_12th,percent_last,entrance_exam,entrance_rank
```

Rows without a valid email or income are skipped and reported in the import summary.

## Typical workflow

A normal user flow looks like this:

1. Upload a CSV file from the dashboard.
2. The server validates and parses the rows.
3. Each row is evaluated for scholarship eligibility.
4. Eligible students are stored in the database.
5. If a student qualifies for multiple schemes, the record is marked as a conflict.
6. The admin resolves the conflict using the available actions.
7. Confirmed enrollments are exported in CSV format.

That workflow is intentionally simple and focused on real operational use.

## API overview

The server exposes a small set of API routes:

- GET /health: checks whether the service is running
- POST /upload: imports and processes a CSV file
- POST /resolve-all: applies conflict-resolution actions
- GET /stats: returns student and enrollment summary data
- GET /scheme/:name: returns records for a specific scheme
- GET /export: exports confirmed enrollments as CSV
- DELETE /clear-data: clears imported student and enrollment data

## Testing

The repository includes tests for the eligibility engine.

Run:

```bash
npm test
```

These tests help confirm that the rules continue to behave as expected as the project evolves.

## Useful commands

```bash
npm install
npm start
npm test
npm run prisma:generate
npm run db:push
```

## Notes

This project is a practical local-first prototype rather than a large-scale production platform. It is intentionally lightweight and easy to run, while still covering the core needs of scholarship review and export.

If you are exploring the codebase for the first time, the best places to start are:

- server.js for the application flow
- logic.js for the scholarship rules
- script.js for the dashboard behavior

## Summary

Scholarship Manager is a focused internal tool for handling scholarship applications from CSV import to final export. It brings together data intake, validation, eligibility review, conflict handling, and Moodle-ready export in one place, making it much easier to manage scholarship decisions without relying on manual spreadsheet work.
