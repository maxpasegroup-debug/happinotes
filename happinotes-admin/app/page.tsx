import { redirect } from "next/navigation";

export default async function HomePage() {
  // The web client is an admin CMS only. End users use the Flutter app.
  redirect("/admin/login");
}
