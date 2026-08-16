async function loadAdminResults() {
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody) return;

    const snap = await db.collection('results').orderBy('submittedAt', 'desc').get();
    tbody.innerHTML = '';

    snap.forEach(doc => {
        const res = doc.data();
        const dateStr = res.submittedAt ? new Date(res.submittedAt.toDate()).toLocaleString() : 'N/A';
        tbody.innerHTML += `
            <tr>
                <td>${res.studentName} (${res.studentEmail})</td>
                <td>${res.rollNumber}</td>
                <td><strong>${res.score}</strong> / ${res.totalMarks}</td>
                <td>${res.correctCount}</td>
                <td>${res.wrongCount}</td>
                <td>${res.violations}</td>
                <td>${res.submissionReason}</td>
                <td>${dateStr}</td>
            </tr>
        `;
    });
}

async function loadAdminAnalytics() {
    const snap = await db.collection('results').get();
    let totalSubmissions = snap.size;
    let totalViolations = 0;
    let autoSubmits = 0;
    let scoreSum = 0;

    snap.forEach(doc => {
        const data = doc.data();
        totalViolations += (data.violations || 0);
        if (data.submissionReason === 'SECURITY_VIOLATION') autoSubmits++;
        scoreSum += (data.score || 0);
    });

    document.getElementById('statTotalSubmissions').innerText = totalSubmissions;
    document.getElementById('statTabViolations').innerText = totalViolations;
    document.getElementById('statAutoSubmits').innerText = autoSubmits;
    document.getElementById('statAvgScore').innerText = totalSubmissions > 0 ? (scoreSum / totalSubmissions).toFixed(2) : "0.0";
}
