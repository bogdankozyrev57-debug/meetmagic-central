import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const ELEMENT_ID = "qr-scanner-region";

export function QrScanner({ onScan }: { onScan: (code: string) => void }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(ELEMENT_ID);
        scannerRef.current = scanner as unknown as typeof scannerRef.current;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            onScan(decoded.trim());
          },
          () => {},
        );
        if (cancelled) await scanner.stop();
      } catch {
        if (!cancelled) {
          setError("Не удалось включить камеру. Введите код билета вручную.");
          setActive(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [active, onScan]);

  return (
    <div className="space-y-3">
      <div
        id={ELEMENT_ID}
        className={active ? "overflow-hidden rounded-xl border border-border" : "hidden"}
      />
      <Button variant={active ? "secondary" : "default"} size="sm" onClick={() => setActive(!active)}>
        {active ? "Выключить камеру" : "Сканировать камерой"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
