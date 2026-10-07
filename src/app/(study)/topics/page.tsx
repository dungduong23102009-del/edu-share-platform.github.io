import { TopicSelector } from "@/components/quiz-setup";
import { DocumentTopics } from "@/components/document-topics";
import { loadDocumentAnalysis } from "@/lib/documents/load-analysis";
import { requireUser } from "@/lib/supabase/queries";
import { UUID_PATTERN } from "@/lib/documents/validation";
import { notFound } from "next/navigation";
export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ documentId?: string }>;
}) {
  const { documentId } = await searchParams;
  if (documentId) {
    if (!UUID_PATTERN.test(documentId)) notFound();
    const { client, user } = await requireUser();
    const view = await loadDocumentAnalysis(client, user.id, documentId);
    if (!view) notFound();
    return <DocumentTopics key={view.document.id} view={view} />;
  }
  return <TopicSelector />;
}
