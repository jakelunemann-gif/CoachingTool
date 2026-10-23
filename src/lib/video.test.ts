import { describe, expect, it } from "vitest";
import { videoInfo } from "./video";

describe("videoInfo", () => {
  it("handles youtu.be with a start time, shorts, and drive links", () => {
    expect(videoInfo("https://youtu.be/G0J-ZDZzetU?t=385").embedUrl).toBe("https://www.youtube-nocookie.com/embed/G0J-ZDZzetU?start=385");
    expect(videoInfo("https://youtube.com/shorts/Grh5LzxZ2WM").thumbnail).toBe("https://i.ytimg.com/vi/Grh5LzxZ2WM/mqdefault.jpg");
    expect(videoInfo("https://www.youtube.com/watch?v=abc123").embedUrl).toContain("/embed/abc123");
    expect(videoInfo("https://drive.google.com/file/d/1sDZ5/view?usp=sharing").embedUrl).toBe("https://drive.google.com/file/d/1sDZ5/preview");
    expect(videoInfo("not a url").kind).toBe("other");
  });
});
