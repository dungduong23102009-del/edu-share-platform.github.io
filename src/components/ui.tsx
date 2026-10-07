"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  FileDoc,
  FilePdf,
  X,
} from "@phosphor-icons/react/ssr";

export function PageHeader({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  back?: string;
}) {
  return (
    <header className="page-header">
      {back && (
        <Link className="back-link" href={back}>
          ← Quay lại
        </Link>
      )}
      <div className="header-row">
        <div>
          <h1>{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
export function FileBadge({ format }: { format: "PDF" | "DOCX" }) {
  const Icon = format === "PDF" ? FilePdf : FileDoc;
  return (
    <span className={`file-badge ${format.toLowerCase()}`}>
      <Icon size={27} weight="light" aria-hidden="true" />
    </span>
  );
}
export function ProgressBar({
  value,
  label,
  className = "",
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`progress-track ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="progress-fill"
        style={{
          transform: `scaleX(${Math.max(0, Math.min(100, value)) / 100})`,
        }}
      />
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">
        <BookOpen size={24} weight="light" aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flow-steps" aria-label="Tiến trình tạo bài">
      {["Tài liệu", "Chủ đề", "Thiết lập"].map((label, index) => (
        <li
          key={label}
          className={
            index === current ? "current" : index < current ? "done" : ""
          }
          aria-current={index === current ? "step" : undefined}
        >
          <span>
            {index < current ? (
              <Check size={14} weight="bold" aria-hidden="true" />
            ) : (
              index + 1
            )}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}
export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = ref.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-content">
        <button
          type="button"
          className="icon-button dialog-close"
          aria-label="Đóng"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
export function NextArrow() {
  return <ArrowRight size={18} weight="bold" aria-hidden="true" />;
}
