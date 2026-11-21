import { redirect } from "next/navigation";

// The Coverage Map now lives on the overview page.
export default function CoverageRedirect() {
  redirect("/");
}
