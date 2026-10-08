import { test as base, expect } from "@playwright/test";

// 1x1 の PNG。オーナーアイコンの取得先（GitHub）に実際には通信しないための差し替え
const pixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// すべての E2E が使う test。GitHub のアイコン画像への通信を止める（実際の GitHub を呼ばない）
export const test = base.extend<{ stubAvatars: undefined }>({
  stubAvatars: [
    async ({ context }, provide) => {
      await context.route("https://avatars.githubusercontent.com/**", (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: pixelPng }),
      );
      await provide(undefined);
    },
    { auto: true },
  ],
});

export { expect };
