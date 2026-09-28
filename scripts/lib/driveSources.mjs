import { GOOGLE_DOC_MIME } from "./googleDrive.mjs";

const PDF_MIME = "application/pdf";
const MIN_PDF_BYTES = 1024;

export const DRIVE_SOURCES = [
  {
    key: "resume",
    label: "Resume",
    required: true,
    namePattern: /resume/i,
    mimeTypes: [PDF_MIME, GOOGLE_DOC_MIME],
    targets: ["data/rag/resume.pdf", "public/resume.pdf"],
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    required: false,
    namePattern: /linkedin|^profile/i,
    mimeTypes: [PDF_MIME],
    targets: ["data/rag/linkedin.pdf"],
  },
];

export function pickSourceFile(files, source) {
  return (
    files
      .filter(
        (file) =>
          source.namePattern.test(file.name) &&
          source.mimeTypes.includes(file.mimeType),
      )
      .sort(
        (a, b) => Date.parse(b.modifiedTime) - Date.parse(a.modifiedTime),
      )[0] || null
  );
}

export function toManifestEntry(file) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    md5Checksum: file.md5Checksum || null,
  };
}

export function hasFileChanged(file, manifestEntry) {
  if (!manifestEntry) {
    return true;
  }
  return (
    file.id !== manifestEntry.id ||
    file.modifiedTime !== manifestEntry.modifiedTime ||
    (file.md5Checksum || null) !== manifestEntry.md5Checksum
  );
}

export function assertLooksLikePdf(buffer, fileName) {
  if (
    buffer.length < MIN_PDF_BYTES ||
    buffer.subarray(0, 5).toString() !== "%PDF-"
  ) {
    throw new Error(`Downloaded "${fileName}" is not a valid PDF.`);
  }
}
