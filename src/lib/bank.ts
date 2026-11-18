import { isoWeek, startOfWeek } from './date';

/** Bank account shown on the finance tab and in payment emails (matches src/assets/qr_card.jpg). */
export const BANK = { name: 'Vietcombank', holder: 'PHAM DOAN KHANG', account: '1048056552', bin: '970436' };

/** "Phạm Đoàn Khang" -> "Pham Doan Khang" (bank transfer notes should avoid diacritics). */
export const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\w .-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Suggested transfer note from the dates being paid, e.g. "A.Phong TT an uong T45-46". */
export function transferNote(name: string, dates: string[]): string {
  const nums = [...new Set(dates.map((d) => isoWeek(startOfWeek(d))))].sort((a, b) => a - b);
  const range = nums.length > 1 ? `${nums[0]}-${nums[nums.length - 1]}` : `${nums[0] ?? ''}`;
  // Banks cap the note at ~50 characters; keep it short and plain.
  // Only an opening debt (no weeks): say so instead of an empty week range.
  if (!nums.length) return `${plain(name)} TT no cu`.trim().slice(0, 50);
  return `${plain(name)} TT an uong T${range}`.trim().slice(0, 50);
}

/** One EMVCo TLV field: id + 2-digit length + value. */
const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as required by EMVCo QR. */
function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * VietQR (NAPAS 247) payload with the amount and note filled in, so the payer only scans and confirms.
 * `amountK` is in thousands of VND like the rest of the app (90 = 90.000đ). Render it with any QR library.
 */
export function vietQrPayload(amountK: number, note: string): string {
  const amount = Math.round(amountK * 1000);
  const info = plain(note).slice(0, 50);
  const body =
    tlv('00', '01') + // payload format
    tlv('01', amount > 0 ? '12' : '11') + // 12 = dynamic (one payment), 11 = static
    tlv('38', tlv('00', 'A000000727') + tlv('01', tlv('00', BANK.bin) + tlv('01', BANK.account)) + tlv('02', 'QRIBFTTA')) +
    tlv('53', '704') + // VND
    (amount > 0 ? tlv('54', String(amount)) : '') +
    tlv('58', 'VN') +
    (info ? tlv('62', tlv('08', info)) : '') +
    '6304';
  return body + crc16(body);
}
