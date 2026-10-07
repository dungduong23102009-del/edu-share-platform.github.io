"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BookOpen,
  ClockCounterClockwise,
  Files,
  GearSix,
  House,
  List,
  Plus,
  X,
} from "@phosphor-icons/react/ssr";
import type { ProfileView } from "@/lib/supabase/queries";
import { LogoutButton } from "./logout-button";
import { ProfileAvatar } from "./profile-avatar";

const navigation = [
  { href: "/dashboard", label: "Trang chủ", Icon: House },
  { href: "/create", label: "Tạo bài trắc nghiệm", Icon: Plus },
  { href: "/documents", label: "Tài liệu", Icon: Files },
  { href: "/history", label: "Lịch sử", Icon: ClockCounterClockwise },
];
export function AppShell({
  children,
  profile,
}: {
  children: ReactNode;
  profile: ProfileView;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const inCreateFlow = ["/create", "/processing", "/topics", "/setup"].includes(
    pathname,
  );
  const renderNav = () =>
    navigation.map(({ href, label, Icon }) => (
      <Link
        key={href}
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`nav-link ${pathname === href || (href === "/create" && inCreateFlow) ? "active" : ""}`}
        aria-current={pathname === href ? "page" : undefined}
      >
        <Icon size={21} weight="light" aria-hidden="true" />
        {label}
      </Link>
    ));
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-icon">
            <BookOpen size={23} weight="light" />
          </span>
          <span>
            study<span className="brand-dot">.</span>
          </span>
        </Link>
        <p className="sidebar-caption">Góc học tập của bạn</p>
        <nav aria-label="Điều hướng chính">{renderNav()}</nav>
        <div className="sidebar-bottom">
          <Link
            href="/settings"
            className={`nav-link settings-link ${pathname === "/settings" ? "active" : ""}`}
          >
            <GearSix size={20} weight="light" />
            Cài đặt
          </Link>
          <div className="profile">
            <ProfileAvatar
              url={profile.avatarUrl}
              initials={profile.initials}
            />
            <div>
              <strong>{profile.displayName}</strong>
              <span title={profile.email}>{profile.email}</span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <header className="mobile-header">
        <Link href="/dashboard" className="brand">
          <span className="brand-icon">
            <BookOpen size={20} />
          </span>
          <span>
            study<span className="brand-dot">.</span>
          </span>
        </Link>
        <button
          className="icon-button"
          aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <List size={24} />}
        </button>
      </header>
      {mobileOpen && (
        <nav
          className="mobile-menu"
          id="mobile-menu"
          aria-label="Điều hướng mobile"
        >
          {renderNav()}
          <Link
            className="nav-link"
            href="/settings"
            onClick={() => setMobileOpen(false)}
          >
            <GearSix size={20} />
            Cài đặt
          </Link>
          <LogoutButton />
        </nav>
      )}
      <main id="main-content" className="app-main">
        {children}
        <footer className="app-footer">Học theo nhịp của bạn.</footer>
      </main>
    </div>
  );
}
