import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход и регистрация — Сбор" },
      {
        name: "description",
        content: "Войдите в Сбор, чтобы регистрироваться на мероприятия и получать QR-билеты.",
      },
      { property: "og:title", content: "Вход и регистрация — Сбор" },
      {
        property: "og:description",
        content: "Войдите в Сбор, чтобы регистрироваться на мероприятия и получать QR-билеты.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";
type Step = "identity" | "secret";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordIssue(value: string) {
  if (value.length < 8) return "Минимум 8 символов";
  if (!/[A-Za-zА-Яа-я]/.test(value) || !/\d/.test(value)) return "Добавьте буквы и цифры";
  return null;
}

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("identity");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/tickets", replace: true });
  }, [loading, user, navigate]);

  function switchMode(next: Mode) {
    setMode(next);
    setStep("identity");
    setPassword("");
    setConfirm("");
    setSent(false);
  }

  function handleIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (!emailPattern.test(email)) {
      toast.error("Введите корректный адрес электронной почты");
      return;
    }
    if (mode === "signup" && firstName.trim().length < 2) {
      toast.error("Укажите имя");
      return;
    }
    setStep("secret");
  }

  async function handleSecret(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const issue = passwordIssue(password);
        if (issue) throw new Error(issue);
        if (password !== confirm) throw new Error("Пароли не совпадают");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: `${firstName.trim()} ${lastName.trim()}`.trim() },
          },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Добро пожаловать!");
        navigate({ to: "/tickets" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось выполнить операцию");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div className="hero-surface">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-14">
          <div className="card-surface w-full px-6 py-8 sm:px-10">
            <div className="flex flex-col items-center text-center">
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <CalendarDays className="size-5" />
              </span>
              {sent ? (
                <>
                  <h1 className="mt-5 font-display text-2xl font-semibold">
                    Подтвердите почту
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Мы отправили письмо на <span className="text-foreground">{email}</span>.
                    Перейдите по ссылке из письма, чтобы завершить регистрацию.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="mt-5 font-display text-2xl font-semibold">
                    {mode === "signin" ? "Вход в аккаунт" : "Создание аккаунта"}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step === "identity"
                      ? "Используйте свою рабочую или личную почту"
                      : mode === "signin"
                        ? "Введите пароль"
                        : "Придумайте надёжный пароль"}
                  </p>
                </>
              )}
            </div>

            {sent ? (
              <div className="mt-8 flex flex-col gap-3">
                <Button asChild className="w-full">
                  <Link to="/">К списку мероприятий</Link>
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => switchMode("signin")}>
                  Уже подтвердил — войти
                </Button>
              </div>
            ) : step === "identity" ? (
              <form onSubmit={handleIdentity} className="mt-8 space-y-4">
                {mode === "signup" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Имя</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Фамилия</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Электронная почта</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                  >
                    {mode === "signin" ? "Создать аккаунт" : "У меня уже есть аккаунт"}
                  </button>
                  <Button type="submit">Далее</Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSecret} className="mt-8 space-y-4">
                <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
                  <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs font-semibold uppercase">
                    {email.slice(0, 1)}
                  </span>
                  <span className="truncate">{email}</span>
                  <button
                    type="button"
                    className="ml-auto text-xs font-medium text-primary hover:underline"
                    onClick={() => setStep("identity")}
                  >
                    Изменить
                  </button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                  />
                  {mode === "signup" && (
                    <p className="text-xs text-muted-foreground">
                      Не менее 8 символов, буквы и цифры
                    </p>
                  )}
                </div>

                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Повторите пароль</Label>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    onClick={() => setStep("identity")}
                  >
                    <ArrowLeft className="size-4" />
                    Назад
                  </button>
                  <Button type="submit" disabled={busy}>
                    {mode === "signin" ? "Войти" : "Зарегистрироваться"}
                  </Button>
                </div>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">
              Вернуться к списку мероприятий
            </Link>
          </p>
        </div>
      </div>
    </PageShell>
  );
}
