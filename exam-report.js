/* Shared question and report rendering for both portals. */
(function () {
  "use strict";
  const getOptionText = QuestionBank.getOptionText;
    function escapeHTML(value) {

      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }


    function physicsInlineToHTML(value) {

      let s = escapeHTML(value);

      s = s.replace(
        /([A-Za-z])⃗/gu,
        '<span class="vector-symbol">$1</span>'
      );

      s = s.replace(
        /î/gu,
        '<span class="unit-vector">i</span>'
      );

      s = s.replace(
        /ĵ/gu,
        '<span class="unit-vector">j</span>'
      );

      s = s.replace(
        /k̂/gu,
        '<span class="unit-vector">k</span>'
      );

      return s;
    }


    function formatNormalQuestion(value) {

      return value
        .split("\n")
        .map(rawLine => {

          const line = rawLine.trim();

          if (!line) {
            return '<span class="question-format-gap" aria-hidden="true"></span>';
          }

          let className = "question-format-line";

          if (
            /^(List|Column)[-\s]?(I|II)\b/i.test(line) ||
            /^Choose the correct/i.test(line)
          ) {
            className += " question-format-heading";
          } else if (
            /^(I|II|III|IV|V|VI|VII|VIII|IX|X)[.)]\s+/.test(line)
          ) {
            className += " question-format-statement";
          } else if (/^[A-R][.)]\s+/.test(line)) {
            className += " question-format-match-left";
          } else if (
            /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)[.)]\s+/.test(line)
          ) {
            className += " question-format-match-right";
          } else if (/[→⇌⟶]/u.test(line)) {
            className += " question-format-equation";
          }

          return `<span class="${className}">${physicsInlineToHTML(line)}</span>`;
        })
        .join("");
    }


    function formatMatchColumns(value) {

      const lines = value
        .split("\n")
        .map(line => line.trim());

      const columnOneIndex = lines.findIndex(line =>
        /^(Column|List)[-\s]?I$/i.test(line)
      );

      const columnTwoIndex = lines.findIndex((line, index) =>
        index > columnOneIndex &&
        /^(Column|List)[-\s]?II$/i.test(line)
      );

      if (
        columnOneIndex === -1 ||
        columnTwoIndex === -1 ||
        columnTwoIndex <= columnOneIndex
      ) {
        return formatNormalQuestion(value);
      }

      const introduction = lines
        .slice(0, columnOneIndex)
        .filter(Boolean);

      const leftItems = lines
        .slice(columnOneIndex + 1, columnTwoIndex)
        .filter(Boolean);

      const rightItems = lines
        .slice(columnTwoIndex + 1)
        .filter(Boolean);

      if (!leftItems.length || !rightItems.length) {
        return formatNormalQuestion(value);
      }

      const output = introduction.map(line =>
        `<span class="question-format-line">${physicsInlineToHTML(line)}</span>`
      );

      output.push('<span class="match-column-table">');
      output.push(
        '<span class="match-column-row">' +
          '<span class="match-column-cell match-column-heading">' +
            physicsInlineToHTML(lines[columnOneIndex]) +
          '</span>' +
          '<span class="match-column-cell match-column-heading">' +
            physicsInlineToHTML(lines[columnTwoIndex]) +
          '</span>' +
        '</span>'
      );

      const rowCount = Math.max(leftItems.length, rightItems.length);

      for (let index = 0; index < rowCount; index += 1) {

        const leftItem = leftItems[index] || "";
        const rightItem = rightItems[index] || "";

        output.push(
          '<span class="match-column-row">' +
            `<span class="match-column-cell${leftItem ? "" : " match-column-empty"}">` +
              physicsInlineToHTML(leftItem || "—") +
            '</span>' +
            `<span class="match-column-cell${rightItem ? "" : " match-column-empty"}">` +
              physicsInlineToHTML(rightItem || "—") +
            '</span>' +
          '</span>'
        );
      }

      output.push('</span>');

      return output.join("");
    }


    function physicsToHTML(value) {

      const normalizedText = String(value ?? "")
        .replace(/\r\n?/g, "\n");

      const hasColumnOne =
        /^(Column|List)[-\s]?I$/im.test(normalizedText);

      const hasColumnTwo =
        /^(Column|List)[-\s]?II$/im.test(normalizedText);

      if (hasColumnOne && hasColumnTwo) {
        return formatMatchColumns(normalizedText);
      }

      // Keep complete TeX expressions together, especially multiline align
      // environments and chemical reactions. Never inject their contents as HTML.
      const mathBlock = /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$/g;
      const matches = [...normalizedText.matchAll(mathBlock)];
      if (matches.length) {
        let end = 0;
        const parts = [];
        for (const match of matches) {
          if (match.index > end) parts.push(formatNormalQuestion(normalizedText.slice(end, match.index)));
          parts.push('<span class="question-math-expression">' + escapeHTML(match[0]) + '</span>');
          end = match.index + match[0].length;
        }
        if (end < normalizedText.length) parts.push(formatNormalQuestion(normalizedText.slice(end)));
        return parts.join("");
      }

      return formatNormalQuestion(normalizedText);
    }


    function normalizeTableRows(tableData) {
      if (!tableData) return null;

      if (Array.isArray(tableData)) {
        return {
          headers: [],
          rows: tableData.map(row =>
            Array.isArray(row)
              ? row
              : row && typeof row === "object"
                ? Object.values(row)
                : [row]
          )
        };
      }

      if (typeof tableData !== "object") return null;

      const headers =
        tableData.headers ??
        tableData.columns ??
        tableData.headings ??
        [];

      const rows =
        tableData.rows ??
        tableData.data ??
        tableData.items ??
        null;

      if (Array.isArray(rows)) {
        return {
          headers:
            Array.isArray(headers)
              ? headers
              : Object.values(headers || {}),
          rows: rows.map(row =>
            Array.isArray(row)
              ? row
              : row && typeof row === "object"
                ? Object.values(row)
                : [row]
          )
        };
      }

      const left =
        tableData.columnI ??
        tableData.listI ??
        tableData.left ??
        tableData.a;

      const right =
        tableData.columnII ??
        tableData.listII ??
        tableData.right ??
        tableData.b;

      if (Array.isArray(left) || Array.isArray(right)) {
        const leftItems = Array.isArray(left) ? left : [];
        const rightItems = Array.isArray(right) ? right : [];
        const length = Math.max(leftItems.length, rightItems.length);

        return {
          headers: ["Column I", "Column II"],
          rows: Array.from({ length }, (_, index) => [
            leftItems[index] ?? "",
            rightItems[index] ?? ""
          ])
        };
      }

      return null;
    }


    function renderQuestionTable(tableData) {
      const table = normalizeTableRows(tableData);

      if (!table || !table.rows.length) return "";

      const columnCount = Math.max(
        table.headers.length,
        ...table.rows.map(row => row.length)
      );

      const headers =
        table.headers.length
          ? table.headers
          : Array.from(
              { length: columnCount },
              (_, index) => "Column " + (index + 1)
            );

      return (
        '<div class="question-table-scroll">' +
          '<table class="question-table">' +
            '<thead><tr>' +
              headers.map(value =>
                "<th>" + physicsToHTML(getOptionText(value)) + "</th>"
              ).join("") +
            '</tr></thead>' +
            '<tbody>' +
              table.rows.map(row =>
                '<tr>' +
                  Array.from({ length: columnCount }, (_, index) =>
                    "<td>" +
                    physicsToHTML(getOptionText(row[index] ?? "")) +
                    "</td>"
                  ).join("") +
                '</tr>'
              ).join("") +
            '</tbody>' +
          '</table>' +
        '</div>'
      );
    }


    function getQuestionImageCandidates(source) {
      const src = String(source || "").trim();
      if (/^[a-z][a-z0-9+.-]*:/i.test(src) && !/^(?:https?:|blob:|data:image\/(?:png|jpeg|gif|webp|svg\+xml)[;,])/i.test(src)) return [];

      if (
        !src ||
        /^(?:https?:|data:|blob:|\/)/i.test(src)
      ) {
        return src ? [src] : [];
      }

      const clean = src.replace(/^\.\//, "");

      if (clean.startsWith("question/")) {
        return [clean];
      }

      // Question JSON files and their asset folders live inside /question.
      // Keep the original path as a fallback for older/root-level datasets.
      return [
        "question/" + clean,
        clean
      ];
    }

    function buildReportCard(detail) {
      detail = { ...detail, options: Array.isArray(detail.options) ? detail.options : [] };
      const card = document.createElement("section");
      card.className = "answer-report-card";
      card.dataset.answerStatus = detail.attempted === false ? "unattempted" : detail.isCorrect === true ? "correct" : detail.isCorrect === false ? "wrong" : "unknown";
      card.style.cssText =
        "width:900px;padding:24px;margin:0;background:#fff;color:#111827;" +
        "font-family:Arial,'Noto Sans',sans-serif;border-bottom:2px solid #cbd5e1;";

      const statusColor =
        !detail.attempted
          ? "#64748b"
          : detail.isCorrect
            ? "#059669"
            : "#dc2626";

      const statusText =
        detail.attempted === undefined
          ? "Status unavailable"
          : !detail.attempted
          ? "Not Attempted"
          : detail.isCorrect
            ? "Correct"
            : "Incorrect";

      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;gap:16px;">' +
          '<strong style="font-size:18px;">Q' +
            escapeHTML(detail.number) +
            (detail.subject ? " - " + escapeHTML(detail.subject) : "") +
          '</strong>' +
          '<strong style="color:' + statusColor + ';">' +
            statusText +
          '</strong>' +
        '</div>' +
        (detail.passage
          ? '<div style="margin-top:12px;padding:12px;background:#eff6ff;border-left:4px solid #2563eb;">' +
              physicsToHTML(detail.passage) +
            '</div>'
          : "") +
        '<div style="margin-top:12px;font-size:17px;line-height:1.55;">' +
          physicsToHTML(detail.question) +
        '</div>' +
        renderQuestionTable(detail.table) +
        '<div data-report-images style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;"></div>' +
        (detail.options.length
          ? '<ol type="A" style="margin:12px 0 0 24px;line-height:1.55;">' +
              detail.options.map((option, index) =>
                '<li data-option-index="' + index + '">' + physicsToHTML(option) + "</li>"
              ).join("") +
            "</ol>"
          : "") +
        '<div style="margin-top:14px;line-height:1.6;">' +
          '<div><b>Student Answer:</b> ' +
            physicsToHTML(detail.selectedAnswer) +
          '</div>' +
          '<div><b>Correct Answer:</b> ' +
            physicsToHTML(
              Array.isArray(detail.correctAnswer)
                ? detail.correctAnswer.join(" | ")
                : detail.correctAnswer
            ) +
          '</div>' +
        '</div>';

      const imageWrap =
        card.querySelector("[data-report-images]");

      function appendImage(container, source) {
        if (!source || String(source).startsWith("[Embedded figure")) {
          const note = document.createElement("p");
          note.textContent = "Figure was not stored in this submission.";
          container.appendChild(note);
          return;
        }
        const img = document.createElement("img");
        const candidates = getQuestionImageCandidates(source);
        let candidate = 0;
        img.addEventListener("error", () => {
          if (++candidate < candidates.length) img.src = candidates[candidate];
          else { img.dataset.failed = "true"; img.alt = "Figure unavailable: " + source; }
        });
        img.crossOrigin = "anonymous";
        if (candidates.length) img.src = candidates[0];
        else img.dataset.failed = "true";
        img.alt = "Question figure";
        img.style.cssText =
          "display:block;max-width:100%;max-height:360px;object-fit:contain;";
        container.appendChild(img);
      }
      (detail.media || []).forEach(source => appendImage(imageWrap, source));
      (detail.optionMedia || []).forEach((items, index) => {
        const container = card.querySelector('[data-option-index="' + index + '"]');
        if (container && Array.isArray(items)) items.forEach(item => appendImage(container, typeof item === "string" ? item : item.src));
      });

      return card;
    }



  window.ExamReport = { physicsToHTML, renderQuestionTable, getQuestionImageCandidates, buildReportCard };
})();
