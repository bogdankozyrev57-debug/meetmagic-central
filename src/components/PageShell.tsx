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
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/roles";

/**
 * Каркас страниц в стиле Google Класса:
 * слева — узкое меню с иконками и логотипом «Сбор», справа — содержимое.
 * На телефоне меню открывается кнопкой-«гамбургером» поверх страницы.
 */
export function PageShell({ children }: { children: ReactNode }) {
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
    <nav className="flex flex-1 flex-col gap-1 px-3">
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
              {isAdmin ? "Админ" : "Пользователь"}
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

  const logo = (
    <Link
      to="/"
      onClick={() => setOpen(false)}
      className="flex items-center gap-2 px-4 py-4 font-display text-lg font-bold"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <CalendarDays className="size-4" />
      </span>
      Сбор
    </Link>
  );

  return (
    <div className="flex min-h-screen">
      {/* Боковое меню — как в Google Классе (видно на планшете и компьютере) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/70 bg-background md:flex">
        {logo}
        {nav}
        {account}
      </aside>

      {/* Мобильное меню поверх страницы */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between pr-2">
              {logo}
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Закрыть меню">
                <X className="size-5" />
              </Button>
            </div>
            {nav}
            {account}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Верхняя полоса на телефоне: «гамбургер» + логотип */}
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border/70 bg-background/85 px-3 py-2 backdrop-blur md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Меню">
            <Menu className="size-5" />
          </Button>
          <Link to="/" className="flex items-center gap-2 font-display text-base font-bold">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="size-3.5" />
            </span>
            Сбор
          </Link>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-border/70 py-8">
          <div className="mx-auto w-full max-w-6xl px-4 text-sm text-muted-foreground">
            Сбор — платформа для организации встреч и конференций: регистрация, QR-билеты, отзывы и
            аналитика посещаемости.
          </div>
        </footer>
      </div>
    </div>
  );
}
