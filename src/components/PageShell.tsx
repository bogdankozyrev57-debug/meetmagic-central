import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  LogOut,
  Menu,
  ShieldCheck,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ROLE_NAME, useRole } from "@/lib/roles";

/**
 * Каркас страниц: сверху слева — кнопка-«гамбургер» (три чёрточки), под ней —
 * логотип «Сбор». Боковое меню скрыто всегда и открывается
 * ТОЛЬКО по нажатию на три чёрточки — на любом экране (телефон, планшет, компьютер).
 */
export function PageShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { role, isAdmin } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Блокируем прокрутку страницы, пока меню открыто
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Корректный выход: отмена запросов, очистка кэша, выход, переход без возврата «назад»
  async function handleSignOut() {
    setOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const baseLinks = [
    { to: "/", label: "Мероприятия", icon: CalendarDays },
    { to: "/tickets", label: "Мои билеты", icon: Ticket },
    { to: "/organizer", label: "Организатору", icon: BarChart3 },
    { to: "/access", label: "Права", icon: ShieldCheck },
    { to: "/docs", label: "Документация", icon: BookOpen },
  ] as const;
  const links = isAdmin
    ? [...baseLinks, { to: "/admin", label: "Админ", icon: ShieldCheck } as const]
    : baseLinks;

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-primary/10 [&.active]:text-primary"
        >
          <link.icon className="size-5 shrink-0" />
          {link.label}
        </Link>
      ))}
    </nav>
  );

  const account = (
    <div className="border-t border-border/70 p-3">
      {!loading && user ? (
        <div className="flex flex-col gap-2">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-primary/10 [&.active]:text-primary"
          >
            <UserRound className="size-5 shrink-0" />
            Кабинет
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                isAdmin ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {ROLE_NAME[role]}
            </span>
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-5 shrink-0" />
            Выйти
          </button>
        </div>
      ) : (
        <Button asChild className="w-full">
          <Link to="/auth" onClick={() => setOpen(false)}>
            Войти
          </Link>
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Верхняя полоса: слева «три чёрточки», под ней — логотип */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="flex items-center px-2 pt-1">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Открыть меню">
            <Menu className="size-6" />
          </Button>
        </div>
        <div className="px-4 pb-2.5">
          <Link to="/" onClick={() => setOpen(false)} className="inline-flex items-center gap-2 font-display text-base font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="size-4" />
            </span>
            Сбор
          </Link>
        </div>
      </header>

      {/* Меню поверх страницы — открывается только по трём чёрточкам */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute right-0 top-0 flex h-full w-72 flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between pl-4">
              <span className="flex items-center gap-2 font-display text-lg font-bold">
                <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <CalendarDays className="size-4" />
                </span>
                Сбор
              </span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Закрыть меню">
                <X className="size-5" />
              </Button>
            </div>
            {nav}
            {account}
          </aside>
        </div>
      )}

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
