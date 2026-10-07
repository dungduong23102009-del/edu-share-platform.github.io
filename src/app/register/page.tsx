import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export default async function RegisterPage() {
  const { data } = await (await createClient()).auth.getUser();
  if (data.user) redirect("/dashboard");
  return <AuthForm mode="register" />;
}
