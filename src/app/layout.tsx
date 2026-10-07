import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Quiz AI",
  description:
    "Không gian luyện tập từ tài liệu học của bạn. Prototype bằng dữ liệu mẫu.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
