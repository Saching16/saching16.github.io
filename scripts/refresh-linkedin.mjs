import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const linkedinTextPath = path.join(repoRoot, "data", "rag", "linkedin.txt");
const LINKEDIN_URL =
  process.env.LINKEDIN_PROFILE_URL || "https://www.linkedin.com/in/sachinganpule/";

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractLinkedInText(html) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const descriptionMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  );
  const ogDescriptionMatch = html.match(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  );

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    titleMatch?.[1],
    descriptionMatch?.[1],
    ogDescriptionMatch?.[1],
    bodyText,
  ]
    .filter(Boolean)
    .map(decodeHtmlEntities)
    .join("\n\n")
    .trim();
}

async function main() {
  const response = await fetch(LINKEDIN_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; personal-website-rag-refresh/1.0)",
    },
  });

  if (!response.ok) {
    console.log(`LinkedIn fetch skipped: HTTP ${response.status}`);
    return;
  }

  const html = await response.text();
  if (/authwall|login|checkpoint/i.test(html)) {
    console.log("LinkedIn fetch skipped: public profile appears blocked.");
    return;
  }

  const text = extractLinkedInText(html);
  if (text.length < 500) {
    console.log("LinkedIn fetch skipped: not enough public text extracted.");
    return;
  }

  await writeFile(linkedinTextPath, text, "utf8");
  console.log(`Updated ${linkedinTextPath} from ${LINKEDIN_URL}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
