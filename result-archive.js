/* Large immutable answer snapshots share the existing results collection.
 * Reserved IDs are excluded from student lists and loaded only by Admin > View.
 * No additional Firebase collection permissions are needed.
 */
(function () {
  "use strict";
  const prefix = "~report~";
  const inlineLimit = 250000;
  const chunkLength = 100000; // <= 300 KB UTF-8, including Hindi and surrogate pairs.
  const chunkId = (attemptId, index) => `${prefix}${attemptId}~${String(index).padStart(6, "0")}`;

  function prepare(details, attemptId) {
    if (!attemptId || attemptId.includes("/") || attemptId.startsWith(prefix)) throw new Error("Invalid report attempt ID.");
    const json = JSON.stringify(details);
    if (new TextEncoder().encode(json).length <= inlineLimit) {
      return { fields: { answerDetailsJson: json }, chunks: [] };
    }
    const chunks = [];
    for (let start = 0; start < json.length;) {
      let end = Math.min(start + chunkLength, json.length);
      // Do not split UTF-16 surrogate pairs across Firestore strings.
      if (end < json.length && /[\uD800-\uDBFF]/.test(json[end - 1])) end--;
      chunks.push({ id: chunkId(attemptId, chunks.length), data: {
        recordType: "report_chunk", attemptId, index: chunks.length, content: json.slice(start, end)
      }});
      start = end;
    }
    return { fields: { answerDetailsJson: "", answerDetailsArchive: {
      version: 1, attemptId, count: chunks.length, length: json.length
    } }, chunks };
  }

  function archiveIds(record) {
    const archive = record.answerDetailsArchive;
    if (!archive) return [];
    if (archive.version !== 1 || typeof archive.attemptId !== "string" || !archive.attemptId ||
        archive.attemptId.includes("/") || archive.attemptId.startsWith(prefix) ||
        !Number.isInteger(archive.count) || archive.count < 1 || archive.count > 2000 ||
        !Number.isInteger(archive.length) || archive.length < 1) {
      throw new Error("The saved report archive metadata is invalid.");
    }
    return Array.from({ length: archive.count }, (_, index) => chunkId(archive.attemptId, index));
  }

  async function save(prepared, writeGroup) {
    // At most ~3 MB per commit, comfortably below Firestore's request limit.
    for (let start = 0; start < prepared.chunks.length; start += 10) {
      await writeGroup(prepared.chunks.slice(start, start + 10));
    }
  }

  async function load(record, readChunk) {
    if (!record.answerDetailsArchive) {
      if (Array.isArray(record.answerDetails)) return record.answerDetails;
      const result = JSON.parse(record.answerDetailsJson || "[]");
      if (!Array.isArray(result)) throw new Error("The saved answer ledger is invalid.");
      return result;
    }
    const archive = record.answerDetailsArchive;
    const ids = archiveIds(record);
    const content = [];
    for (let start = 0; start < ids.length; start += 6) {
      const group = await Promise.all(ids.slice(start, start + 6).map(async (id, offset) => {
        const part = await readChunk(id);
        if (!part || part.recordType !== "report_chunk" || part.attemptId !== archive.attemptId ||
            part.index !== start + offset || typeof part.content !== "string") {
          throw new Error("The report is incomplete. Reconnect and open View again; no partial report was exported.");
        }
        return part.content;
      }));
      content.push(...group);
    }
    const json = content.join("");
    if (json.length !== archive.length) throw new Error("The report archive is incomplete.");
    const details = JSON.parse(json);
    if (!Array.isArray(details)) throw new Error("The saved answer ledger is invalid.");
    return details;
  }

  window.ExamResultArchive = { prefix, prepare, save, load, archiveIds };
})();
