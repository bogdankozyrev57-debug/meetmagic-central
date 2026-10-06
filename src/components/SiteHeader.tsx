import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LogOut, Menu, QrCode } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/roles";

/** Шапка сайта: роутинг между страницами, вход/выход, ссылка «Админ» только для роли admin. */
export function SiteHeader() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Корректный выход: отмена запросов, очистка кэша, выход, переход без возврата «назад»
  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const baseLinks = [
    { to: "/", label: "Мероприятия" },
    { to: "/tickets", label: "Мои билеты" },
    { to: "/organizer", label: "Организатору" },
    { to: "/access", label: "Права" },
    { to: "/docs", label: "Документация" },
  ] as const;
  const links = isAdmin ? [...baseLinks, { to: "/admin", label: "Админ" } as const] : baseLinks;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <CalendarDays className="size-4" />
          </span>
          Сбор
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {!loading && user ? (
            <>
              {/* Значок текущей роли — видно, под кем вы вошли */}
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isAdmin ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {isAdmin ? "Админ" : "Пользователь"}
              </span>
              <Button asChild variant="secondary" size="sm">
                <Link to="/profile">
                  <QrCode className="size-4" />
                  Кабинет
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="size-4" />
                Выйти
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Войти</Link>
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Меню"
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {open && (
        <div className="border-t border-border/70 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            {!loading && user ? (
              <Button variant="ghost" size="sm" className="justify-start" onClick={handleSignOut}>
                <LogOut className="size-4" />
                Выйти
              </Button>
            ) : (
              <Button asChild size="sm" className="mt-2">
                <Link to="/auth">Войти</Link>
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
