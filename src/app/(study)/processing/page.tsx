import { ProcessingTimeline } from "@/components/processing-timeline";
import { DocumentProcessing } from "@/components/document-processing";
import { UUID_PATTERN } from "@/lib/documents/validation";
import { notFound } from "next/navigation";
export default async function ProcessingPage({
  searchParams,
}: {
  searchParams: Promise<{ documentId?: string; start?: string }>;
}) {
  const query = await searchParams;
  if (query.documentId) {
    if (!UUID_PATTERN.test(query.documentId)) notFound();
    return (
      <DocumentProcessing
        documentId={query.documentId}
        start={query.start === "1"}
      />
    );
  }
  return <ProcessingTimeline />;
}
