import { redirect } from "next/navigation";
import { listCurrentUserCats } from "@/features/auth/session";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const catList = await listCurrentUserCats();

  if (catList.length === 1) {
    redirect(`/cats/${catList[0].id}`);
  }

  if (catList.length >= 2) {
    redirect("/cats");
  }

  redirect("/home");
}
