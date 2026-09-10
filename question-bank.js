/* question-bank.js
 * Shared, dependency-free question-bank adapter for Exam Elite.
 * It normalizes the existing repository banks without changing their source data.
 */

(function (global) {
  "use strict";

  const OPTION_LETTERS = "abcdefghijklmnopqrstuvwxyz";

  function coerceContentText(value) {
    if (value == null) return "";

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.map(coerceContentText).join("\n");
    }

    if (typeof value === "object") {
      if ("text" in value) return coerceContentText(value.text);
      if ("value" in value) return coerceContentText(value.value);
      if ("content" in value) return coerceContentText(value.content);

      return String(value);
    }

    return String(value);
  }

  function cleanKey(key) {
    return String(key ?? "").trim().toLowerCase();
  }

  function getQuestionText(question) {
    if (!question || typeof question !== "object") {
      return "";
    }

    return coerceContentText(
      question.q ??
      question.question ??
      question.text ??
      question.prompt ??
      question.questionText ??
      ""
    );
  }

  function getOptionText(option) {
    return coerceContentText(option);
  }

  function optionValues(rawOptions) {
    if (Array.isArray(rawOptions)) {
      return rawOptions.map(getOptionText);
    }

    if (rawOptions && typeof rawOptions === "object") {
      return Object.keys(rawOptions).map(function (key) {
        return getOptionText(rawOptions[key]);
      });
    }

    return [];
  }

  function getRawAnswer(question) {
    if (!question || typeof question !== "object") {
      return undefined;
    }

    return (
      question.answer ??
      question.a ??
      question.correct ??
      question.correctAnswer ??
      question.correct_option ??
      question.correctOption ??
      question.answer_text
    );
  }

  function normalizeAnswerIndex(rawAnswer, options) {
    if (rawAnswer == null) {
      return -1;
    }

    if (typeof rawAnswer === "number" && Number.isInteger(rawAnswer)) {
      if (rawAnswer >= 0 && rawAnswer < options.length) {
        return rawAnswer;
      }

      if (rawAnswer >= 1 && rawAnswer <= options.length) {
        return rawAnswer - 1;
      }
    }

    const raw = getOptionText(rawAnswer).trim();

    if (!raw) {
      return -1;
    }

    const letter = raw
      .toLowerCase()
      .replace(/[.)\]:-]+$/, "")
      .trim();

    /*
     * A / B / C / D
     */
    if (/^[a-z]$/.test(letter)) {
      const index = OPTION_LETTERS.indexOf(letter);

      if (index >= 0 && index < options.length) {
        return index;
      }
    }

    /*
     * 1 / 2 / 3 / 4
     */
    if (/^\d+$/.test(letter)) {
      const number = Number(letter);

      if (number >= 1 && number <= options.length) {
        return number - 1;
      }

      if (number >= 0 && number < options.length) {
        return number;
      }
    }

    /*
     * Exact option text
     */
    const normalized = raw
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const exact = options.findIndex(function (option) {
      return (
        getOptionText(option)
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase() === normalized
      );
    });

    if (exact >= 0) {
      return exact;
    }

    /*
     * Supports:
     * option (c)
     * answer: c
     * option: 2
     */
    const match = normalized.match(
      /(?:option|answer)\s*[\[(]?\s*([a-z]|\d+)\s*[\])]?\s*$/i
    );

    if (match) {
      return normalizeAnswerIndex(match[1], options);
    }

    return -1;
  }

  function mediaList(value, fallbackAlt) {
    if (!value) {
      return [];
    }

    const values = Array.isArray(value) ? value : [value];

    return values
      .map(function (item) {
        if (typeof item === "string") {
          return {
            src: item,
            alt: fallbackAlt || "Question figure"
          };
        }

        if (item && typeof item === "object") {
          const src =
            item.src ??
            item.url ??
            item.path ??
            item.image ??
            item.href;

          return src
            ? {
                src: String(src),
                alt: String(
                  item.alt ||
                  fallbackAlt ||
                  "Question figure"
                )
              }
            : null;
        }

        return null;
      })
      .filter(Boolean);
  }

  function normalizeQuestionRecord(
    input,
    index,
    sourceLabel
  ) {
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      throw new Error(
        `${sourceLabel || "Question bank"}: question ${
          index + 1
        } is not an object.`
      );
    }

    const questionText = getQuestionText(input).trim();

    if (!questionText) {
      throw new Error(
        `${sourceLabel || "Question bank"}: question ${
          index + 1
        } has no question text.`
      );
    }

    const options = optionValues(
      input.options ??
      input.choices ??
      input.answers
    );

    const rawAnswer = getRawAnswer(input);

    const answerIndex = normalizeAnswerIndex(
      rawAnswer,
      options
    );

    const answerModeRaw = String(
      input.answerMode ??
      input.mode ??
      input.questionType ??
      input.type ??
      ""
    )
      .toLowerCase()
      .trim();

    const isTextAnswer = [
      "text",
      "numeric",
      "integer",
      "decimal",
      "short-answer",
      "shortanswer"
    ].includes(answerModeRaw);

    const isMultiple = [
      "multiple",
      "multi",
      "multiple-choice",
      "multiple_choice",
      "checkbox"
    ].includes(answerModeRaw);

    /*
     * Clone the original question.
     * Original question data remains untouched.
     */
    const output = {
      ...input
    };

    output.id =
      input.id ??
      input.questionId ??
      `${sourceLabel || "question"}-${index + 1}`;

    output.q = questionText;

    output.options = options;

    output.__answerMode = isTextAnswer
      ? "text"
      : isMultiple
      ? "multiple"
      : "single";

    output.__correctIndex = answerIndex;

    output.__correctIndices = [];

    if (isMultiple) {
      const rawAnswers = Array.isArray(rawAnswer)
        ? rawAnswer
        : [rawAnswer];

      output.__correctIndices = rawAnswers
        .map(function (answer) {
          return normalizeAnswerIndex(
            answer,
            options
          );
        })
        .filter(function (indexValue) {
          return indexValue >= 0;
        });

      if (
        !output.__correctIndices.length &&
        answerIndex >= 0
      ) {
        output.__correctIndices = [answerIndex];
      }
    }

    output.__media = mediaList(
      input.media ??
      input.images ??
      input.image,
      "Question figure"
    );

    output.__optionMedia = Array.isArray(
      input.optionMedia
    )
      ? input.optionMedia.map(function (item, indexValue) {
          return mediaList(
            item,
            `Option ${indexValue + 1}`
          );
        })
      : [];

    output.__answerRaw = rawAnswer;

    return output;
  }

  function unwrapBank(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === "object") {
      if (Array.isArray(data.questions)) {
        return data.questions;
      }

      if (Array.isArray(data.items)) {
        return data.items;
      }

      if (Array.isArray(data.questionBank)) {
        return data.questionBank;
      }
    }

    throw new Error(
      "Question bank must be an array or an object containing a questions array."
    );
  }

  function validateBank(data, sourceLabel) {
    const label = sourceLabel || "Question bank";

    const rawQuestions = unwrapBank(data);

    if (!rawQuestions.length) {
      throw new Error(
        `${label}: no questions were found.`
      );
    }

    return rawQuestions.map(function (question, index) {
      return normalizeQuestionRecord(
        question,
        index,
        label
      );
    });
  }

  function parseHTMLDocument(text, label) {
    if (typeof DOMParser === "undefined") {
      throw new Error(
        `${label || "Question bank"}: unsupported document format.`
      );
    }

    const documentObject =
      new DOMParser().parseFromString(
        text,
        "text/html"
      );

    const jsonNode =
      documentObject.querySelector(
        'script[type="application/json"], script#question-bank'
      );

    const pre =
      documentObject.querySelector(
        "pre, code"
      );

    const candidate =
      jsonNode?.textContent ||
      pre?.textContent ||
      documentObject.body?.textContent ||
      "";

    const trimmed = candidate.trim();

    if (!trimmed) {
      throw new Error(
        `${label || "Question bank"}: the document is empty.`
      );
    }

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(
        `${label || "Question bank"}: HTML did not contain valid JSON. ${error.message}`
      );
    }
  }

  function parseQuestionDocument(source, label) {
    const name = label || "Question bank";

    if (
      source &&
      typeof source === "object"
    ) {
      return source;
    }

    if (typeof source !== "string") {
      throw new Error(
        `${name}: unsupported input.`
      );
    }

    const text = source
      .replace(/^\uFEFF/, "")
      .trim();

    if (!text) {
      throw new Error(
        `${name}: the document is empty.`
      );
    }

    try {
      return JSON.parse(text);
    } catch (jsonError) {
      if (
        /<(?:html|body|pre|script)\b/i.test(text)
      ) {
        return parseHTMLDocument(
          text,
          name
        );
      }

      throw new Error(
        `${name}: invalid JSON. ${jsonError.message}`
      );
    }
  }

  function getCorrectAnswer(question) {
    if (!question) {
      return "";
    }

    if (
      question.__answerMode === "multiple"
    ) {
      return (
        question.__correctIndices || []
      )
        .map(function (index) {
          return getOptionText(
            question.options?.[index]
          );
        })
        .join(", ");
    }

    if (
      question.__answerMode === "text"
    ) {
      return getOptionText(
        question.__answerRaw
      );
    }

    const index = Number(
      question.__correctIndex
    );

    if (
      index >= 0 &&
      index < (question.options || []).length
    ) {
      return getOptionText(
        question.options[index]
      );
    }

    return getOptionText(
      question.__answerRaw
    );
  }

  function getSelectedAnswerText(
    question,
    selected
  ) {
    if (!question) {
      return "";
    }

    if (
      question.__answerMode === "text"
    ) {
      return selected == null
        ? ""
        : String(selected);
    }

    if (
      question.__answerMode === "multiple"
    ) {
      const indexes = Array.isArray(selected)
        ? selected
        : selected == null
        ? []
        : [selected];

      return indexes
        .map(function (index) {
          return getOptionText(
            question.options?.[index]
          );
        })
        .filter(Boolean)
        .join(", ");
    }

    return selected == null
      ? ""
      : getOptionText(
          question.options?.[selected]
        );
  }

  function isQuestionAnswered(
    question,
    selected
  ) {
    if (!question) {
      return false;
    }

    if (
      question.__answerMode === "multiple"
    ) {
      return (
        Array.isArray(selected) &&
        selected.length > 0
      );
    }

    if (
      question.__answerMode === "text"
    ) {
      return (
        String(selected ?? "").trim() !== ""
      );
    }

    return (
      Number.isInteger(selected) &&
      selected >= 0
    );
  }

  function normalizedAnswerText(value) {
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function isQuestionAnswerCorrect(
    question,
    selected
  ) {
    if (
      !question ||
      !isQuestionAnswered(
        question,
        selected
      )
    ) {
      return false;
    }

    /*
     * Multiple-answer questions
     */
    if (
      question.__answerMode === "multiple"
    ) {
      const selectedSet = [
        ...new Set(
          selected.map(Number)
        )
      ].sort(function (a, b) {
        return a - b;
      });

      const correctSet = [
        ...new Set(
          question.__correctIndices || []
        )
      ].sort(function (a, b) {
        return a - b;
      });

      return (
        selectedSet.length ===
          correctSet.length &&
        selectedSet.every(function (
          value,
          index
        ) {
          return (
            value === correctSet[index]
          );
        })
      );
    }

    /*
     * Text/numeric questions
     */
    if (
      question.__answerMode === "text"
    ) {
      return (
        normalizedAnswerText(selected) ===
        normalizedAnswerText(
          question.__answerRaw
        )
      );
    }

    /*
     * Normal MCQ
     */
    return (
      Number(selected) ===
      Number(question.__correctIndex)
    );
  }

  function getQuestionMedia(question) {
    if (!question) {
      return [];
    }

    return mediaList(
      question.__media ??
      question.media ??
      question.images ??
      question.image,
      "Question figure"
    );
  }

  /*
   * Public API
   */
  global.QuestionBank = Object.freeze({
    coerceContentText,
    getQuestionText,
    getOptionText,
    normalizeQuestionRecord,
    parseQuestionDocument,
    validateBank,
    getCorrectAnswer,
    getSelectedAnswerText,
    isQuestionAnswered,
    isQuestionAnswerCorrect,
    getQuestionMedia
  });

})(window);
