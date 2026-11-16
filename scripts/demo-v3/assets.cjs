"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { id, hash, date } = require("./definition.cjs"),
  { cache, req, storageRoot } = require("./local.cjs");
async function pdf(text, at) {
  const Doc = req("pdfkit"),
    doc = new Doc({
      info: {
        Title: "UTC DEMO V3 — SYNTHETIC ONLY",
        Author: "Synthetic fixture generator",
        CreationDate: at,
        ModDate: at,
      },
    }),
    parts = [];
  const done = new Promise((resolve, reject) => {
    doc.on("data", (b) => parts.push(b));
    doc.on("end", () => resolve(Buffer.concat(parts)));
    doc.on("error", reject);
  });
  doc
    .fontSize(16)
    .text("UTC DEMO V3 - SYNTHETIC ONLY")
    .moveDown()
    .fontSize(11)
    .text(text)
    .moveDown()
    .text(
      "No real personal data. No signatures. Not an official university record.",
    );
  doc.end();
  return done;
}
function zip(text) {
  const name = Buffer.from("src/demo.ts"),
    bytes = Buffer.from(text),
    crc = req("./dist/guidance/submissions/submission.validator").crc32(bytes),
    l = Buffer.alloc(30),
    c = Buffer.alloc(46),
    e = Buffer.alloc(22);
  l.writeUInt32LE(0x04034b50);
  l.writeUInt16LE(20, 4);
  l.writeUInt32LE(crc, 14);
  l.writeUInt32LE(bytes.length, 18);
  l.writeUInt32LE(bytes.length, 22);
  l.writeUInt16LE(name.length, 26);
  c.writeUInt32LE(0x02014b50);
  c.writeUInt16LE(20, 6);
  c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(bytes.length, 20);
  c.writeUInt32LE(bytes.length, 24);
  c.writeUInt16LE(name.length, 28);
  e.writeUInt32LE(0x06054b50);
  e.writeUInt16LE(1, 8);
  e.writeUInt16LE(1, 10);
  e.writeUInt32LE(c.length + name.length, 12);
  e.writeUInt32LE(l.length + name.length + bytes.length, 16);
  return Buffer.concat([l, name, bytes, c, name, e]);
}
async function asset(
  ctx,
  tx,
  { key, kind, bytes, actor, at, taskId, submissionId },
) {
  const assetId = id("asset/" + key),
    uploadId = id("upload/" + key),
    storageKey = "guidance/" + uploadId;
  const dir = path.join(storageRoot, ".private-guidance");
  fs.mkdirSync(dir, { recursive: true });
  const destination = path.join(dir, uploadId);
  if (fs.existsSync(destination))
    assert.equal(
      hash(fs.readFileSync(destination)),
      hash(bytes),
      "Refuse replacing existing storage bytes",
    );
  else fs.writeFileSync(destination, bytes, { flag: "wx", mode: 0o600 });
  const manifest = {
    kind,
    originalName: `DEMO-${kind.toLowerCase()}.${kind === "SOURCE" ? "zip" : "pdf"}`,
    sizeBytes: bytes.length,
    mimeType: kind === "SOURCE" ? "application/zip" : "application/pdf",
    checksum: hash(bytes),
  };
  await ctx.put(tx, "fileAsset", {
    id: assetId,
    ...manifest,
    state: "READY",
    storageKey,
    createdByUserId: actor,
    createdAt: at,
    updatedAt: at,
  });
  if (taskId) {
    const policy = ctx.local.req(
      "./dist/guidance/submissions/submission-policy",
    ).approvedSubmissionPolicy;
    await ctx.put(tx, "guidanceSubmissionUpload", {
      id: uploadId,
      requestKey: id("upload-request/" + key),
      payloadHash: hash({ taskId, manifest }),
      taskId,
      actorId: actor,
      storageKey,
      state: "COMMITTED",
      manifest,
      policySnapshot: policy,
      assetId,
      submissionId,
      createdAt: at,
      expiresAt: new Date(at.getTime() + 86400000),
    });
    await ctx.put(tx, "submissionAsset", {
      id: id("submission-asset/" + key),
      submissionId,
      fileId: assetId,
      createdAt: at,
      updatedAt: at,
    });
  }
  return { assetId, uploadId, ...manifest };
}
module.exports = { pdf, zip, asset };
