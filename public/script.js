const fileInput = document.getElementById('csv-upload');
const chatWindow = document.getElementById('chat-window');
const tableBody = document.getElementById('student-table');

// --- 1. UPLOAD HANDLER ---
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    addMessage("user", `Uploading ${file.name}...`);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        addMessage("bot", `✅ Processing Complete.<br>
        - Processed: <b>${data.processed}</b><br>
        - Missing Data: <b>${data.missing}</b><br>
        - Conflicts Found: <b>${data.conflicts}</b>`);

        if (data.conflicts > 0) {
            askBulkResolution(data.conflicts);
        } else {
            addMessage("bot", "No conflicts found. All eligible students enrolled.");
        }
        
        loadStats();
    } catch (err) {
        console.error(err);
        addMessage("bot", "Error uploading file.");
    }
});

// --- 2. CHAT UTILITIES ---
function addMessage(sender, html) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerHTML = html;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// --- 3. BULK RESOLUTION UI ---
function askBulkResolution(count) {
    addMessage("bot", `
        <p>⚠️ <b>${count} students</b> are eligible for multiple schemes.</p>
        <p>How do you want to handle these conflicts?</p>
        
        <div class="options">
            <button class="option-btn" onclick="bulkResolve('KEEP_ALL')">
                <b>Keep All</b> (Enroll in both)
            </button>
            <button class="option-btn" onclick="bulkResolve('PRIORITIZE', 'IFFCO TOKIO')">
                Prioritize <b>IFFCO</b>
            </button>
            <button class="option-btn" onclick="bulkResolve('PRIORITIZE', 'NSF')">
                Prioritize <b>NSF</b>
            </button>
        </div>
    `);
}

// --- 4. BULK RESOLVE ACTION ---
async function bulkResolve(action, schemeName = null) {
    let text = action === "KEEP_ALL" 
        ? "✅ Keep All (Enroll in both)" 
        : `✅ Prioritize ${schemeName}`;
    
    addMessage("user", text);
    
    const res = await fetch('/resolve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, priorityScheme: schemeName })
    });
    
    const data = await res.json();
    addMessage("bot", data.message);
    loadStats();
}

// --- 5. FILTERING & STATS ---
async function filterStudents() {
    const scheme = document.getElementById('filterSelect').value;
    const res = await fetch(`/scheme/${encodeURIComponent(scheme)}`);
    const data = await res.json();
    renderTable(data);
}

async function loadStats() {
    const res = await fetch('/stats');
    const students = await res.json();
    
    let conflicts = 0;
    let enrolled = 0;
    students.forEach(s => {
        if(s.enrollments.some(e => e.status === "CONFLICT")) conflicts++;
        else enrolled++;
    });

    document.getElementById('stat-total').innerText = students.length;
    document.getElementById('stat-conflict').innerText = conflicts;
    document.getElementById('stat-enrolled').innerText = enrolled;

    renderTable(students);
}

function renderTable(students) {
    if(!students) return;
    
    tableBody.innerHTML = students.map(s => {
        const schemes = s.enrollments.map(e => e.scheme.name).join(", ");
        const status = s.enrollments.some(e => e.status === "CONFLICT") ? "⚠️ Conflict" : "✅ Enrolled";
        
        const statusStyle = status.includes('Conflict') 
            ? 'background:#fff7ed; color:#ea580c; padding:4px 8px; border-radius:4px; font-weight:600;' 
            : 'background:#f0fdf4; color:#16a34a; padding:4px 8px; border-radius:4px; font-weight:600;';

        return `
            <tr>
                <td>
                    <div style="font-weight:600">${s.firstName} ${s.lastName || ''}</div>
                </td>
                <td>${s.email}</td>
                <td><span style="${statusStyle}">${status}</span></td>
                <td style="color:#64748b">${schemes}</td>
            </tr>
        `;
    }).join('');
}

// --- 6. EXPORT DATA (Updated) ---
function exportData() {
    const scheme = document.getElementById('filterSelect').value;
    window.location.href = `/export?scheme=${encodeURIComponent(scheme)}`;
}

// --- 7. RESET FUNCTION ---
async function clearData() {
    if(!confirm("Are you sure you want to delete ALL data? This cannot be undone.")) return;
    
    try {
        await fetch('/clear-data', { method: 'DELETE' });
        loadStats(); 
        addMessage("bot", "Database has been reset.");
    } catch (e) {
        alert("Failed to reset database");
    }
}

// Initial Load
loadStats();