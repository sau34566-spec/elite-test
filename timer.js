let examTimerInterval = null;

function initializeExamTimer(durationMinutes, sessionStartTime, onExpireCallback) {
    if (examTimerInterval) clearInterval(examTimerInterval);

    const totalSeconds = durationMinutes * 60;
    
    function updateClock() {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - sessionStartTime) / 1000);
        const remainingSeconds = totalSeconds - elapsedSeconds;

        if (remainingSeconds <= 0) {
            clearInterval(examTimerInterval);
            document.getElementById('examTimerDisplay').innerText = "00:00:00";
            onExpireCallback();
            return;
        }

        const hrs = Math.floor(remainingSeconds / 3600);
        const mins = Math.floor((remainingSeconds % 3600) / 60);
        const secs = remainingSeconds % 60;

        document.getElementById('examTimerDisplay').innerText = 
            `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    updateClock();
    examTimerInterval = setInterval(updateClock, 1000);
}

function stopExamTimer() {
    if (examTimerInterval) {
        clearInterval(examTimerInterval);
        examTimerInterval = null;
    }
}
