// Saves a plan into Google Drive as a native Google Doc by uploading HTML
// with the Google Docs mime type (Drive converts it on upload).

const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const BOUNDARY = "coachingtool-plan";

function multipartBody(metadata: object, html: string): string {
  return [
    `--${BOUNDARY}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${BOUNDARY}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    `--${BOUNDARY}--`,
  ].join("\r\n");
}

export interface DriveResult {
  id: string;
  url: string;
  // True when the configured folder wasn't reachable and the doc went to My Drive.
  folderFallback: boolean;
  updated: boolean;
}

export class DriveError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function send(fetchImpl: typeof fetch, url: string, method: string, token: string, metadata: object, html: string) {
  const res = await fetchImpl(`${url}?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${BOUNDARY}` },
    body: multipartBody(metadata, html),
  });
  if (!res.ok) throw new DriveError(`Google Drive returned ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
  return (await res.json()) as { id: string; webViewLink: string };
}

export async function saveGoogleDoc(opts: {
  accessToken: string;
  name: string;
  html: string;
  folderId?: string;
  existingFileId?: string;
  fetchImpl?: typeof fetch;
}): Promise<DriveResult> {
  const f = opts.fetchImpl ?? fetch;
  const mimeType = "application/vnd.google-apps.document";

  if (opts.existingFileId) {
    try {
      const r = await send(f, `${UPLOAD}/${opts.existingFileId}`, "PATCH", opts.accessToken, { name: opts.name }, opts.html);
      return { id: r.id, url: r.webViewLink, folderFallback: false, updated: true };
    } catch (e) {
      // Deleted or no longer accessible: fall through and create a new doc.
      if (!(e instanceof DriveError) || (e.status !== 404 && e.status !== 403)) throw e;
    }
  }

  if (opts.folderId) {
    try {
      const r = await send(f, UPLOAD, "POST", opts.accessToken, { name: opts.name, mimeType, parents: [opts.folderId] }, opts.html);
      return { id: r.id, url: r.webViewLink, folderFallback: false, updated: false };
    } catch (e) {
      // With the drive.file scope the app can't see folders it didn't create.
      if (!(e instanceof DriveError) || (e.status !== 404 && e.status !== 403)) throw e;
    }
  }
  const r = await send(f, UPLOAD, "POST", opts.accessToken, { name: opts.name, mimeType }, opts.html);
  return { id: r.id, url: r.webViewLink, folderFallback: !!opts.folderId, updated: false };
}
