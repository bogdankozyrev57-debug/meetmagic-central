import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/70 py-8">
        <div className="mx-auto w-full max-w-6xl px-4 text-sm text-muted-foreground">
          Сбор — платформа для организации встреч и конференций: регистрация, QR-билеты, отзывы и
          аналитика посещаемости.
        </div>
      </footer>
    </div>
  );
}
