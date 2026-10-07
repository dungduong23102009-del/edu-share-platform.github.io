import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const client = await createClient();
  const { data } = await client.auth.getUser();
  if (data.user) redirect("/dashboard");
  return <AuthForm mode="login" reason={(await searchParams).reason} />;
}
