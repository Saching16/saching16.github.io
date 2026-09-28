import { createVerify, generateKeyPairSync } from "node:crypto";
import {
  createSignedJwt,
  downloadAsPdf,
  getAccessToken,
  GOOGLE_DOC_MIME,
  listFolderFiles,
  parseServiceAccount,
} from "../scripts/lib/googleDrive.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const serviceAccount = {
  client_email: "rag-refresh@example.iam.gserviceaccount.com",
  private_key: privateKey,
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("googleDrive", () => {
  it("rejects service account JSON without credentials", () => {
    expect(() => parseServiceAccount("not json")).toThrow(/not valid JSON/);
    expect(() => parseServiceAccount("{}")).toThrow(
      /client_email and private_key/,
    );
    expect(() =>
      parseServiceAccount(
        JSON.stringify({ client_email: "x", private_key: "bad" }),
      ),
    ).toThrow(/not a valid PEM key/);
    expect(
      parseServiceAccount(JSON.stringify(serviceAccount)).client_email,
    ).toBe(serviceAccount.client_email);
  });

  it("creates a verifiable RS256 JWT with read-only Drive scope", () => {
    const jwt = createSignedJwt(serviceAccount, 1_000_000);
    const [header, claims, signature] = jwt.split(".");

    const verified = createVerify("RSA-SHA256")
      .update(`${header}.${claims}`)
      .verify(publicKey, signature, "base64url");
    expect(verified).toBe(true);

    const decoded = JSON.parse(Buffer.from(claims, "base64url").toString());
    expect(decoded).toEqual({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_000_000,
      exp: 1_003_600,
    });
  });

  it("exchanges the JWT for an access token", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ access_token: "token-123" }),
    );

    await expect(getAccessToken(serviceAccount, fetchImpl)).resolves.toBe(
      "token-123",
    );

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.body.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    expect(init.body.get("assertion").split(".")).toHaveLength(3);
  });

  it("surfaces Google errors with the HTTP status", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("invalid_grant", { status: 400 }),
    );
    await expect(getAccessToken(serviceAccount, fetchImpl)).rejects.toThrow(
      /authentication failed: HTTP 400 invalid_grant/,
    );
  });

  it("lists every page of a folder", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ files: [{ id: "a" }], nextPageToken: "p2" }),
      )
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: "b" }] }));

    const files = await listFolderFiles("folder-1", "token", fetchImpl);

    expect(files.map((file) => file.id)).toEqual(["a", "b"]);
    const firstUrl = new URL(fetchImpl.mock.calls[0][0]);
    expect(firstUrl.searchParams.get("q")).toBe(
      "'folder-1' in parents and trashed = false",
    );
    expect(
      new URL(fetchImpl.mock.calls[1][0]).searchParams.get("pageToken"),
    ).toBe("p2");
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe(
      "Bearer token",
    );
  });

  it("exports Google Docs as PDF and downloads PDFs directly", async () => {
    const fetchImpl = vi.fn(async () => new Response("%PDF-data"));

    await downloadAsPdf(
      { id: "doc", name: "Resume", mimeType: GOOGLE_DOC_MIME },
      "t",
      fetchImpl,
    );
    const pdf = await downloadAsPdf(
      { id: "pdf", name: "Profile.pdf", mimeType: "application/pdf" },
      "t",
      fetchImpl,
    );

    expect(fetchImpl.mock.calls[0][0]).toContain(
      "/files/doc/export?mimeType=application%2Fpdf",
    );
    expect(fetchImpl.mock.calls[1][0]).toContain("/files/pdf?alt=media");
    expect(pdf.toString()).toBe("%PDF-data");
  });
});
