"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { mockDocuments } from "@/lib/mock-data";
import { studyActions } from "@/lib/study-store";
import { PageHeader } from "./ui";
export function PracticePage() {
  const router = useRouter();
  const [fail, setFail] = useState(false);
  return (
    <div className="flow-page">
      <PageHeader
        title="Luyện với câu hỏi mẫu"
        description="Ôn Vật lí 12 với bộ câu hỏi có sẵn. Bài mẫu được lưu trong phiên trình duyệt."
      />
      <div className="settings-panel">
        <h2>Đề cương chương I</h2>
        <p>
          Nội năng, nhiệt động lực học và chất khí. Chọn chủ đề, làm bài, xem
          đáp án và ôn lại câu sai.
        </p>
        <button
          className="button primary"
          onClick={() => {
            studyActions.analyze(mockDocuments[0], fail);
            router.push("/processing");
          }}
        >
          Chuẩn bị bài mẫu
        </button>
      </div>
      {process.env.NODE_ENV === "development" && (
        <details className="dev-tools">
          <summary>Công cụ phát triển</summary>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={fail}
              onChange={(event) => setFail(event.target.checked)}
            />
            Mô phỏng lỗi chuẩn bị
          </label>
        </details>
      )}
    </div>
  );
}
