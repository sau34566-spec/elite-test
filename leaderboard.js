async function renderLeaderboard() {
    const container = document.getElementById('leaderboardContent');
    if (!container) return;

    const snap = await db.collection('results').get();
    let resultsList = [];
    snap.forEach(doc => resultsList.push(doc.data()));

    // Sort by Score DESC, then Correct Count DESC
    resultsList.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.correctCount - a.correctCount;
    });

    let html = `<table class="data-table">
        <thead>
            <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Score</th>
                <th>Correct</th>
                <th>Reason</th>
            </tr>
        </thead>
        <tbody>`;

    resultsList.forEach((r, idx) => {
        html += `
            <tr>
                <td><strong>#${idx + 1}</strong></td>
                <td>${r.studentName}</td>
                <td>${r.score} / ${r.totalMarks}</td>
                <td>${r.correctCount}</td>
                <td>${r.submissionReason}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}
