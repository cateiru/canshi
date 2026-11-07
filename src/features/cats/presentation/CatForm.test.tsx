import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Cat } from "@/db/schema";
import { readSubmittedCatChoices } from "../domain/submittedChoices";
import type { CatFormState } from "./actions";
import { CatForm } from "./CatForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() }),
}));

const NAME_ERROR = "名前を入力してください";

/** 入力エラーで戻すときの createCatAction・updateCatAction と同じ値を返す */
const rejectWithSubmittedChoices = vi.fn(
  async (_state: CatFormState, formData: FormData): Promise<CatFormState> => ({
    fieldErrors: { name: [NAME_ERROR] },
    submittedChoices: readSubmittedCatChoices(formData),
  }),
);

function renderForm(
  action: (
    state: CatFormState,
    formData: FormData,
  ) => Promise<CatFormState> = rejectWithSubmittedChoices,
  cat?: Partial<Cat>,
) {
  const { container } = render(
    <CatForm
      action={action}
      cat={cat as Cat | undefined}
      households={[{ id: "household-1", name: "うちの家" }]}
      submitLabel="保存する"
    />,
  );
  const form = container.querySelector("form") as HTMLFormElement;
  return {
    form,
    read: () => Object.fromEntries(new FormData(form)),
  };
}

async function submitAndWaitForError(form: HTMLFormElement) {
  const calls = rejectWithSubmittedChoices.mock.calls.length;
  fireEvent.submit(form);
  await waitFor(() => {
    expect(rejectWithSubmittedChoices.mock.calls.length).toBe(calls + 1);
    expect(screen.getByText(NAME_ERROR)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存する" })).toBeEnabled();
  });
}

const savedCat: Partial<Cat> = {
  id: "cat-1",
  name: "たま",
  sex: "female",
  birthDatePrecision: "day",
  householdId: "household-1",
  neuterStatus: "intact",
  coatColor: "black",
  coatPattern: null,
  coatWhite: null,
};

describe("CatForm", () => {
  it("登録時は猫を飼う家を選べる", () => {
    renderForm();

    expect(
      screen.getByText(
        "選んだ家のメンバーと、このねこの記録を共有します。登録した後は、家を変えられません。",
      ),
    ).toBeInTheDocument();
  });

  it("編集時は猫を飼う家を選べず、送信もしない", () => {
    const { read } = renderForm(rejectWithSubmittedChoices, savedCat);

    expect(
      screen.queryByText(
        "選んだ家のメンバーと、このねこの記録を共有します。登録した後は、家を変えられません。",
      ),
    ).not.toBeInTheDocument();
    expect(read()).not.toHaveProperty("householdId");
  });

  it("入力エラーで戻っても、避妊・去勢と毛色・柄の選択を保持する", async () => {
    const { form, read } = renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "済" }));
    fireEvent.click(screen.getByRole("radio", { name: "茶" }));
    fireEvent.click(screen.getByRole("radio", { name: "縞（トラ）" }));
    fireEvent.click(
      screen.getByRole("radio", { name: "少し（胸・足先など）" }),
    );

    await submitAndWaitForError(form);

    const expected = {
      neuterStatus: "neutered",
      coatColor: "red",
      coatPattern: "mackerel_tabby",
      coatWhite: "low",
    };
    expect(read()).toMatchObject(expected);
    expect(screen.getByText("茶・縞（トラ）・白少し")).toBeInTheDocument();

    // 何も変えずにもう一度送っても、選択は残る
    await submitAndWaitForError(form);

    expect(read()).toMatchObject(expected);
    expect(screen.getByText("茶・縞（トラ）・白少し")).toBeInTheDocument();
  });

  it("編集時も、保存済みの値ではなく送信した選択を保持する", async () => {
    const { form, read } = renderForm(rejectWithSubmittedChoices, savedCat);

    fireEvent.click(screen.getByRole("radio", { name: "済" }));
    fireEvent.click(screen.getByRole("radio", { name: "茶" }));

    await submitAndWaitForError(form);

    expect(read()).toMatchObject({
      neuterStatus: "neutered",
      coatColor: "red",
    });
  });

  it("編集時に未設定へ選び直した項目は、保存済みの値に戻さない", async () => {
    const { form, read } = renderForm(rejectWithSubmittedChoices, savedCat);

    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "避妊" })).getByRole(
        "radio",
        { name: "未設定" },
      ),
    );
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "ベース色" })).getByRole(
        "radio",
        { name: "未設定" },
      ),
    );

    await submitAndWaitForError(form);

    expect(read()).toMatchObject({ neuterStatus: "", coatColor: "" });
  });

  it("入力エラーで戻っても、送信した性別に合わせた呼び方のままにする", async () => {
    const action = vi.fn(
      async (
        state: CatFormState,
        formData: FormData,
      ): Promise<CatFormState> => {
        const result = await rejectWithSubmittedChoices(state, formData);
        return {
          ...result,
          submittedChoices: {
            ...readSubmittedCatChoices(formData),
            sex: "male",
          },
        };
      },
    );
    const { form } = renderForm(action, savedCat);
    expect(
      screen.getByRole("radiogroup", { name: "避妊" }),
    ).toBeInTheDocument();

    fireEvent.submit(form);

    expect(
      await screen.findByRole("radiogroup", { name: "去勢" }),
    ).toBeInTheDocument();
  });
});
