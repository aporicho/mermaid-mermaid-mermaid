import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { extractXiaohongshuPreviewCoverUrls } = require("../../../../../electron/link-preview.cjs") as {
  extractXiaohongshuPreviewCoverUrls: (html: string, baseUrl: URL) => string[];
};

describe("Electron xiaohongshu link preview extraction", () => {
  it("ignores default meta images and prefers note detail covers", () => {
    const baseUrl = new URL("https://www.xiaohongshu.com/explore/abc?xsec_token=token&xsec_source=pc_search");
    const html = `
      <meta property="og:image" content="//picasso-static.xiaohongshu.com/fe-platform/default.png">
      <script>
        window.__INITIAL_STATE__={"note":{"noteDetailMap":{"abc":{"note":{"imageList":[{
          "urlPre":"http:\\u002F\\u002Fsns-webpic-qc.xhscdn.com\\u002Fnotes_pre_post\\u002Fpreview!nd_prv_wlteh_jpg_3",
          "urlDefault":"http:\\u002F\\u002Fsns-webpic-qc.xhscdn.com\\u002Fnotes_pre_post\\u002Fcover-3!nd_dft_wlteh_jpg_3"
        }]}}}}};
      </script>
    `;

    expect(extractXiaohongshuPreviewCoverUrls(html, baseUrl)[0]).toBe("https://sns-webpic-qc.xhscdn.com/notes_pre_post/cover-3!nd_dft_wlteh_jpg_3");
  });

  it("extracts video first-frame cover candidates ahead of avatars", () => {
    const baseUrl = new URL("https://www.xiaohongshu.com/explore/video-note");
    const html = `
      <script>
        window.__INITIAL_STATE__={"note":{"noteDetailMap":{"video-note":{"note":{
          "user":{"avatar":"https://sns-img-qc.xhscdn.com/avatar/user-avatar.jpg"},
          "video":{"firstFrame":"http:\\u002F\\u002Fsns-img-qc.xhscdn.com\\u002Fnote\\u002Fvideo-first-frame.jpg"}
        }}}}};
      </script>
    `;

    expect(extractXiaohongshuPreviewCoverUrls(html, baseUrl)[0]).toBe("https://sns-img-qc.xhscdn.com/note/video-first-frame.jpg");
  });
});
