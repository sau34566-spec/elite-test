// Manual Save
async function saveSingleQuestion() {
    const qData = {
        question: document.getElementById('qText').value,
        options: {
            A: document.getElementById('qOptA').value,
            B: document.getElementById('qOptB').value,
            C: document.getElementById('qOptC').value,
            D: document.getElementById('qOptD').value
        },
        answer: document.getElementById('qCorrect').value,
        chapter: document.getElementById('qChapter').value
    };

    const normalized = normalizeQuestion(qData, Date.now());
    await db.collection('questions').doc(normalized.id).set(normalized);
    alert("Question saved successfully!");
    loadAdminQuestionPool();
}

// MS Word Copy-Paste Parser
function parseWordContent() {
    const raw = document.getElementById('wordRawInput').value;
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const parsedList = [];
    let currentQ = null;

    lines.forEach(line => {
        if (/^\d+\./.test(line)) {
            if (currentQ && currentQ.question) parsedList.push(currentQ);
            currentQ = { question: line.replace(/^\d+\.\s*/, ''), options: {}, answer: 'A' };
        } else if (/^[A-D]\./.test(line)) {
            if (currentQ) {
                const key = line[0];
                currentQ.options[key] = line.replace(/^[A-D]\.\s*/, '');
            }
        } else if (/^Answer:\s*([A-D])/i.test(line)) {
            if (currentQ) {
                const match = line.match(/^Answer:\s*([A-D])/i);
                currentQ.answer = match[1].toUpperCase();
            }
        }
    });
    if (currentQ && currentQ.question) parsedList.push(currentQ);

    const container = document.getElementById('parsedPreview');
    container.innerHTML = `<h4>Parsed ${parsedList.length} Questions</h4>
    <button class="btn btn-success" onclick='saveParsedQuestions(${JSON.stringify(parsedList)})'>Commit Questions to Firestore</button>`;
}

async function saveParsedQuestions(qList) {
    const batch = db.batch();
    qList.forEach((q, idx) => {
        const norm = normalizeQuestion(q, idx);
        const ref = db.collection('questions').doc(norm.id);
        batch.set(ref, norm);
    });
    await batch.commit();
    alert("Parsed questions imported successfully!");
    loadAdminQuestionPool();
}

// JSON Importer
function handleJsonUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const rawData = JSON.parse(e.target.result);
            const array = Array.isArray(rawData) ? rawData : [rawData];
            
            const normalizedArray = array.map((q, i) => normalizeQuestion(q, i));
            
            if (confirm(`Import ${normalizedArray.length} valid questions from JSON?`)) {
                for (const q of normalizedArray) {
                    await db.collection('questions').doc(q.id).set(q);
                }
                alert("JSON Batch Import Complete.");
                loadAdminQuestionPool();
            }
        } catch (err) {
            alert("Invalid JSON format provided.");
        }
    };
    reader.readAsText(file);
}

// Load Pool
async function loadAdminQuestionPool() {
    const tbody = document.getElementById('questionTableBody');
    if (!tbody) return;

    const snap = await db.collection('questions').get();
    tbody.innerHTML = '';
    document.getElementById('qPoolCount').innerText = snap.size;

    snap.forEach(doc => {
        const q = doc.data();
        tbody.innerHTML += `
            <tr>
                <td>${q.question}</td>
                <td>${q.options.A}</td>
                <td>${q.options.B}</td>
                <td>${q.options.C}</td>
                <td>${q.options.D}</td>
                <td><strong>${q.answer}</strong></td>
                <td>${q.chapter}</td>
                <td><button class="btn btn-danger" onclick="deleteQuestion('${q.id}')">Delete</button></td>
            </tr>
        `;
    });
}

async function deleteQuestion(id) {
    if (confirm("Delete question from pool?")) {
        await db.collection('questions').doc(id).delete();
        loadAdminQuestionPool();
    }
}

async function clearQuestionPool() {
    if (confirm("CRITICAL WARNING: Wipe all questions in database?")) {
        const snap = await db.collection('questions').get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        loadAdminQuestionPool();
    }
}
