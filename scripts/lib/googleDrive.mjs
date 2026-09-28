import { createPrivateKey, createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function parseServiceAccount(rawJson) {
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON must include client_email and private_key.",
    );
  }
  try {
    createPrivateKey(parsed.private_key);
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON private_key is not a valid PEM key. Paste the full JSON key file.",
    );
  }
  return parsed;
}

export function createSignedJwt(
  { client_email, private_key },
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: client_email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(private_key, "base64url");
  return `${unsigned}.${signature}`;
}

async function ensureOk(response, action) {
  if (response.ok) {
    return response;
  }
  const body = await response.text().catch(() => "");
  throw new Error(
    `Google Drive ${action} failed: HTTP ${response.status} ${body.slice(0, 300)}`,
  );
}

export async function getAccessToken(serviceAccount, fetchImpl = fetch) {
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createSignedJwt(serviceAccount),
    }),
  });
  await ensureOk(response, "authentication");
  const { access_token: accessToken } = await response.json();
  return accessToken;
}

export async function listFolderFiles(
  folderId,
  accessToken,
  fetchImpl = fetch,
) {
  const files = [];
  let pageToken;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum)",
      orderBy: "modifiedTime desc",
      pageSize: "100",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetchImpl(`${DRIVE_API}/files?${params}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    await ensureOk(response, "folder listing");
    const data = await response.json();
    files.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

export async function downloadAsPdf(file, accessToken, fetchImpl = fetch) {
  const url =
    file.mimeType === GOOGLE_DOC_MIME
      ? `${DRIVE_API}/files/${file.id}/export?mimeType=application%2Fpdf`
      : `${DRIVE_API}/files/${file.id}?alt=media&supportsAllDrives=true`;

  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(response, `download of "${file.name}"`);
  return Buffer.from(await response.arrayBuffer());
}
