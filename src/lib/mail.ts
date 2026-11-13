'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export interface MailStatus {
  configured: boolean;
  base: string;
  isLocal: boolean;
  shareEnabled: boolean;
}

export interface MailResult {
  personId: string;
  name: string;
  status: 'sent' | 'no-email' | 'nothing-due' | 'error';
  error?: string;
}

/** Loose client-side check; the server validates strictly. */
export const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** Admin only: SMTP / link status for the email features. */
export function useMailStatus(enabled: boolean) {
  const [status, setStatus] = useState<MailStatus | null>(null);
  useEffect(() => {
    if (!enabled) return;
    api<MailStatus>('GET', '/api/mail')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [enabled]);
  return status;
}

export function sendMail(personIds: string[]) {
  return api<{ results: MailResult[]; shareCreated: boolean; link: string }>('POST', '/api/mail', { personIds });
}

export function summarizeResults(results: MailResult[]): string {
  const sent = results.filter((r) => r.status === 'sent').length;
  const parts = [`Đã gửi ${sent}/${results.length} email`];
  const noEmail = results.filter((r) => r.status === 'no-email').map((r) => r.name);
  const nothing = results.filter((r) => r.status === 'nothing-due').map((r) => r.name);
  const failed = results.filter((r) => r.status === 'error').map((r) => r.name);
  if (noEmail.length) parts.push(`chưa có email: ${noEmail.join(', ')}`);
  if (nothing.length) parts.push(`đã trả đủ: ${nothing.join(', ')}`);
  if (failed.length) parts.push(`lỗi: ${failed.join(', ')}`);
  return parts.join(' · ');
}
