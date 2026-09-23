/* question-bank.js
 * Compatible question-bank adapter for Exam Elite.
 *
 * Image fix:
 * - Converts embedded <img ...> inside question text into __media.
 * - Converts embedded <img ...> inside options into __optionMedia.
 * - Converts <br> into line breaks.
 * - Keeps the existing question/answer API unchanged.
 */

(function (global) {
  "use strict";

  /* =========================================================
     BASIC TEXT HELPERS
  ========================================================== */

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


  /* =========================================================
     EMBEDDED IMAGE EXTRACTION
  ========================================================== */

  function extractEmbeddedImages(value, fallbackAlt) {
    const source = String(value ?? "");
    const images = [];

    const cleaned = source.replace(
      /<img\b([^>]*)>/gi,
      (fullTag, attributes) => {
        const srcMatch = attributes.match(
          /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i
        );

        if (!srcMatch) {
          return "";
        }

        const src = String(
          srcMatch[1] ??
          srcMatch[2] ??
          srcMatch[3] ??
          ""
        ).trim();

        if (!src) {
          return "";
        }

        const altMatch = attributes.match(
          /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i
        );

        const alt = String(
          altMatch?.[1] ??
          altMatch?.[2] ??
          altMatch?.[3] ??
          fallbackAlt ??
          "Question figure"
        ).trim();

        images.push({
          src,
          alt
        });

        return "";
      }
    );

    return {
      text: cleaned,
      images
    };
  }


  function cleanQuestionMarkup(value) {
    return String(value ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p>/gi, "\n")
      .trim();
  }


  function extractAndClean(value, fallbackAlt) {
    const extracted = extractEmbeddedImages(
      value,
      fallbackAlt
    );

    return {
      text: cleanQuestionMarkup(extracted.text),
      images: extracted.images
    };
  }


  function dedupeMedia(items) {
    const seen = new Set();

    return items.filter(item => {
      if (!item || !item.src) return false;

      const key =
        String(item.src).trim() +
        "|" +
        String(item.alt || "").trim();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }


  /* =========================================================
     QUESTION TEXT
  ========================================================== */

  function getQuestionText(q) {
    if (!q || typeof q !== "object") return "";

    const raw = text(
      q.q ??
      q.question ??
      q.text ??
      q.prompt ??
      q.stem ??
      q.questionText ??
      q.title ??
      ""
    );

    return extractAndClean(
      raw,
      "Question figure"
    ).text;
  }


  /* =========================================================
     OPTION TEXT
  ========================================================== */

  function getOptionText(option) {
    const raw = text(option);

    return extractAndClean(
      raw,
      "Answer option figure"
    ).text;
  }


  /* =========================================================
     MEDIA NORMALIZER
  ========================================================== */

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
      (q.src
        ? {
            src: q.src,
            alt: q.alt
          }
        : null);

    if (!source) return [];

    return (Array.isArray(source) ? source : [source])
      .map(item => {
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


  /* =========================================================
     RAW ANSWER
  ========================================================== */

  function getRawAnswer(q) {
    if (!q || typeof q !== "object") return "";

    return (
      q.a ??
      q.answer ??
      q.correct ??
      q.correctAnswer ??
      q.correct_answer ??
      q.correct_option ??
      q.correctOption ??
      q.answer_text ??
      ""
    );
  }


  /* =========================================================
     OPTIONS
  ========================================================== */

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


  /* =========================================================
     ANSWER INDEX
  ========================================================== */

  function answerIndex(answer, options) {
    if (answer == null) return -1;

    if (typeof answer === "number") {
      if (
        answer >= 0 &&
        answer < options.length
      ) {
        return answer;
      }

      if (
        answer >= 1 &&
        answer <= options.length
      ) {
        return answer - 1;
      }
    }

    const original = text(answer).trim();

    const literal = options.findIndex(
      option =>
        option.trim() === original
    );

    if (original && literal >= 0) {
      return literal;
    }

    const spaced = original.replace(
      /\s+/g,
      " "
    );

    const whitespaceMatch =
      options.findIndex(
        option =>
          option
            .replace(/\s+/g, " ")
            .trim() === spaced
      );

    if (
      original &&
      whitespaceMatch >= 0
    ) {
      return whitespaceMatch;
    }

    const value = original
      .replace(/[.)\]:-]+$/, "")
      .trim();

    if (!value) return -1;

    if (/^[a-z]$/i.test(value)) {
      const index =
        value
          .toLowerCase()
          .charCodeAt(0) - 97;

      if (
        index >= 0 &&
        index < options.length
      ) {
        return index;
      }
    }

    if (/^\d+$/.test(value)) {
      const number = Number(value);

      if (
        number >= 1 &&
        number <= options.length
      ) {
        return number - 1;
      }

      if (
        number >= 0 &&
        number < options.length
      ) {
        return number;
      }
    }

    const normalized = value
      .replace(/\s+/g, " ")
      .toLowerCase();

    const exact = options.findIndex(
      option =>
        option
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase() === normalized
    );

    if (exact >= 0) {
      return exact;
    }

    const match = normalized.match(
      /(?:option|answer)\s*[\[(]?\s*([a-z]|\d+)\s*[\])]?\s*$/i
    );

    return match
      ? answerIndex(
          match[1],
          options
        )
      : -1;
  }


  /* =========================================================
     NORMALIZE QUESTION
  ========================================================== */

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


    /* ---------------------------------------------------------
       QUESTION TEXT + EMBEDDED QUESTION IMAGES
    ---------------------------------------------------------- */

    const rawQuestionText = text(
      input.q ??
      input.question ??
      input.text ??
      input.prompt ??
      input.stem ??
      input.questionText ??
      input.title ??
      ""
    );

    const extractedQuestion =
      extractAndClean(
        rawQuestionText,
        "Question figure"
      );

    const questionText =
      extractedQuestion.text.trim();


    /* ---------------------------------------------------------
       OPTIONS + EMBEDDED OPTION IMAGES
    ---------------------------------------------------------- */

    const rawOptions =
      input.options ??
      input.choices ??
      input.alternatives ??
      input.answers ??
      input.option ??
      [];

    const rawOptionEntries =
      Array.isArray(rawOptions)
        ? rawOptions
        : rawOptions &&
          typeof rawOptions === "object"
        ? Object.values(rawOptions)
        : [];

    const options =
      rawOptionEntries.map(
        getOptionText
      );


    /* ---------------------------------------------------------
       EXPLICIT QUESTION MEDIA
    ---------------------------------------------------------- */

    const explicitQuestionMedia =
      getQuestionMedia(input);

    q.__media = dedupeMedia([
      ...explicitQuestionMedia,
      ...extractedQuestion.images
    ]);


    /* ---------------------------------------------------------
       EXPLICIT OPTION MEDIA
    ---------------------------------------------------------- */

    let explicitOptionMedia = [];

    if (Array.isArray(input.optionMedia)) {
      explicitOptionMedia =
        input.optionMedia.map(item =>
          getQuestionMedia({
            images: item
          })
        );
    } else {
      explicitOptionMedia =
        rawOptionEntries.map(
          option =>
            option &&
            typeof option === "object"
              ? getQuestionMedia(option)
              : []
        );
    }


    /* ---------------------------------------------------------
       EMBEDDED OPTION IMAGES
    ---------------------------------------------------------- */

    const embeddedOptionMedia =
      rawOptionEntries.map(
        option => {
          const extracted =
            extractAndClean(
              text(option),
              "Answer option figure"
            );

          return extracted.images;
        }
      );


    q.__optionMedia =
      options.map(
        (_, optionIndex) =>
          dedupeMedia([
            ...(explicitOptionMedia[
              optionIndex
            ] || []),

            ...(embeddedOptionMedia[
              optionIndex
            ] || [])
          ])
      );


    /* ---------------------------------------------------------
       ANSWER
    ---------------------------------------------------------- */

    const rawAnswer =
      getRawAnswer(input);

    const answerValues =
      Array.isArray(rawAnswer)
        ? rawAnswer
        : [rawAnswer];

    const correctIndices =
      answerValues
        .map(answer =>
          answerIndex(
            answer,
            options
          )
        )
        .filter(
          value => value >= 0
        );


    /* ---------------------------------------------------------
       QUESTION TYPE
    ---------------------------------------------------------- */

    const mode = String(
      input.answerMode ??
      input.mode ??
      input.questionType ??
      input.type ??
      ""
    ).toLowerCase();

    const isTextAnswer =
      !options.length &&
      /text|numeric|integer|decimal|short|fill|subjective/.test(
        mode
      );

    const isMultiple =
      correctIndices.length > 1 ||
      /multiple|multi|checkbox/.test(
        mode
      );


    /* ---------------------------------------------------------
       BASIC NORMALIZED FIELDS
    ---------------------------------------------------------- */

    q.id =
      input.id ??
      input.questionId ??
      `${sourceLabel || "question"}-${index + 1}`;

    q.q = questionText;
    q.question = questionText;
    q.options = options;

    q.__answerRaw = rawAnswer;

    q.__correctIndex =
      correctIndices[0] ?? -1;

    q.__correctIndices =
      correctIndices;

    q.__answerMode =
      isTextAnswer
        ? "text"
        : isMultiple
        ? "multiple"
        : "single";


    /* ---------------------------------------------------------
       PASSAGE
    ---------------------------------------------------------- */

    q.__passage = text(
      input.passage ??
      input.context ??
      input.paragraph ??
      input.comprehension ??
      input.instructions ??
      ""
    );


    /* ---------------------------------------------------------
       TABLE
    ---------------------------------------------------------- */

    q.__table =
      input.table ??
      input.matchTable ??
      input.match ??
      input.columns ??
      (
        Array.isArray(input.columnI) ||
        Array.isArray(input.columnII)
          ? {
              columnI:
                input.columnI ?? [],
              columnII:
                input.columnII ?? []
            }
          : null
      );


    /* ---------------------------------------------------------
       CURRENT INDEX.HTML EXPECTS q.a
    ---------------------------------------------------------- */

    q.a =
      isMultiple
        ? correctIndices.map(
            i => options[i]
          )
        : options[
            correctIndices[0]
          ] ??
          text(rawAnswer);


    return q;
  }


  /* =========================================================
     UNWRAP QUESTION BANK
  ========================================================== */

  function unwrap(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (
      data &&
      typeof data === "object"
    ) {
      if (
        Array.isArray(
          data.questions
        )
      ) {
        return data.questions;
      }

      if (
        Array.isArray(data.items)
      ) {
        return data.items;
      }

      if (
        Array.isArray(
          data.questionBank
        )
      ) {
        return data.questionBank;
      }
    }

    throw new Error(
      "Question bank must be an array or contain a questions array."
    );
  }


  /* =========================================================
     VALIDATE BANK
  ========================================================== */

  function validateBank(
    data,
    sourceLabel
  ) {
    const list = unwrap(data);

    if (!list.length) {
      throw new Error(
        `${sourceLabel || "Question bank"}: no questions found.`
      );
    }

    return list
      .filter(
        question =>
          question?.disabled !== true
      )
      .map(
        (question, index) =>
          normalizeQuestionRecord(
            question,
            index,
            sourceLabel
          )
      );
  }


  /* =========================================================
     PARSE QUESTION DOCUMENT
  ========================================================== */

  function parseQuestionDocument(
    source,
    label
  ) {
    if (
      source &&
      typeof source === "object"
    ) {
      return source;
    }

    if (
      typeof source !== "string"
    ) {
      throw new Error(
        `${label || "Question bank"}: unsupported input.`
      );
    }

    let value = source
      .replace(/^\uFEFF/, "")
      .trim();


    const jsonScript =
      value.match(
        /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i
      );

    if (jsonScript) {
      value =
        jsonScript[1].trim();
    }


    value = value
      .replace(
        /^```(?:json|javascript|js)?\s*/i,
        ""
      )
      .replace(
        /\s*```$/,
        ""
      )
      .replace(
        /^(?:(?:const|let|var)\s+)?(?:window\.)?[A-Za-z_$][\w$]*(?:\.questions)?\s*=\s*/,
        ""
      )
      .replace(
        /;\s*$/,
        ""
      )
      .trim();


    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(
        `${label || "Question bank"}: invalid JSON. ${error.message}`
      );
    }
  }


  /* =========================================================
     ANSWER HELPERS
  ========================================================== */

  function getCorrectAnswer(
    question
  ) {
    if (!question) return "";

    if (
      question.__answerMode ===
      "multiple"
    ) {
      return (
        question.__correctIndices ||
        []
      )
        .map(
          index =>
            question.options[
              index
            ]
        )
        .join(" | ");
    }

    if (
      question.__answerMode ===
      "text"
    ) {
      return text(
        question.__answerRaw
      );
    }

    return (
      question.options?.[
        question.__correctIndex
      ] ?? ""
    );
  }


  function getSelectedAnswerText(
    question,
    selected
  ) {
    if (!question) return "";

    if (
      question.__answerMode ===
      "text"
    ) {
      return selected == null
        ? ""
        : String(selected);
    }

    const indexes =
      Array.isArray(selected)
        ? selected
        : selected == null
        ? []
        : [selected];

    return indexes
      .map(
        index =>
          question.options?.[
            index
          ]
      )
      .filter(Boolean)
      .join(" | ");
  }


  function isQuestionAnswered(
    question,
    selected
  ) {
    if (!question) {
      return false;
    }

    if (
      question.__answerMode ===
      "text"
    ) {
      return (
        String(
          selected ?? ""
        ).trim() !== ""
      );
    }

    if (
      question.__answerMode ===
      "multiple"
    ) {
      return (
        Array.isArray(selected) &&
        selected.length > 0
      );
    }

    return (
      Number.isInteger(selected) &&
      selected >= 0
    );
  }


  function isQuestionAnswerCorrect(
    question,
    selected
  ) {
    if (
      !isQuestionAnswered(
        question,
        selected
      )
    ) {
      return false;
    }

    if (
      question.__answerMode ===
      "text"
    ) {
      return (
        String(selected)
          .trim()
          .toLowerCase() ===
        text(
          question.__answerRaw
        )
          .trim()
          .toLowerCase()
      );
    }

    if (
      question.__answerMode ===
      "multiple"
    ) {
      const selectedSet =
        [
          ...new Set(
            selected.map(Number)
          )
        ].sort(
          (a, b) => a - b
        );

      const correctSet =
        [
          ...new Set(
            question.__correctIndices ||
            []
          )
        ].sort(
          (a, b) => a - b
        );

      return (
        selectedSet.length ===
          correctSet.length &&
        selectedSet.every(
          (value, index) =>
            value ===
            correctSet[index]
        )
      );
    }

    return (
      Number(selected) ===
      Number(
        question.__correctIndex
      )
    );
  }


  /* =========================================================
     PUBLIC API
  ========================================================== */

  global.QuestionBank =
    Object.freeze({
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
