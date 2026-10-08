import { expect, type BrowserContext, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// モック（mock/*.html）と実装の DOM 比較（docs/design.md 7 節「モックとの一致」）
// A. 構造: aria snapshot（要素の役割・文言・状態）
// B. 見た目: クラス名を含む DOM を正規化したもの
// どちらも <header> と <main> だけを比べる。モック上部の状態切り替えバーは <header> の外なので比較に入らない

const requestIdPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

// 毎回変わる値（問い合わせ番号）を伏せる
export function maskVolatile(text: string): string {
  return text.replaceAll(requestIdPattern, "<REQUEST_ID>");
}

export type MockFile = "search" | "detail";

export type Snapshots = {
  aria: { header: string; main: string };
  dom: { header: string; main: string };
};

const mockDirectory = resolve(__dirname, "../../mock");

export function mockUrl(file: MockFile, state: string): string {
  return `${pathToFileURL(resolve(mockDirectory, `${file}.html`)).href}?state=${state}`;
}

// ブラウザの中で動かす。DOM を正規化した文字列にする
//  - 属性とクラス名は並べ替える
//  - 空白は詰める（空白だけのテキストは捨てる）
//  - 表示されていない（display: none）要素は除く
//  - モックのスクリプトが要素を探すためだけの属性（id / for / data-view / data-request-id / onsubmit）は比べない
//    （id と for の結び付きは A の aria snapshot で確かめる。React は useId で別の id を付けるため）
//  - 入力欄の value は属性ではなく現在の値で比べる（モックは値をプロパティで入れ、React は属性にも出すため）
//  - 問い合わせ番号は伏せる
function serializeNormalizedDom(root: Element): string {
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
  const mask = (text: string): string => text.replaceAll(uuid, "<REQUEST_ID>");
  const scriptHooks = ["id", "for", "data-view", "data-request-id", "onsubmit"];
  const voidTags = ["img", "input", "br", "hr"];
  const ignoredTags = ["script", "style", "template", "noscript"];
  const lines: string[] = [];

  const visit = (node: Node, depth: number): void => {
    const indent = "  ".repeat(depth);
    if (node instanceof Text) {
      const text = node.data.replace(/\s+/g, " ").trim();
      if (text !== "") {
        lines.push(indent + mask(text));
      }
      return;
    }
    if (!(node instanceof Element)) {
      return;
    }
    const tag = node.tagName.toLowerCase();
    if (ignoredTags.includes(tag) || getComputedStyle(node).display === "none") {
      return;
    }
    const attributes = Array.from(node.attributes)
      .filter(
        (attribute) =>
          !scriptHooks.includes(attribute.name) &&
          !(node instanceof HTMLInputElement && attribute.name === "value"),
      )
      .map((attribute) => ({
        name: attribute.name,
        value:
          attribute.name === "class"
            ? Array.from(new Set(attribute.value.split(/\s+/).filter((token) => token !== "")))
                .sort()
                .join(" ")
            : mask(attribute.value),
      }));
    // classList.remove のあとに残る class="" は、class が無いのと同じ
    const kept = attributes.filter(
      (attribute) => !(attribute.name === "class" && attribute.value === ""),
    );
    attributes.length = 0;
    attributes.push(...kept);
    if (node instanceof HTMLInputElement && node.value !== "") {
      attributes.push({ name: "value", value: node.value });
    }
    attributes.sort((a, b) => a.name.localeCompare(b.name));
    const rendered = attributes
      .map((attribute) => ` ${attribute.name}="${attribute.value}"`)
      .join("");
    if (voidTags.includes(tag)) {
      lines.push(`${indent}<${tag}${rendered} />`);
      return;
    }
    lines.push(`${indent}<${tag}${rendered}>`);
    node.childNodes.forEach((child) => {
      visit(child, depth + 1);
    });
    lines.push(`${indent}</${tag}>`);
  };

  visit(root, 0);
  return lines.join("\n");
}

export async function takeAria(page: Page): Promise<Snapshots["aria"]> {
  return {
    header: maskVolatile(await page.getByRole("banner").ariaSnapshot()),
    main: maskVolatile(await page.getByRole("main").ariaSnapshot()),
  };
}

export async function takeDom(page: Page): Promise<Snapshots["dom"]> {
  return {
    header: await page.getByRole("banner").evaluate(serializeNormalizedDom),
    main: await page.getByRole("main").evaluate(serializeNormalizedDom),
  };
}

async function takeSnapshots(page: Page): Promise<Snapshots> {
  return { aria: await takeAria(page), dom: await takeDom(page) };
}

async function waitForTwoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            done();
          });
        });
      }),
  );
}

// モックを開き、Tailwind（ブラウザ版）が CSS を作り終えて表示が落ち着くまで待って、スナップショットを取る
export async function readMock(
  context: BrowserContext,
  file: MockFile,
  state: string,
): Promise<Snapshots> {
  const page = await context.newPage();
  try {
    await page.goto(mockUrl(file, state), { waitUntil: "networkidle" });
    // body の背景色（bg-gray-50）が付いたら Tailwind が動いた
    await page.waitForFunction(
      () => getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)",
    );
    let previous = JSON.stringify(await takeSnapshots(page));
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await waitForTwoFrames(page);
      const current = JSON.stringify(await takeSnapshots(page));
      if (current === previous) {
        break;
      }
      previous = current;
    }
    return await takeSnapshots(page);
  } finally {
    await page.close();
  }
}

// 実装の表示がモックと一致するまで待つ（描画や取得の途中で落ちないよう、poll で再取得する）
export async function expectAriaMatchesMock(page: Page, mock: Snapshots): Promise<void> {
  await expect.poll(() => takeAria(page), { timeout: 10_000 }).toEqual(mock.aria);
}

export async function expectDomMatchesMock(page: Page, mock: Snapshots): Promise<void> {
  await expect.poll(() => takeDom(page), { timeout: 10_000 }).toEqual(mock.dom);
}
