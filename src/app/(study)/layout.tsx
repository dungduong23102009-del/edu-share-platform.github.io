import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { loadProfile, requireUser } from "@/lib/supabase/queries";

export default async function StudyLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { client, user } = await requireUser();
  const profile = await loadProfile(user, client);
  return <AppShell profile={profile}>{children}</AppShell>;
}
