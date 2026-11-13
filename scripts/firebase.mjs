// Shared helpers for the database scripts (run with plain Node, outside Next.js).
import fs from 'node:fs';
import nextEnv from '@next/env';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info() {}, error: console.error });

export const COLLECTIONS = ['settings', 'goals', 'tasks', 'people', 'finance_entries'];

export function openFirestore() {
  let projectId = process.env.FIREBASE_PROJECT_ID;
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const j = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, 'utf8'));
    projectId = j.project_id;
    clientEmail = j.client_email;
    privateKey = j.private_key;
  }
  if (!projectId) throw new Error('Thiếu FIREBASE_SERVICE_ACCOUNT hoặc FIREBASE_PROJECT_ID trong .env.local');
  const app = process.env.FIRESTORE_EMULATOR_HOST
    ? initializeApp({ projectId }, 'script')
    : initializeApp({ projectId, credential: cert({ projectId, clientEmail, privateKey }) }, 'script');
  return { db: getFirestore(app), projectId };
}

export function sqlitePath() {
  return process.env.DATABASE_PATH || 'data/workhub.db';
}
