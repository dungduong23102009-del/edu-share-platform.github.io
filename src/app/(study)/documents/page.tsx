import { DocumentsPage } from "@/components/real-documents";
import { loadDocuments } from "@/lib/supabase/queries";
export default async function DocumentsRoute({
  searchParams,
}: {
  searchParams: Promise<{ uploaded?: string }>;
}) {
  const data = await loadDocuments();
  return (
    <DocumentsPage {...data} uploaded={(await searchParams).uploaded === "1"} />
  );
}
