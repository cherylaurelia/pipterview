import { redirect } from "next/navigation";

/** The world used to live here; it's the home page now. */
export default function WorldPage() {
  redirect("/");
}
