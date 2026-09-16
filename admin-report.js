(function () {
  "use strict";
  function textNode(tag, text) {
    const node = document.createElement(tag);
    node.textContent = String(text ?? "");
    return node;
  }

  function render(record, ledger, content) {
    ledger.replaceChildren();
    const details = record.answerDetails;
    if (!details.length) {
      ledger.appendChild(textNode("p", record.liveSession
        ? "This test is in progress. Full question details become available when the student submits."
        : "Question details were not stored for this submission."));
    }
    details.forEach(detail => {
      const card = window.ExamReport.buildReportCard(detail);
      card.style.width = "100%";
      ledger.appendChild(card);
    });
    const raw = record.raw || {};
    const count = raw.questionCount ?? (details.length || null);
    const summary = textNode("p", `Questions: ${count ?? "Unavailable"} | Attempted: ${record.attempted} | Correct: ${record.correct} | Wrong: ${record.wrong} | Unattempted: ${count === null ? "Unavailable" : Math.max(0, count - record.attempted)}`);
    content.prepend(summary);
    if (record.instituteName) content.prepend(textNode("p", `${record.instituteName} — ${record.instituteFullAddress}`));
    const fields = Object.entries(raw.studentExtraFields || {});
    if (fields.length) content.appendChild(textNode("p", fields.map(([key, value]) => `${key}: ${value}`).join(" | ")));

    const section = document.createElement("section");
    section.style.marginTop = "20px";
    section.appendChild(textNode("h3", "Security Timeline"));
    const events = Array.isArray(raw.securityEvents) ? raw.securityEvents : [];
    // Replacement entries describe a response to a violation, not another violation.
    section.appendChild(textNode("p", `Tab/focus violations: ${record.tabSwitches} | Copy attempts: ${record.copiesAttempted} | Refreshes: ${Number(raw.refreshes) || 0} | Penalty marks: ${record.penaltiesApplied}`));
    if (!events.length) section.appendChild(textNode("p", "No event timeline was stored for this submission. See the recorded counters above."));
    events.forEach(event => {
      const entry = document.createElement("div");
      entry.className = "security-event";
      const time = typeof event.time === "object" && event.time?.seconds
        ? new Date(event.time.seconds * 1000) : new Date(event.time);
      entry.appendChild(textNode("strong", `${Number.isNaN(time.getTime()) ? "Time unavailable" : time.toLocaleString("en-IN")} — ${event.reason || "Security event"}`));
      const info = Object.entries(event).filter(([key]) => key !== "time" && key !== "reason");
      if (info.length) entry.appendChild(textNode("p", info.map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`).join(" | ")));
      section.appendChild(entry);
    });
    content.appendChild(section);
    window.MathJax?.startup?.promise?.then(() => window.MathJax.typesetPromise([content])).catch(console.warn);
  }

  async function print() {
    const content = document.getElementById("detail-content");
    if (window.MathJax?.startup?.promise) {
      await window.MathJax.startup.promise;
      await window.MathJax.typesetPromise([content]);
    }
    await Promise.all([...content.querySelectorAll("img")].map(img => Promise.race([
      img.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 10000))
    ])));
    if ([...content.querySelectorAll("img")].some(img => !img.complete || !img.naturalWidth)) {
      alert("A report figure could not load. Check your connection and retry before saving the PDF.");
      return;
    }
    window.print();
  }

  function download(record) {
    const payload = { ...record.raw, id: record.id, answerDetails: record.answerDetails };
    delete payload.answerDetailsJson;
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(record.name || "student").replace(/[^a-z0-9_-]/gi, "_")}_complete_report.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  window.AdminReport = { render, print, download };
})();
