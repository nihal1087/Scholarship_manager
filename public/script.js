const fileInput = document.getElementById('csv-upload');
const chatWindow = document.getElementById('chat-window');
const tableBody = document.getElementById('student-table');
const filterSelect = document.getElementById('filterSelect');
const exportButton = document.getElementById('exportButton');
const clearDataButton = document.getElementById('clearDataButton');
const uploadLabel = document.getElementById('uploadLabel');

const prioritySchemes = ['IFFCO TOKIO', 'NSF', 'FFE', 'PRIF'];

uploadLabel.addEventListener('click', resetFilePicker);
fileInput.addEventListener('change', handleUpload);
filterSelect.addEventListener('change', filterStudents);
exportButton.addEventListener('click', exportData);
clearDataButton.addEventListener('click', clearData);

function resetFilePicker() {
    if (!fileInput.disabled) {
        fileInput.value = '';
    }
}

async function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    addMessage('user', `Importing ${file.name}`);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const data = await requestJson('/upload', {
            method: 'POST',
            body: formData,
        });

        addSummaryMessage(data);

        if (data.conflicts > 0) {
            askBulkResolution(data.conflicts);
        } else {
            addMessage('system', 'No enrollment conflicts were found.');
        }

        await loadStats();
    } catch (error) {
        addMessage('system', error.message || 'The CSV import could not be completed.');
    } finally {
        setImporting(false);
        fileInput.value = '';
    }
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const payload = response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : {};

    if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}.`);
    }

    return payload;
}

function setImporting(isImporting) {
    fileInput.disabled = isImporting;
    uploadLabel.classList.toggle('is-loading', isImporting);
    uploadLabel.querySelector('span').textContent = isImporting ? 'Processing CSV' : 'Upload CSV File';
}

function addSummaryMessage(data) {
    const details = [
        ['Rows reviewed', data.processed],
        ['Eligible records', data.imported],
        ['Ineligible rows', data.ineligible],
        ['Invalid rows', data.missing],
        ['Conflicts', data.conflicts],
    ];

    addMessage('system', 'CSV import completed.', details);
}

function addMessage(sender, text, details = []) {
    const message = document.createElement('div');
    message.className = `message ${sender}`;

    const body = document.createElement('p');
    body.textContent = text;
    message.appendChild(body);

    if (details.length > 0) {
        const list = document.createElement('dl');
        list.className = 'message-details';

        details.forEach(([label, value]) => {
            const term = document.createElement('dt');
            term.textContent = label;

            const description = document.createElement('dd');
            description.textContent = value ?? 0;

            list.append(term, description);
        });

        message.appendChild(list);
    }

    chatWindow.appendChild(message);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function askBulkResolution(count) {
    addMessage('system', `${count} students are eligible for more than one scholarship.`);

    const message = document.createElement('div');
    message.className = 'message system';

    const prompt = document.createElement('p');
    prompt.textContent = 'Choose how to resolve the current conflicts.';
    message.appendChild(prompt);

    const options = document.createElement('div');
    options.className = 'options';
    options.appendChild(createResolveButton('Keep All', 'KEEP_ALL'));

    prioritySchemes.forEach((scheme) => {
        options.appendChild(createResolveButton(scheme, 'PRIORITIZE', scheme));
    });

    message.appendChild(options);
    chatWindow.appendChild(message);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    refreshIcons();
}

function createResolveButton(label, action, schemeName = null) {
    const button = document.createElement('button');
    button.className = 'option-btn';
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => bulkResolve(action, schemeName));
    return button;
}

async function bulkResolve(action, schemeName = null) {
    const actionLabel = action === 'KEEP_ALL' ? 'Keep all eligible enrollments' : `Prioritize ${schemeName}`;
    addMessage('user', actionLabel);

    try {
        const data = await requestJson('/resolve-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, priorityScheme: schemeName }),
        });

        addMessage('system', data.message);
        await loadStats();
    } catch (error) {
        addMessage('system', error.message || 'Conflicts could not be resolved.');
    }
}

async function filterStudents() {
    const scheme = filterSelect.value;

    try {
        const data = await requestJson(`/scheme/${encodeURIComponent(scheme)}`);
        renderTable(data);
    } catch (error) {
        addMessage('system', error.message || 'Student records could not be loaded.');
    }
}

async function loadStats() {
    try {
        const students = await requestJson('/stats');

        const conflicts = students.filter((student) =>
            student.enrollments.some((enrollment) => enrollment.status === 'CONFLICT')
        ).length;

        const confirmed = students.filter((student) =>
            student.enrollments.some((enrollment) => enrollment.status === 'CONFIRMED')
        ).length;

        document.getElementById('stat-total').textContent = students.length;
        document.getElementById('stat-conflict').textContent = conflicts;
        document.getElementById('stat-enrolled').textContent = confirmed;

        renderTable(students);
    } catch (error) {
        addMessage('system', error.message || 'Summary data could not be loaded.');
    }
}

function renderTable(students = []) {
    tableBody.replaceChildren();

    if (students.length === 0) {
        const row = document.createElement('tr');
        row.className = 'empty-row';

        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'No student records found for this view.';

        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    students.forEach((student) => {
        const row = document.createElement('tr');
        const hasConflict = student.enrollments.some((enrollment) => enrollment.status === 'CONFLICT');
        const hasConfirmed = student.enrollments.some((enrollment) => enrollment.status === 'CONFIRMED');
        const status = hasConflict ? 'Conflict' : hasConfirmed ? 'Confirmed' : 'Not enrolled';
        const schemes = student.enrollments.map((enrollment) => enrollment.scheme.name).join(', ') || 'None';

        row.appendChild(createStudentCell(student));
        row.appendChild(createTextCell(student.email || 'No email'));
        row.appendChild(createStatusCell(status));
        row.appendChild(createTextCell(schemes, 'scheme-list'));

        tableBody.appendChild(row);
    });
}

function createStudentCell(student) {
    const cell = document.createElement('td');
    const name = document.createElement('span');
    name.className = 'student-name';
    name.textContent = [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Unnamed student';
    cell.appendChild(name);
    return cell;
}

function createTextCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
}

function createStatusCell(status) {
    const cell = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = `status-pill status-${status.toLowerCase().replace(/\s+/g, '-')}`;
    pill.textContent = status;
    cell.appendChild(pill);
    return cell;
}

function exportData() {
    const scheme = filterSelect.value;
    window.location.href = `/export?scheme=${encodeURIComponent(scheme)}`;
}

async function clearData() {
    const confirmed = window.confirm('Clear all imported students and enrollments? This action cannot be undone.');
    if (!confirmed) return;

    try {
        const data = await requestJson('/clear-data', { method: 'DELETE' });
        addMessage('system', data.message);
        await loadStats();
    } catch (error) {
        addMessage('system', error.message || 'Data could not be cleared.');
    }
}

function refreshIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

loadStats();
