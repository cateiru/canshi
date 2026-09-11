import { redirect } from "next/navigation";
import { listCats } from "@/features/cats/queries";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const catList = await listCats();

  if (catList.length === 1) {
    redirect(`/cats/${catList[0].id}`);
  }

  if (catList.length >= 2) {
    redirect("/cats");
  }

  redirect("/home");
}
