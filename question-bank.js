/* question-bank.js
 * Compatible question-bank adapter for Exam Elite.
 * Existing question data is never modified.
 */

(function (global) {
  "use strict";

  const text = (value) => {
    if (value == null) return "";

    if (Array.isArray(value)) {
      return value.map(text).filter(Boolean).join("\n");
    }

    if (typeof value === "object") {
      if (value.latex || value.tex) {
        const formula = value.latex ?? value.tex;
        return value.display === false
          ? "\\(" + formula + "\\)"
          : "\\[" + formula + "\\]";
      }

      return text(
        value.text ??
        value.content ??
        value.value ??
        value.label ??
        value.option ??
        value.html ??
        ""
      );
    }

    return String(value);
  };

  function getQuestionText(q) {
    if (!q || typeof q !== "object") return "";

    return text(
      q.q ??
      q.question ??
      q.text ??
      q.prompt ??
      q.stem ??
      q.questionText ??
      q.title ??
      ""
    );
  }

  function getOptionText(option) {
    return text(option);
  }

  function getQuestionMedia(q) {
    if (!q || typeof q !== "object") return [];

    const source =
      q.__media ??
      q.media ??
      q.images ??
      q.image ??
      q.imageUrl ??
      q.image_url ??
      q.img ??
      q.figures ??
      q.figure ??
      q.figureUrl ??
      q.diagram ??
      q.diagramUrl ??
      (q.src ? { src: q.src, alt: q.alt } : null);

    if (!source) return [];

    return (Array.isArray(source) ? source : [source])
      .map((item) => {
        if (typeof item === "string") {
          return {
            src: item,
            alt: "Question figure"
          };
        }

        if (item && typeof item === "object") {
          const src =
            item.src ??
            item.url ??
            item.path ??
            item.image ??
            item.href ??
            "";

          return src
            ? {
                src: String(src),
                alt: String(
                  item.alt ??
                  item.title ??
                  "Question figure"
                )
              }
            : null;
        }

        return null;
      })
      .filter(Boolean);
  }

  function getRawAnswer(q) {
    if (!q || typeof q !== "object") return "";

    return (
      q.a ??
      q.answer ??
      q.correct ??
      q.correctAnswer ??
      q.correct_option ??
      q.correctOption ??
      q.answer_text ??
      ""
    );
  }

  function getOptions(q) {
    if (!q || typeof q !== "object") return [];

    const raw =
      q.options ??
      q.choices ??
      q.alternatives ??
      q.answers ??
      q.option ??
      [];

    if (Array.isArray(raw)) {
      return raw.map(getOptionText);
    }

    if (raw && typeof raw === "object") {
      return Object.values(raw).map(getOptionText);
    }

    return [];
  }

  function answerIndex(answer, options) {
    if (answer == null) return -1;

    if (typeof answer === "number") {
      if (answer >= 0 && answer < options.length) return answer;
      if (answer >= 1 && answer <= options.length) {
        return answer - 1;
      }
    }

    const value = text(answer)
      .trim()
      .replace(/[.)\]:-]+$/, "")
      .trim();

    if (!value) return -1;

    if (/^[a-z]$/i.test(value)) {
      const index =
        value.toLowerCase().charCodeAt(0) - 97;

      if (index >= 0 && index < options.length) {
        return index;
      }
    }

    if (/^\d+$/.test(value)) {
      const number = Number(value);

      if (number >= 1 && number <= options.length) {
        return number - 1;
      }

      if (number >= 0 && number < options.length) {
        return number;
      }
    }

    const normalized = value
      .replace(/\s+/g, " ")
      .toLowerCase();

    const exact = options.findIndex(
      (option) =>
        option
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase() === normalized
    );

    if (exact >= 0) return exact;

    const match = normalized.match(
      /(?:option|answer)\s*[\[(]?\s*([a-z]|\d+)\s*[\])]?\s*$/i
    );

    return match
      ? answerIndex(match[1], options)
      : -1;
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
        `${sourceLabel || "Question bank"}: question ${index + 1} is not an object.`
      );
    }

    const q = {
      ...input
    };

    const questionText = getQuestionText(input).trim();
    const options = getOptions(input);
    const rawAnswer = getRawAnswer(input);

    const answerValues = Array.isArray(rawAnswer)
      ? rawAnswer
      : [rawAnswer];

    const correctIndices = answerValues
      .map((answer) => answerIndex(answer, options))
      .filter((value) => value >= 0);

    const mode = String(
      input.answerMode ??
      input.mode ??
      input.questionType ??
      input.type ??
      ""
    ).toLowerCase();

    const isTextAnswer =
      !options.length &&
      /text|numeric|integer|decimal|short|fill/.test(mode);

    const isMultiple =
      correctIndices.length > 1 ||
      /multiple|multi|checkbox/.test(mode);

    q.id =
      input.id ??
      input.questionId ??
      `${sourceLabel || "question"}-${index + 1}`;

    q.q = questionText;
    q.question = questionText;
    q.options = options;
    q.__answerRaw = rawAnswer;
    q.__correctIndex = correctIndices[0] ?? -1;
    q.__correctIndices = correctIndices;
    q.__answerMode = isTextAnswer
      ? "text"
      : isMultiple
      ? "multiple"
      : "single";

    q.__media = getQuestionMedia(input);
    q.__optionMedia = Array.isArray(input.optionMedia)
      ? input.optionMedia.map((item) =>
          getQuestionMedia({ images: item })
        )
      : [];

    q.__passage = text(
      input.passage ??
      input.context ??
      input.paragraph ??
      input.comprehension ??
      input.instructions ??
      ""
    );

    q.__table =
      input.table ??
      input.matchTable ??
      input.match ??
      input.columns ??
      null;

    // Current index.html expects q.a.
    q.a = isMultiple
      ? correctIndices.map((i) => options[i])
      : options[correctIndices[0]] ??
        text(rawAnswer);

    return q;
  }

  function unwrap(data) {
    if (Array.isArray(data)) return data;

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
      "Question bank must be an array or contain a questions array."
    );
  }

  function validateBank(data, sourceLabel) {
    const list = unwrap(data);

    if (!list.length) {
      throw new Error(
        `${sourceLabel || "Question bank"}: no questions found.`
      );
    }

    return list.map((question, index) =>
      normalizeQuestionRecord(
        question,
        index,
        sourceLabel
      )
    );
  }

  function parseQuestionDocument(source, label) {
    if (source && typeof source === "object") {
      return source;
    }

    if (typeof source !== "string") {
      throw new Error(
        `${label || "Question bank"}: unsupported input.`
      );
    }

    let value = source
      .replace(/^\uFEFF/, "")
      .trim();

    const jsonScript = value.match(
      /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i
    );

    if (jsonScript) {
      value = jsonScript[1].trim();
    }

    value = value
      .replace(/^```(?:json|javascript|js)?\s*/i, "")
      .replace(/\s*```$/, "")
      .replace(
        /^(?:(?:const|let|var)\s+)?(?:window\.)?[A-Za-z_$][\w$]*(?:\.questions)?\s*=\s*/,
        ""
      )
      .replace(/;\s*$/, "")
      .trim();

    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(
        `${label || "Question bank"}: invalid JSON. ${error.message}`
      );
    }
  }

  function getCorrectAnswer(question) {
    if (!question) return "";

    if (question.__answerMode === "multiple") {
      return (question.__correctIndices || [])
        .map((index) => question.options[index])
        .join(" | ");
    }

    if (question.__answerMode === "text") {
      return text(question.__answerRaw);
    }

    return question.options?.[question.__correctIndex] ?? "";
  }

  function getSelectedAnswerText(question, selected) {
    if (!question) return "";

    if (question.__answerMode === "text") {
      return selected == null ? "" : String(selected);
    }

    const indexes = Array.isArray(selected)
      ? selected
      : selected == null
      ? []
      : [selected];

    return indexes
      .map((index) => question.options?.[index])
      .filter(Boolean)
      .join(" | ");
  }

  function isQuestionAnswered(question, selected) {
    if (!question) return false;

    if (question.__answerMode === "text") {
      return String(selected ?? "").trim() !== "";
    }

    if (question.__answerMode === "multiple") {
      return Array.isArray(selected) && selected.length > 0;
    }

    return Number.isInteger(selected) && selected >= 0;
  }

  function isQuestionAnswerCorrect(question, selected) {
    if (!isQuestionAnswered(question, selected)) {
      return false;
    }

    if (question.__answerMode === "text") {
      return (
        String(selected).trim().toLowerCase() ===
        text(question.__answerRaw).trim().toLowerCase()
      );
    }

    if (question.__answerMode === "multiple") {
      const selectedSet = [...new Set(selected.map(Number))]
        .sort((a, b) => a - b);

      const correctSet = [...new Set(question.__correctIndices || [])]
        .sort((a, b) => a - b);

      return (
        selectedSet.length === correctSet.length &&
        selectedSet.every(
          (value, index) => value === correctSet[index]
        )
      );
    }

    return Number(selected) === Number(question.__correctIndex);
  }

  global.QuestionBank = Object.freeze({
    coerceContentText: text,
    getQuestionText,
    getOptionText,
    getQuestionMedia,
    getCorrectAnswer,
    getSelectedAnswerText,
    isQuestionAnswered,
    isQuestionAnswerCorrect,
    normalizeQuestionRecord,
    parseQuestionDocument,
    validateBank
  });
})(window);
