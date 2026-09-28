import {
  assertLooksLikePdf,
  DRIVE_SOURCES,
  hasFileChanged,
  pickSourceFile,
  toManifestEntry,
} from "../scripts/lib/driveSources.mjs";
import { GOOGLE_DOC_MIME } from "../scripts/lib/googleDrive.mjs";

const resumeSource = DRIVE_SOURCES.find((source) => source.key === "resume");
const linkedinSource = DRIVE_SOURCES.find(
  (source) => source.key === "linkedin",
);

const files = [
  {
    id: "1",
    name: "Old Resume.pdf",
    mimeType: "application/pdf",
    modifiedTime: "2026-01-01T00:00:00Z",
    md5Checksum: "aaa",
  },
  {
    id: "2",
    name: "AI Eng Resume",
    mimeType: GOOGLE_DOC_MIME,
    modifiedTime: "2026-09-01T00:00:00Z",
  },
  {
    id: "3",
    name: "Resume.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    modifiedTime: "2026-09-20T00:00:00Z",
  },
  {
    id: "4",
    name: "Profile.pdf",
    mimeType: "application/pdf",
    modifiedTime: "2026-08-01T00:00:00Z",
    md5Checksum: "bbb",
  },
  {
    id: "5",
    name: "Cover letter.pdf",
    mimeType: "application/pdf",
    modifiedTime: "2026-09-25T00:00:00Z",
  },
];

describe("driveSources", () => {
  it("picks the newest matching file with a supported format", () => {
    expect(pickSourceFile(files, resumeSource).id).toBe("2");
    expect(pickSourceFile(files, linkedinSource).id).toBe("4");
  });

  it("returns null when nothing matches", () => {
    expect(pickSourceFile([files[4]], resumeSource)).toBeNull();
  });

  it("detects changes against the manifest", () => {
    const pdf = files[0];
    const entry = toManifestEntry(pdf);

    expect(hasFileChanged(pdf, undefined)).toBe(true);
    expect(hasFileChanged(pdf, entry)).toBe(false);
    expect(
      hasFileChanged({ ...pdf, modifiedTime: "2026-02-01T00:00:00Z" }, entry),
    ).toBe(true);
    expect(hasFileChanged({ ...pdf, md5Checksum: "zzz" }, entry)).toBe(true);
    expect(hasFileChanged({ ...pdf, id: "other" }, entry)).toBe(true);

    const googleDoc = files[1];
    expect(hasFileChanged(googleDoc, toManifestEntry(googleDoc))).toBe(false);
  });

  it("rejects downloads that are not PDFs", () => {
    expect(() =>
      assertLooksLikePdf(Buffer.from("<html>login</html>"), "x"),
    ).toThrow(/not a valid PDF/);
    expect(() =>
      assertLooksLikePdf(
        Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(2048)]),
        "x",
      ),
    ).not.toThrow();
  });
});
