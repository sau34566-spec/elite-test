/* question-upload.js
 * Admin-only helpers for importing .docx question banks.
 * Depends on question-bank.js and Mammoth loaded by admin.html.
 */

(function (global) {
  "use strict";

  function htmlToText(node) {
    return (node?.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseAnswerToken(text) {
    const match = String(text || "")
      .trim()
      .match(
        /(?:answer|ans|correct\s*answer)\s*:\s*([A-Za-z]|\d+)/i
      );

    return match ? match[1] : "";
  }

  function parseWordQuestionHTML(html) {
    if (
      typeof DOMParser === "undefined"
    ) {
      throw new Error(
        "This browser cannot parse the Word document."
      );
    }

    const documentObject =
      new DOMParser().parseFromString(
        String(html || ""),
        "text/html"
      );

    const root =
      documentObject.body;

    const blocks = [
      ...root.querySelectorAll(
        "p, li, h1, h2, h3, h4, h5, h6"
      )
    ];

    const questions = [];

    let current = null;
    let pendingAnswer = "";

    function flush() {
      if (!current) {
        return;
      }

      if (!current.q.trim()) {
        throw new Error(
          `Question ${questions.length + 1} has no question text.`
        );
      }

      if (current.options.length < 2) {
        throw new Error(
          `Question ${questions.length + 1} must have at least two options.`
        );
      }

      current.a =
        current.a || pendingAnswer;

      if (!current.a) {
        throw new Error(
          `Question ${questions.length + 1} is missing an Answer: A/B/C/D line.`
        );
      }

      questions.push(current);

      current = null;
      pendingAnswer = "";
    }

    for (const block of blocks) {
      const text = htmlToText(block);

      if (!text) {
        continue;
      }

      /*
       * Examples:
       * Q1. What is...
       * Q1) What is...
       * 1. What is...
       * 1) What is...
       */
      const questionMatch = text.match(
        /^(?:Q\s*)?(\d+)[.)]\s*(.*)$/i
      );

      /*
       * Examples:
       * A) ...
       * B) ...
       * C) ...
       * D) ...
       */
      const optionMatch = text.match(
        /^([A-Ha-h]|\d+)[.)]\s*(.*)$/
      );

      const answerMatch =
        parseAnswerToken(text);

      /*
       * New question
       */
      if (questionMatch) {
        flush();

        current = {
          q: questionMatch[2].trim(),
          options: [],
          a: ""
        };

        continue;
      }

      if (!current) {
        continue;
      }

      /*
       * Answer line
       */
      if (answerMatch) {
        pendingAnswer = answerMatch;
        current.a = answerMatch;

        continue;
      }

      /*
       * MCQ option
       */
      if (
        optionMatch &&
        /^[A-Ha-h]$/.test(
          optionMatch[1]
        )
      ) {
        current.options.push(
          optionMatch[2].trim()
        );

        continue;
      }

      /*
       * Question continuation
       */
      if (!current.options.length) {
        current.q +=
          (current.q ? "\n" : "") +
          text;
      }
    }

    /*
     * Save final question
     */
    flush();

    if (!questions.length) {
      throw new Error(
        "No questions were detected. Use Q1./1. for questions, A)/B)/C)/D) for options, and Answer: B."
      );
    }

    /*
     * Preserve images contained in question blocks.
     */
    const questionNodes = [
      ...root.querySelectorAll(
        "p, li, h1, h2, h3, h4, h5, h6"
      )
    ];

    let questionIndex = -1;

    for (const block of questionNodes) {
      const text = htmlToText(block);

      if (
        /^(?:Q\s*)?\d+[.)]\s*/i.test(
          text
        )
      ) {
        questionIndex++;
      }

      if (
        questionIndex < 0 ||
        !questions[questionIndex]
      ) {
        continue;
      }

      const images = [
        ...block.querySelectorAll("img")
      ];

      if (images.length) {
        questions[
          questionIndex
        ].media = images
          .map(function (img, index) {
            return {
              src:
                img.getAttribute("src") ||
                "",
              alt:
                img.getAttribute("alt") ||
                `Question figure ${index + 1}`
            };
          })
          .filter(function (item) {
            return item.src;
          });
      }
    }

    return questions;
  }

  /*
   * Public helper
   */
  global.parseWordQuestionHTML =
    parseWordQuestionHTML;

  global.QuestionUpload =
    Object.freeze({
      parseWordQuestionHTML
    });

})(window);
