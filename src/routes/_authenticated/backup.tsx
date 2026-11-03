/**
 * Резервные копии базы (/backup).
 *
 * Файлы лежат в закрытой корзине «backups» хранилища Lovable Cloud — на том же
 * аккаунте, где работает база проекта, поэтому копию не нужно искать на флешке:
 * она открывается после входа в аккаунт с любого устройства.
 *
 * Доступ проверяется дважды: загрузчик маршрута запрашивает роли на сервере (без
 * роли admin страница не открывается), а сами обращения к хранилищу пропускаются
 * только политиками backups_read / backups_admin_* (public.has_role).
 */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseBackup, Download, Eye, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BACKUP_BUCKET, createBackup } from "@/lib/backup.functions";
import { formatDateTime } from "@/lib/format";
import { getMyRoles } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({
    meta: [
      { title: "Резервные копии базы — Сбор" },
      {
        name: "description",
        content: "Хранение и открытие резервных копий базы данных прямо в аккаунте проекта.",
      },
      { property: "og:title", content: "Резервные копии базы — Сбор" },
      {
        property: "og:description",
        content: "Хранение и открытие резервных копий базы данных прямо в аккаунте проекта.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  // Копии содержат все данные проекта, поэтому раздел закрыт для всех, кроме администраторов
  loader: async () => {
    const roles = await getMyRoles();
    if (!roles.includes("admin")) throw redirect({ to: "/access" });
    return { roles };
  },
  component: BackupPage,
});

type BackupFile = {
  name: string;
  created_at: string | null;
  metadata?: { size?: number } | null | undefined;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
}

function BackupPage() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);

  const files = useQuery({
    queryKey: ["backups"],
    queryFn: async (): Promise<BackupFile[]> => {
      const { data, error } = await supabase.storage
        .from(BACKUP_BUCKET)
        .list("", { limit: 50, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      return (data ?? [])
        .filter((item) => item.name.endsWith(".sql"))
        .map((item) => ({
          name: item.name,
          created_at: item.created_at ?? null,
          metadata: item.metadata as BackupFile["metadata"],
        }));
    },
  });

  async function handleCreate() {
    setBusy(true);
    try {
      const result = await createBackup();
      toast.success(`Копия ${result.path} сохранена (${formatSize(result.size)})`);
      await queryClient.invalidateQueries({ queryKey: ["backups"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать копию");
    } finally {
      setBusy(false);
    }
  }

  /** Скачать файл: сначала получаем его содержимое, затем сохраняем на устройство. */
  async function handleDownload(name: string) {
    setBusy(true);
    try {
      const { data, error } = await supabase.storage.from(BACKUP_BUCKET).download(name);
      if (error || !data) throw new Error("Файл не найден в хранилище");
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось скачать копию");
    } finally {
      setBusy(false);
    }
  }

  /** Показать содержимое копии прямо в браузере. */
  async function handlePreview(name: string) {
    setBusy(true);
    try {
      const { data, error } = await supabase.storage.from(BACKUP_BUCKET).download(name);
      if (error || !data) throw new Error("Файл не найден в хранилище");
      const text = await data.text();
      setPreview({ name, text: text.slice(0, 6000) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось открыть копию");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(name: string) {
    if (!window.confirm(`Удалить резервную копию ${name}?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.storage.from(BACKUP_BUCKET).remove([name]);
      if (error) throw error;
      toast.success("Копия удалена");
      if (preview?.name === name) setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["backups"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить копию");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Резервные копии базы</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Файлы хранятся в закрытом хранилище аккаунта проекта и открываются после входа —
              искать их на флешке не нужно. Каждый файл импортируется в phpMyAdmin.
            </p>
          </div>
          <Button onClick={handleCreate} disabled={busy}>
            <DatabaseBackup className="size-4" />
            {busy ? "Подождите…" : "Создать копию"}
          </Button>
        </div>

        <div className="mt-8 card-surface px-4 py-2">
          {files.isLoading ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Загружаем список файлов…</p>
          ) : files.isError ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              Не удалось получить список файлов. Обновите страницу.
            </p>
          ) : !files.data?.length ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              Копий пока нет. Нажмите «Создать копию» — файл появится здесь и будет храниться
              в аккаунте проекта.
            </p>
          ) : (
            <ul>
              {(files.data ?? []).map((file) => (
                <li
                  key={file.name}
                  className="flex flex-wrap items-center gap-3 border-b border-border/60 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {file.created_at ? formatDateTime(file.created_at) : "дата неизвестна"}
                      {typeof file.metadata?.size === "number"
                        ? ` · ${formatSize(file.metadata.size)}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant="outline">MySQL</Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Открыть ${file.name}`}
                      onClick={() => handlePreview(file.name)}
                      disabled={busy}
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Скачать ${file.name}`}
                      onClick={() => handleDownload(file.name)}
                      disabled={busy}
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Удалить ${file.name}`}
                      onClick={() => handleDelete(file.name)}
                      disabled={busy}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {preview && (
          <div className="mt-6 card-surface px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium">{preview.name}</p>
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                <RefreshCw className="size-4" />
                Закрыть
              </Button>
            </div>
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-secondary/60 p-3 text-xs leading-relaxed">
              {preview.text}
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Показаны первые 6000 символов. Полный файл — кнопка скачивания.
            </p>
          </div>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          <Link to="/access" className="hover:underline">
            Как устроены права доступа к разделу
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
