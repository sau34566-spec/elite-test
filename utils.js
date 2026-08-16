// Normalize multi-formatted questions into standard JSON structure
function normalizeQuestion(qObj, index) {
    const qId = qObj.id || `q_${Date.now()}_${index}`;
    let text = qObj.question || qObj.q || "";
    let options = {};
    
    if (Array.isArray(qObj.options)) {
        const keys = ["A", "B", "C", "D"];
        qObj.options.forEach((opt, idx) => {
            if (idx < 4) options[keys[idx]] = opt;
        });
    } else if (typeof qObj.options === 'object' && qObj.options !== null) {
        options = {
            A: qObj.options.A || "",
            B: qObj.options.B || "",
            C: qObj.options.C || "",
            D: qObj.options.D || ""
        };
    }

    const answer = (qObj.answer || qObj.a || "A").toString().trim().toUpperCase();

    return {
        id: qId,
        question: text,
        options: options,
        answer: answer,
        chapter: qObj.chapter || "General",
        subject: qObj.subject || "General"
    };
}

// Array randomizer (Fisher-Yates Shuffle)
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
