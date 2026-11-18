'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { vietQrPayload } from '@/lib/bank';

/** VietQR with the amount and note filled in, drawn in the browser (no outside service). */
export function VietQr({ amount, note, size = 132, alt }: { amount: number; note: string; size?: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(vietQrPayload(amount, note), { width: size * 2, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [amount, note, size]);

  if (!src) return <div style={{ width: size, height: size }} className="animate-pulse rounded-lg bg-slate-100" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- generated data URL
  return <img src={src} alt={alt} width={size} height={size} style={{ width: size, height: size }} className="block" />;
}
