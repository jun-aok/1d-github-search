import { test } from "./support/test";
import { expectAriaMatchesMock, expectDomMatchesMock, readMock } from "./support/mock-compare";
import { detailStateCases } from "./support/mock-states";

// docs/design.md 7 節「モックとの一致」: 詳細ページ（mock/detail.html）の各状態と実装を比べる

test.describe("詳細ページ: モックとの一致", () => {
  for (const { state, title, setup } of detailStateCases) {
    test(`構造（aria snapshot）: ${title} がモックの ${state} と一致する`, async ({
      page,
      context,
    }) => {
      const mock = await readMock(context, "detail", state);
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
      const mock = await readMock(context, "detail", state);
      const release = await setup(page);
      try {
        await expectDomMatchesMock(page, mock);
      } finally {
        release();
      }
    });
  }
});
