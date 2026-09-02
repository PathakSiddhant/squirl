import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cookies } from 'next/headers';

/**
 * The local lock.
 *
 * Be clear about what this is. It is a lock, not a security boundary. It stops
 * someone idly opening the tab on a shared desk. It does not encrypt anything:
 * `data/squirl.db` sits on disk in the clear, and whoever holds the machine can
 * read it with any SQLite tool. Squirl says that plainly on the lock screen
 * rather than implying protection it does not provide.
 *
 * Given that, the design goal is honesty and predictability, not defence in
 * depth: a signed cookie, a constant-time comparison, and no accounts, no
 * server, no password reset flow to get wrong.
 */

const COOKIE = 'squirl_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Credentials live in the environment so they can be changed without touching
 * code, with the documented defaults as a fallback. Nothing is transmitted
 * anywhere, so there is no threat model in which a stronger default helps.
 */
const USERNAME = process.env.SQUIRL_USERNAME ?? 'Siddhant_Squirl';
const PASSWORD = process.env.SQUIRL_PASSWORD ?? 'LocalSquirl_123';

/**
 * The signing secret persists so that sessions survive a restart. It is read
 * lazily rather than at module scope: touching the filesystem while a module
 * is being evaluated pulls this file into the bundler's server trace and slows
 * every build that only wanted the type.
 */
let cachedSecret: string | null = null;

function secret(): string {
  if (cachedSecret) return cachedSecret;

  const fromEnv = process.env.SQUIRL_SESSION_SECRET;
  if (fromEnv) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }

  const file = join(process.cwd(), 'data', '.session-secret');
  if (existsSync(file)) {
    cachedSecret = readFileSync(file, 'utf8').trim();
  } else {
    cachedSecret = randomBytes(32).toString('hex');
    writeFileSync(file, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

/** Compare without leaking length or content through timing. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'compare').update(a).digest();
  const hb = createHmac('sha256', 'compare').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function credentialsMatch(username: string, password: string): boolean {
  // Both are always checked, so a wrong username costs the same as a wrong
  // password and neither can be probed independently.
  const userOk = safeEqual(username.trim(), USERNAME);
  const passOk = safeEqual(password, PASSWORD);
  return userOk && passOk;
}

/** Mint a signed token. The payload is only an issue time; there is one user. */
function mint(): string {
  const issuedAt = Date.now().toString(36);
  return `${issuedAt}.${sign(issuedAt)}`;
}

function isValid(token: string | undefined): boolean {
  if (!token) return false;
  const [issuedAt, signature] = token.split('.');
  if (!issuedAt || !signature) return false;
  if (!safeEqual(signature, sign(issuedAt))) return false;

  const age = Date.now() - parseInt(issuedAt, 36);
  return Number.isFinite(age) && age >= 0 && age < MAX_AGE_SECONDS * 1000;
}

export async function isUnlocked(): Promise<boolean> {
  const store = await cookies();
  return isValid(store.get(COOKIE)?.value);
}

export async function unlock(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, mint(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    // Squirl is served over plain http on localhost, so requiring a secure
    // cookie would mean it is never stored at all.
    secure: false,
  });
}

export async function lock(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
