// Login student and prepare session
async function startStudentSession() {
    const name = document.getElementById('studentName').value.trim();
    const email = document.getElementById('studentEmail').value.trim().toLowerCase();
    const roll = document.getElementById('studentRoll').value.trim();
    const examId = document.getElementById('examSelect').value;

    if (!name || !email || !roll || !examId) {
        alert("Please complete all candidate login details.");
        return;
    }

    try {
        // Fetch Exam Configuration
        const configDoc = await db.collection('examConfigs').doc(examId).get();
        if (!configDoc.exists) {
            alert("Selected examination configuration does not exist.");
            return;
        }

        const config = configDoc.data();
        
        // Session ID uniquely assigned
        const sessionId = `SES_${examId}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Save base context to sessionStorage
        const studentSession = {
            sessionId: sessionId,
            examId: examId,
            name: name,
            email: email,
            roll: roll,
            startTime: Date.now()
        };

        sessionStorage.setItem('currentExamSession', JSON.stringify(studentSession));
        window.location.href = 'nta.html';

    } catch (err) {
        console.error("Auth session launch failure:", err);
        alert("Failed to connect to database. Check network.");
    }
}

// Fetch configured exams for dropdown
async function loadExamListDropdown() {
    const select = document.getElementById('examSelect');
    if (!select) return;

    try {
        const snap = await db.collection('examConfigs').get();
        select.innerHTML = '<option value="">-- Select Active Exam --</option>';
        snap.forEach(doc => {
            const data = doc.data();
            select.innerHTML += `<option value="${doc.id}">${data.examName} (${doc.id})</option>`;
        });
    } catch (e) {
        select.innerHTML = '<option value="">Default Exam (SSC-CGL-MOCK-1)</option>';
    }
}
