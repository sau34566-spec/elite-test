document.addEventListener('DOMContentLoaded', () => {
    // Check administrative access
    auth.onAuthStateChanged(user => {
        if (user) {
            document.getElementById('adminLoginOverlay').classList.add('hidden');
            loadAdminQuestionPool();
            loadAdminResults();
            loadAdminAnalytics();
        } else {
            document.getElementById('adminLoginOverlay').classList.remove('hidden');
        }
    });
});

async function handleAdminLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPassword').value.trim();
    const errBox = document.getElementById('adminAuthErr');

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        errBox.innerText = "";
    } catch (e) {
        errBox.innerText = "Invalid administrator credentials.";
    }
}

function handleAdminLogout() {
    auth.signOut().then(() => {
        window.location.reload();
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

function toggleImportMode(mode) {
    document.getElementById('importManual').classList.add('hidden');
    document.getElementById('importWord').classList.add('hidden');
    document.getElementById('importJson').classList.add('hidden');

    if (mode === 'manual') document.getElementById('importManual').classList.remove('hidden');
    if (mode === 'word') document.getElementById('importWord').classList.remove('hidden');
    if (mode === 'json') document.getElementById('importJson').classList.remove('hidden');
}

async function saveExamConfiguration() {
    const configData = {
        examId: document.getElementById('cfgExamId').value,
        examName: document.getElementById('cfgExamName').value,
        subject: document.getElementById('cfgSubject').value,
        displayQuestionCount: parseInt(document.getElementById('cfgDisplayCount').value),
        durationMinutes: parseInt(document.getElementById('cfgDuration').value),
        marksPerCorrect: parseFloat(document.getElementById('cfgMarks').value),
        negativeMarks: parseFloat(document.getElementById('cfgNegMarks').value),
        monitorTabSwitch: document.getElementById('cfgMonitorTabSwitch').checked,
        blockCopyPaste: document.getElementById('cfgBlockCopyPaste').checked,
        randomizeQuestions: document.getElementById('cfgRandomizeQ').checked,
        authorizedEmails: document.getElementById('cfgAuthorizedEmails').value
    };

    await db.collection('examConfigs').doc(configData.examId).set(configData);
    alert("Exam Configuration successfully saved!");
}
