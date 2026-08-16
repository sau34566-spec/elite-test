let securityState = {
    violations: 0,
    lastEventTime: 0,
    isBypassed: false
};

function activateSecurityMonitoring(allowBypass, triggerAutoSubmitCallback) {
    securityState.isBypassed = allowBypass;
    if (allowBypass) {
        console.log("Security Restrictions Bypassed for Authorized Candidate.");
        return;
    }

    // Single Handler for Blur/Visibility Deduplication
    function handleSecurityViolation(eventReason) {
        const now = Date.now();
        // Ignore duplicate events firing within 1500ms
        if (now - securityState.lastEventTime < 1500) return; 
        securityState.lastEventTime = now;

        securityState.violations++;

        if (securityState.violations === 1) {
            alert(`WARNING [Violation 1]: Tab switch / Window focus lost detected (${eventReason}). Next violation triggers auto-submission.`);
        } else if (securityState.violations >= 2) {
            alert(`SECURITY AUTO-SUBMIT: Multiple tab switches detected.`);
            triggerAutoSubmitCallback("SECURITY_VIOLATION");
        }
    }

    // Monitored Listeners
    window.addEventListener('blur', () => handleSecurityViolation("Window Blur"));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) handleSecurityViolation("Visibility Hidden");
    });

    // Block Copy/Paste/Context Menu
    const blockEvent = (e) => {
        e.preventDefault();
        alert("Copying or context menu actions are strictly prohibited.");
    };

    document.addEventListener('copy', blockEvent);
    document.addEventListener('paste', blockEvent);
    document.addEventListener('contextmenu', blockEvent);
}
