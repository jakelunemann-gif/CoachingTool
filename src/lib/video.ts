// Turn the video links coaches paste (YouTube, Shorts, Google Drive) into
// embeddable URLs and thumbnails.

export interface VideoInfo {
  kind: "youtube" | "drive" | "other";
  embedUrl?: string;
  thumbnail?: string;
}

export function videoInfo(url: string): VideoInfo {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { kind: "other" };
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com") id = u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : u.searchParams.get("v") ?? "";
  if (id) {
    const t = u.searchParams.get("t") ?? u.searchParams.get("start");
    const start = t ? parseInt(t, 10) : 0;
    return {
      kind: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ""}`,
      thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    };
  }
  const drive = host === "drive.google.com" && u.pathname.match(/\/file\/d\/([^/]+)/);
  if (drive) return { kind: "drive", embedUrl: `https://drive.google.com/file/d/${drive[1]}/preview` };
  return { kind: "other" };
}
