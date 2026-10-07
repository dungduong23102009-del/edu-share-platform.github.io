"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  MagnifyingGlass,
  Plus,
  Trash,
} from "@phosphor-icons/react/ssr";
import type { DocumentView } from "@/lib/supabase/queries";
import {
  documentStatus,
  formatFileSize,
  PDF_MIME,
} from "@/lib/documents/validation";
import { Dialog, EmptyState, FileBadge, PageHeader } from "./ui";

export function DocumentsPage({
  documents,
  error,
  uploaded,
}: {
  documents: DocumentView[];
  error: string | null;
  uploaded: boolean;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const filtered = documents.filter((document) =>
    document.original_filename
      .toLocaleLowerCase("vi")
      .includes(search.toLocaleLowerCase("vi")),
  );
  async function remove() {
    if (!deleteId || busy.current) return;
    busy.current = true;
    setPending(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/documents/${deleteId}`, {
        method: "DELETE",
      });
      const result: { error?: string } = await response.json();
      if (response.status === 401) {
        window.location.assign(
          new URL("/login?reason=session", window.location.origin).href,
        );
        return;
      }
      if (!response.ok) {
        setDeleteError(result.error || "Không thể xóa tài liệu. Hãy thử lại.");
        return;
      }
      setDeleteId(null);
      router.refresh();
    } catch {
      setDeleteError("Không thể xóa tài liệu. Hãy thử lại.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div>
      <PageHeader
        title="Tài liệu của bạn"
        description="Tài liệu được lưu riêng trong tài khoản, để bạn mở lại bất cứ lúc nào."
        action={
          documents.length > 0 && (
            <Link href="/create" className="button primary">
              <Plus size={18} />
              Thêm tài liệu
            </Link>
          )
        }
      />
      {uploaded && (
        <p className="success-note" role="status">
          Tài liệu đã được tải lên thành công.
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
          <button className="text-link" onClick={() => router.refresh()}>
            Thử lại
          </button>
        </p>
      )}
      {documents.length > 0 && (
        <label className="search-field">
          <MagnifyingGlass size={20} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên tài liệu"
            aria-label="Tìm tài liệu"
          />
        </label>
      )}
      {!documents.length && !error ? (
        <EmptyState
          title="Chưa có tài liệu"
          description="Thêm tài liệu học để bắt đầu."
          action={
            <Link href="/create" className="button primary">
              Thêm tài liệu
            </Link>
          }
        />
      ) : !filtered.length && !error ? (
        <EmptyState
          title="Chưa tìm thấy tài liệu"
          description="Thử một từ khóa khác hoặc xóa nội dung tìm kiếm."
          action={
            <button className="text-link" onClick={() => setSearch("")}>
              Xóa tìm kiếm
            </button>
          }
        />
      ) : (
        <div className="library-list">
          {filtered.map((document) => (
            <article
              className="library-row"
              key={document.id}
              data-document-id={document.id}
            >
              <FileBadge
                format={document.mime_type === PDF_MIME ? "PDF" : "DOCX"}
              />
              <div className="document-copy">
                <h2>{document.original_filename}</h2>
                <span>
                  {document.mime_type === PDF_MIME ? "PDF" : "DOCX"}
                  <i />
                  {formatFileSize(document.file_size)}
                  <i />
                  {new Date(document.created_at).toLocaleDateString("vi-VN")}
                  <i />
                  {documentStatus(document.status)}
                </span>
              </div>
              <Link
                className="button secondary"
                href={
                  document.status === "ready"
                    ? `/topics?documentId=${document.id}`
                    : `/processing?documentId=${document.id}&start=1`
                }
              >
                {document.status === "ready"
                  ? "Xem phân tích"
                  : document.status === "processing"
                    ? "Xem tiến độ"
                    : document.status === "failed"
                      ? "Thử phân tích lại"
                      : "Phân tích tài liệu"}
              </Link>
              {["uploaded", "ready"].includes(document.status) && (
                <a
                  className="button secondary"
                  href={`/api/documents/${document.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mở tài liệu
                  <ArrowUpRight size={16} />
                </a>
              )}
              <button
                className="icon-button"
                aria-label={`Xóa ${document.original_filename}`}
                onClick={() => {
                  setDeleteError("");
                  setDeleteId(document.id);
                }}
              >
                <Trash size={19} />
              </button>
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={!!deleteId}
        title="Xóa tài liệu khỏi thư viện?"
        onClose={() => {
          if (!busy.current) setDeleteId(null);
        }}
      >
        <p>
          File đã tải lên và dữ liệu tài liệu sẽ được xóa khỏi tài khoản. File
          gốc trên máy được giữ nguyên.
        </p>
        {deleteError && (
          <p className="inline-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="button-row">
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => setDeleteId(null)}
          >
            Giữ lại
          </button>
          <button className="button danger" disabled={pending} onClick={remove}>
            {pending ? "Đang xóa…" : "Xóa tài liệu"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
