import { redirect } from "next/navigation";

import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in — no reason to show the form again.
  if (await getCurrentUser()) redirect("/");
  return <LoginForm />;
}
