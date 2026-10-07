import { Dashboard } from "@/components/dashboard";
import {
  loadDocuments,
  loadProfile,
  requireUser,
} from "@/lib/supabase/queries";
export default async function DashboardPage() {
  const { client, user } = await requireUser();
  const [{ documents, error }, profile] = await Promise.all([
    loadDocuments(),
    loadProfile(user, client),
  ]);
  return (
    <Dashboard
      documents={documents}
      error={error}
      displayName={profile.displayName}
    />
  );
}
