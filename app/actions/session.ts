'use server';

import { redirect } from 'next/navigation';

import { credentialsMatch, lock, unlock } from '@/lib/squirl/session';

export interface SignInState {
  error: string | null;
}

/**
 * Unlock Squirl.
 *
 * The failure message is deliberately the same whether the username or the
 * password was wrong. Not because an attacker is a serious concern on a
 * machine that already holds the database in the clear, but because "wrong
 * password" for a username that does not exist is a confusing thing to read
 * when there is only ever one account.
 */
export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { error: 'Enter your username and password.' };
  }

  if (!credentialsMatch(username, password)) {
    return { error: 'That does not match. Try again.' };
  }

  await unlock();
  redirect('/');
}

export async function signOut(): Promise<void> {
  await lock();
  redirect('/lock');
}
