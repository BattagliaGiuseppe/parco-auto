import { redirect } from "next/navigation";

export default function Home() {
  // appena si apre la root, reindirizza a /dashboard
  redirect("/dashboard");
}
