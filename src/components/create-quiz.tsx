"use client";
import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { UploadSimple, WarningCircle, X } from "@phosphor-icons/react/ssr";
import { validateMetadata, formatFileSize } from "@/lib/documents/validation";
import { FileBadge, PageHeader } from "./ui";

export function CreateQuiz() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const documentId = useRef<string | null>(null);
  const busy = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  function chooseFile(selected?: File) {
    if (!selected || busy.current) return;
    const invalid = validateMetadata(selected);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setFile(selected);
    documentId.current = crypto.randomUUID();
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }
  async function upload() {
    if (!file || !documentId.current || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("document_id", documentId.current);
      const response = await fetch("/api/documents", {
        method: "POST",
        body: form,
      });
      const result: { error?: string; id?: string } = await response.json();
      if (response.status === 401) {
        window.location.assign(
          new URL("/login?reason=session", window.location.origin).href,
        );
        return;
      }
      if (!response.ok) {
        setError(result.error || "Không thể tải tài liệu lên. Hãy thử lại.");
        return;
      }
      if (!result.id) throw new Error("UPLOAD_ID_MISSING");
      router.push(`/processing?documentId=${result.id}&start=1`);
      router.refresh();
    } catch {
      setError("Không thể tải tài liệu lên. Hãy kiểm tra kết nối và thử lại.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="flow-page">
      <PageHeader
        title="Tạo bài trắc nghiệm"
        description="Tải tài liệu để nhận diện chủ đề và trích xuất nội dung có sẵn."
      />
      <div className="upload-shell">
        <div
          className={`upload-dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!pending) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
        >
          <span className="upload-icon">
            <UploadSimple size={30} weight="light" />
          </span>
          <h2>Kéo tài liệu vào đây</h2>
          <p>Hoặc chọn một file từ máy của bạn.</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={pending}
          >
            Chọn từ máy
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            disabled={pending}
            onChange={(event) => {
              chooseFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <span className="upload-support">
            PDF / DOCX <i /> Tối đa 20 MB
          </span>
        </div>
      </div>
      {file && (
        <div className="selected-file">
          <FileBadge
            format={file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX"}
          />
          <div>
            <strong>{file.name}</strong>
            <span>{formatFileSize(file.size)}</span>
          </div>
          <button
            className="icon-button"
            aria-label="Bỏ tài liệu"
            disabled={pending}
            onClick={() => {
              setFile(null);
              documentId.current = null;
              setError("");
            }}
          >
            <X size={20} />
          </button>
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          <WarningCircle size={19} />
          {error}
        </p>
      )}
      <p className="small-note upload-note">
        Tài liệu được lưu riêng trong tài khoản của bạn. Tính năng tạo câu hỏi
        từ tài liệu sẽ có ở bước tiếp theo.
      </p>
      <div className="upload-actions">
        <Link href="/practice" className="text-link">
          Luyện với câu hỏi mẫu
        </Link>
        <button
          className="button primary"
          disabled={!file || pending}
          aria-busy={pending}
          onClick={upload}
        >
          <UploadSimple size={18} />
          {pending ? "Đang tải lên…" : "Tải tài liệu lên"}
        </button>
      </div>
      {pending && (
        <p className="small-note" role="status">
          Đang lưu tài liệu. Vui lòng chờ trong giây lát.
        </p>
      )}
    </div>
  );
}
