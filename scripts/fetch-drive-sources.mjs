import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertLooksLikePdf,
  DRIVE_SOURCES,
  hasFileChanged,
  pickSourceFile,
  toManifestEntry,
} from "./lib/driveSources.mjs";
import {
  downloadAsPdf,
  getAccessToken,
  listFolderFiles,
  parseServiceAccount,
} from "./lib/googleDrive.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(repoRoot, "data", "rag", "drive-manifest.json");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. See PLAN.md "One-time setup".`);
  }
  return value;
}

async function readManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return {};
  }
  return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
}

async function main() {
  const serviceAccount = parseServiceAccount(
    requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON"),
  );
  const folderId = requireEnv("GOOGLE_DRIVE_FOLDER_ID");

  const accessToken = await getAccessToken(serviceAccount);
  const files = await listFolderFiles(folderId, accessToken);
  console.log(`Found ${files.length} file(s) in Drive folder.`);

  const manifest = await readManifest();
  const nextManifest = { ...manifest };
  let changedCount = 0;

  for (const source of DRIVE_SOURCES) {
    const file = pickSourceFile(files, source);
    if (!file) {
      if (source.required) {
        throw new Error(
          `No ${source.label} file found in Drive folder (expected a name matching ${source.namePattern}).`,
        );
      }
      console.log(
        `${source.label}: no matching file in Drive, keeping current copy.`,
      );
      continue;
    }

    if (!hasFileChanged(file, manifest[source.key])) {
      console.log(`${source.label}: "${file.name}" unchanged since last sync.`);
      continue;
    }

    const pdf = await downloadAsPdf(file, accessToken);
    assertLooksLikePdf(pdf, file.name);
    for (const target of source.targets) {
      const targetPath = path.join(repoRoot, target);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, pdf);
    }

    nextManifest[source.key] = toManifestEntry(file);
    changedCount += 1;
    console.log(
      `${source.label}: updated from "${file.name}" (modified ${file.modifiedTime}) -> ${source.targets.join(", ")}`,
    );
  }

  if (changedCount === 0) {
    console.log("No Drive sources changed.");
    return;
  }

  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(nextManifest, null, 2)}\n`,
    "utf8",
  );
  console.log(`Wrote ${MANIFEST_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
