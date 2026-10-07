"use client";
import { useRef, useState } from "react";
import { SignOut } from "@phosphor-icons/react/ssr";

export function LogoutButton() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout");
      try {
        sessionStorage.removeItem("study-quiz-ai:milestone-1");
      } catch {}
      window.location.assign(new URL("/login", window.location.origin).href);
    } catch {
      setError("Không thể đăng xuất. Hãy thử lại.");
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div>
      <button
        className="nav-link logout-button"
        type="button"
        onClick={logout}
        disabled={pending}
      >
        <SignOut size={20} />
        {pending ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
