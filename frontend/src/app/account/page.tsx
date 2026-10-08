'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, clearToken, getToken, getUser } from '@/lib/api';
import { PasswordField } from '@/components/layout/AuthForm';

const WHAT_GOES = [
  'your account: name, email and password hash',
  'every quiz answer and your mastery in each topic',
  'compiler decisions and the notes on your answers',
  'study progress and the pathways you built',
  'written answers and their estimated rubric marks',
];

export default function AccountPage() {
  const router = useRouter();
  const [user, setUserState] = useState<{ name: string; email: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    const u = getUser();
    setUserState(u ? { name: u.name, email: u.email } : null);
  }, [router]);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDeleting(true);
    try {
      await api.deleteAccount(password);
      clearToken();
      sessionStorage.clear();
      router.push('/?deleted=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The account was not deleted.');
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[44rem] px-4 py-8 sm:px-6">
      <header className="pb-8">
        <h1 className="text-[1.75rem]">Account</h1>
        {user && <p className="mt-1 text-[0.9375rem] t-graphite">Signed in as {user.name}, {user.email}.</p>}
      </header>

      <section aria-labelledby="data-h" className="space-y-2">
        <h2 id="data-h" className="text-lg">Your data</h2>
        <p className="text-[0.9375rem]">
          The <Link href="/privacy" className="link">privacy page</Link> lists everything stored about you.
          Your <Link href="/history" className="link">decision history</Link> shows every program compiled for you.
        </p>
      </section>

      <section aria-labelledby="delete-h" className="section-rule mt-10 space-y-3 pt-8">
        <h2 id="delete-h" className="text-lg">Delete your account</h2>
        <p className="text-[0.9375rem]">This removes, permanently:</p>
        <ul className="list-disc space-y-1 pl-5 text-[0.9375rem]">
          {WHAT_GOES.map(item => <li key={item}>{item}</li>)}
        </ul>
        <p className="text-[0.9375rem]">There is no undo. You can register again with the same email afterwards.</p>

        {!confirming ? (
          <button type="button" className="btn btn-outline mt-2" onClick={() => setConfirming(true)}>
            Delete my account…
          </button>
        ) : (
          <form onSubmit={remove} className="panel mt-2 max-w-[26rem] space-y-4 p-5">
            <PasswordField id="delete-password" value={password} onChange={setPassword} autoComplete="current-password"
              label="Enter your password to confirm" />
            {error && <p className="notice notice-error" role="alert">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-danger" disabled={deleting || !password}>
                {deleting ? 'Deleting…' : 'Delete everything'}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => { setConfirming(false); setPassword(''); setError(''); }}>
                Keep my account
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
