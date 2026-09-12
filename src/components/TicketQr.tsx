import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function TicketQr({ code, size = 190 }: { code: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(code, {
      width: size * 2,
      margin: 1,
      color: { dark: "#10151f", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      active = false;
    };
  }, [code, size]);

  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl bg-white p-2"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={`QR-код билета ${code}`} width={size - 16} height={size - 16} />
      ) : (
        <span className="text-xs text-neutral-500">QR…</span>
      )}
    </div>
  );
}
