"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { BookOpen, GoogleLogo } from "@phosphor-icons/react/ssr";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({
  mode,
  reason,
}: {
  mode: "login" | "register";
  reason?: string;
}) {
  const register = mode === "register";
  const busy = useRef(false);
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState(
    reason === "oauth"
      ? "Không thể đăng nhập với Google. Hãy thử lại."
      : reason === "session"
        ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại."
        : reason === "unavailable"
          ? "Dịch vụ đăng nhập đang gián đoạn. Hãy thử lại."
          : "",
  );
  const [message, setMessage] = useState("");
  async function emailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending("email");
    setError("");
    setMessage("");
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") || "").trim();
    const password = String(fields.get("password") || "");
    try {
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: register ? "signup" : "login", email, password,
        }),
      });
      const result: {
        error?: string;
        success?: boolean;
        confirmationRequired?: boolean;
      } = await response.json();
      if (!response.ok || !result.success) {
        setError(result.error || "Không thể kết nối dịch vụ đăng nhập. Hãy thử lại.");
      } else if (!result.confirmationRequired) {
        window.location.assign(
          new URL("/dashboard", window.location.origin).href,
        );
        return;
      } else {
        setMessage(
          "Hãy kiểm tra hộp thư và xác nhận email để hoàn tất đăng ký, sau đó đăng nhập.",
        );
      }
    } catch {
      setError("Không thể kết nối dịch vụ đăng nhập. Hãy thử lại.");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }
  async function googleLogin() {
    if (busy.current) return;
    busy.current = true;
    setPending("google");
    setError("");
    setMessage("");
    try {
      const settingsResponse = await fetch("/api/auth/providers");
      if (!settingsResponse.ok) throw new Error("auth_settings");
      const settings: { google?: boolean } = await settingsResponse.json();
      if (!settings.google) {
        setError("Đăng nhập Google chưa sẵn sàng. Hãy thử lại sau.");
        busy.current = false;
        setPending(null);
        return;
      }
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "openid email profile",
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        setError("Không thể đăng nhập với Google. Hãy thử lại.");
        busy.current = false;
        setPending(null);
      }
    } catch {
      setError("Không thể kết nối đăng nhập Google. Hãy thử lại.");
      busy.current = false;
      setPending(null);
    }
  }
  return (
    <main className="auth-page" id="main-content">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-icon">
            <BookOpen size={23} weight="light" />
          </span>
          <span>
            study<span className="brand-dot">.</span>
          </span>
        </div>
        <h1>{register ? "Tạo tài khoản" : "Chào mừng trở lại"}</h1>
        <p className="page-description">
          {register
            ? "Lưu tài liệu và giữ góc học tập của riêng bạn."
            : "Đăng nhập để tiếp tục học và xem tài liệu của bạn."}
        </p>
        <button
          type="button"
          className="button secondary auth-google"
          onClick={googleLogin}
          disabled={!!pending}
        >
          <GoogleLogo size={20} />
          {pending === "google" ? "Đang mở Google…" : "Tiếp tục với Google"}
        </button>
        <div className="auth-divider">
          <span>hoặc</span>
        </div>
        <form
          className="auth-fields"
          onSubmit={emailLogin}
          aria-busy={!!pending}
        >
          <label htmlFor="email">
            Email
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={!!pending}
            />
          </label>
          <label htmlFor="password">
            Mật khẩu
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 8 : undefined}
              maxLength={128}
              disabled={!!pending}
            />
          </label>
          {register && (
            <p className="small-note">Dùng ít nhất 8 ký tự cho mật khẩu.</p>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="success-note" role="status">
              {message}
            </p>
          )}
          <button className="button primary" type="submit" disabled={!!pending}>
            {pending === "email"
              ? "Đang xử lý…"
              : register
                ? "Tạo tài khoản"
                : "Đăng nhập"}
          </button>
        </form>
        <Link
          className="text-link auth-switch"
          href={register ? "/login" : "/register"}
        >
          {register
            ? "Đã có tài khoản? Đăng nhập"
            : "Chưa có tài khoản? Đăng ký"}
        </Link>
      </div>
    </main>
  );
}
