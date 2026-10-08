import { test } from "./support/test";
import { expectAriaMatchesMock, expectDomMatchesMock, readMock } from "./support/mock-compare";
import { searchStateCases } from "./support/mock-states";

// docs/design.md 7 節「モックとの一致」: 検索ページ（mock/search.html）の各状態と実装を比べる
// A（構造）は aria snapshot、B（見た目）はクラス名を含む DOM。対応表は support/mock-states.ts

test.describe("検索ページ: モックとの一致", () => {
  for (const { state, title, setup } of searchStateCases) {
    test(`構造（aria snapshot）: ${title} がモックの ${state} と一致する`, async ({
      page,
      context,
    }) => {
      const mock = await readMock(context, "search", state);
      const release = await setup(page);
      try {
        await expectAriaMatchesMock(page, mock);
      } finally {
        release();
      }
    });

    test(`見た目（DOM とクラス名）: ${title} がモックの ${state} と一致する`, async ({
      page,
      context,
    }) => {
      const mock = await readMock(context, "search", state);
      const release = await setup(page);
      try {
        await expectDomMatchesMock(page, mock);
      } finally {
        release();
      }
    });
  }
});
