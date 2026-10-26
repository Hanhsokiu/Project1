import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { inflateRawSync } from "zlib";
import type { SubmissionFileKind, SubmissionUploadPolicy } from "@doan/shared";
import type { GuidanceTaskRecord } from "../tasks/guidance.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
export const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const invalid = () =>
  groupError(
    400,
    "FILE_TYPE_INVALID",
    "Nội dung/định dạng file không hợp lệ hoặc không an toàn.",
  );
const control = (s: string) =>
  Array.from(s).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
const crcTable = Array.from({ length: 256 }, (_, v) => {
  let c = v;
  for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  return c >>> 0;
});
export function crc32(b: Buffer) {
  let crc = 0xffffffff;
  for (const byte of b) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}
@Injectable()
export class SubmissionValidator {
  filename(value: string) {
    const name = value.normalize("NFC");
    if (
      !name ||
      name.length > 180 ||
      control(name) ||
      /[<>:"/\\|?*\u202a-\u202e\u2066-\u2069]/u.test(name) ||
      name !== name.trim() ||
      /[. ]$/.test(name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    )
      groupError(
        400,
        "FILE_NAME_INVALID",
        "Tên file không an toàn; hãy đổi tên file.",
      );
    return name;
  }
  task(t: GuidanceTaskRecord) {
    const w = t.pr2bTaskWorkflowTaskId;
    if (
      !w?.kind ||
      !w.state ||
      !w.startsAt ||
      !w.periodId ||
      w.planId !== t.guidancePlanId ||
      !w.nextSubmissionNumber
    )
      groupError(
        409,
        "INPUT_NOT_READY",
        "Nhiệm vụ legacy/chưa cấu hình đầy đủ.",
      );
    if (
      !["TODO", "IN_PROGRESS", "SUBMITTED", "REVISION_REQUESTED"].includes(
        w.state,
      )
    )
      groupError(
        409,
        "STATE_TRANSITION_INVALID",
        "Không nộp bài cho nhiệm vụ hoàn thành/hủy.",
      );
    // Deadline alone never closes submission; the GUIDANCE phase is authoritative.
    return w;
  }
  file(
    kind: SubmissionFileKind,
    file: Express.Multer.File,
    p: SubmissionUploadPolicy,
  ) {
    // Multer 1.x/Busboy decodes bare browser filename parameters as latin1.
    const decoded = Array.from(file.originalname).every(
      (c) => c.charCodeAt(0) <= 255,
    )
      ? Buffer.from(file.originalname, "latin1").toString("utf8")
      : file.originalname;
    const name = this.filename(
        decoded.includes("\ufffd") ? file.originalname : decoded,
      ),
      ext = name.split(".").pop()!.toLowerCase();
    if (!file.buffer || !file.buffer.length || file.size !== file.buffer.length)
      invalid();
    if (file.size > p.maxFileBytes)
      groupError(413, "FILE_TOO_LARGE", "File vượt dung lượng cấu hình.");
    if (!(p.roles[kind].extensions as string[]).includes(ext)) invalid();
    const allowed: Record<string, string[]> = {
      pdf: ["application/pdf"],
      zip: ["application/zip", "application/x-zip-compressed"],
      png: ["image/png"],
      jpg: ["image/jpeg"],
      jpeg: ["image/jpeg"],
    };
    if (!allowed[ext]?.includes(file.mimetype.toLowerCase())) invalid();
    try {
      if (ext === "pdf") this.pdf(file.buffer);
      else if (ext === "zip") this.zip(file.buffer, p);
      else if (ext === "png") this.png(file.buffer);
      else this.jpeg(file.buffer);
    } catch (e) {
      if (e && typeof e === "object" && "getStatus" in e) throw e;
      invalid();
    }
    return {
      kind,
      originalName: name,
      sizeBytes: file.size,
      mimeType: allowed[ext][0],
      checksum: digest(file.buffer),
    };
  }
  private pdf(b: Buffer) {
    const s = b.toString("latin1");
    if (
      !/^%PDF-(1\.[0-7]|2\.0)[\r\n]/.test(s) ||
      !/%%EOF\s*$/.test(s) ||
      !/startxref\s+\d+\s+%%EOF\s*$/.test(s) ||
      !/\/Type\s*\/Catalog\b/.test(s) ||
      /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|OpenAction|AA)\b/i.test(
        s,
      )
    )
      invalid();
    // Envelope/active-action screening, not a claim of AV or full PDF interpretation.
  }
  private png(b: Buffer) {
    if (
      !b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      invalid();
    let offset = 8,
      ihdr = false,
      data = false;
    while (offset + 12 <= b.length) {
      const size = b.readUInt32BE(offset),
        end = offset + 12 + size;
      if (end > b.length) invalid();
      const kind = b.toString("ascii", offset + 4, offset + 8);
      if (crc32(b.subarray(offset + 4, end - 4)) !== b.readUInt32BE(end - 4))
        invalid();
      if (!ihdr) {
        if (
          kind !== "IHDR" ||
          size !== 13 ||
          !b.readUInt32BE(offset + 8) ||
          !b.readUInt32BE(offset + 12)
        )
          invalid();
        ihdr = true;
      }
      if (kind === "IDAT") data = true;
      if (kind === "IEND") {
        if (size || end !== b.length || !data) invalid();
        return;
      }
      offset = end;
    }
    invalid();
  }
  private jpeg(b: Buffer) {
    if (
      b.length < 12 ||
      b.readUInt16BE(0) !== 0xffd8 ||
      b.readUInt16BE(b.length - 2) !== 0xffd9
    )
      invalid();
    let i = 2,
      frame = false;
    while (i + 4 < b.length) {
      if (b[i++] !== 0xff) invalid();
      while (b[i] === 0xff) i++;
      const marker = b[i++];
      if (marker === 0xda) {
        if (!frame) invalid();
        return;
      }
      const length = b.readUInt16BE(i);
      if (length < 2 || i + length > b.length - 2) invalid();
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8 || !b.readUInt16BE(i + 3) || !b.readUInt16BE(i + 5))
          invalid();
        frame = true;
      }
      i += length;
    }
    invalid();
  }
  private zip(b: Buffer, p: SubmissionUploadPolicy) {
    if (b.length < 22 || b.readUInt32LE(0) !== 0x04034b50) invalid();
    let end = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
      if (
        b.readUInt32LE(i) === 0x06054b50 &&
        i + 22 + b.readUInt16LE(i + 20) === b.length
      ) {
        end = i;
        break;
      }
    }
    if (end < 0 || b.readUInt16LE(end + 4) || b.readUInt16LE(end + 6))
      invalid();
    const count = b.readUInt16LE(end + 10),
      size = b.readUInt32LE(end + 12),
      start = b.readUInt32LE(end + 16);
    if (
      !count ||
      count > p.zipMaxEntries ||
      b.readUInt16LE(end + 8) !== count ||
      start + size !== end
    )
      invalid();
    let i = start,
      total = 0;
    const names = new Set<string>(),
      ranges: Array<[number, number]> = [];
    for (let n = 0; n < count; n++) {
      if (i + 46 > end || b.readUInt32LE(i) !== 0x02014b50) invalid();
      const flags = b.readUInt16LE(i + 8),
        method = b.readUInt16LE(i + 10),
        crc = b.readUInt32LE(i + 16),
        compressed = b.readUInt32LE(i + 20),
        expanded = b.readUInt32LE(i + 24),
        nameLen = b.readUInt16LE(i + 28),
        extra = b.readUInt16LE(i + 30),
        comment = b.readUInt16LE(i + 32),
        offset = b.readUInt32LE(i + 42);
      if (
        flags & 0x41 ||
        ![0, 8].includes(method) ||
        b.readUInt16LE(i + 34) ||
        i + 46 + nameLen + extra + comment > end ||
        ((b.readUInt32LE(i + 38) >>> 16) & 0xf000) === 0xa000
      )
        invalid();
      const nameBytes = b.subarray(i + 46, i + 46 + nameLen),
        name = nameBytes.toString("utf8").normalize("NFKC");
      if (
        !name ||
        name.includes("\ufffd") ||
        control(name) ||
        /[\\:]/.test(name) ||
        name.startsWith("/") ||
        name
          .split("/")
          .some((x) => x === ".." || x === "." || /[. ]$/.test(x)) ||
        names.has(name.toLowerCase())
      )
        invalid();
      names.add(name.toLowerCase());
      total += expanded;
      if (
        total > p.zipMaxExpandedBytes ||
        offset + 30 > start ||
        b.readUInt32LE(offset) !== 0x04034b50 ||
        b.readUInt16LE(offset + 6) !== flags ||
        b.readUInt16LE(offset + 8) !== method
      )
        invalid();
      const localName = b.readUInt16LE(offset + 26),
        localExtra = b.readUInt16LE(offset + 28),
        dataStart = offset + 30 + localName + localExtra,
        dataEnd = dataStart + compressed;
      if (
        dataEnd > start ||
        !b.subarray(offset + 30, offset + 30 + localName).equals(nameBytes) ||
        ranges.some(([a, z]) => offset < z && dataEnd > a)
      )
        invalid();
      ranges.push([offset, dataEnd]);
      const bytes =
        method === 0
          ? b.subarray(dataStart, dataEnd)
          : inflateRawSync(b.subarray(dataStart, dataEnd), {
              maxOutputLength: Math.max(1, expanded),
            });
      if (bytes.length !== expanded || crc32(bytes) !== crc) invalid();
      i += 46 + nameLen + extra + comment;
    }
    if (i !== end) invalid();
  }
  late(submittedAt: Date, deadline: Date) {
    return submittedAt > deadline;
  }
}
