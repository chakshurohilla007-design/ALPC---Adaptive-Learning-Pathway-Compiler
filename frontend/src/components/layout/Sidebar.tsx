'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearToken, getUser } from '@/lib/api';
import { ThemeButton } from './SiteChrome';

const GROUPS = [
  {
    label: 'Learning',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/study', label: 'Study' },
      { href: '/quiz/adaptive', label: 'Practice quiz' },
      { href: '/theory', label: 'Written answers' },
      { href: '/quiz/diagnostic', label: 'Diagnostic' },
      { href: '/history', label: 'Decision history' },
    ],
  },
  {
    label: 'Compiler',
    items: [
      { href: '/compiler', label: 'Playground' },
      { href: '/pathway-builder', label: 'Pathway builder' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUserState] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const u = getUser();
    setUserState(u ? { name: u.name, email: u.email } : null);
  }, [pathname]);

  function signOut() {
    clearToken();
    router.push('/');
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="border-b border-[var(--rule)] bg-[var(--sheet)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-5 lg:py-5">
        <Link href="/dashboard" className="text-[1.0625rem] font-semibold tracking-tight no-underline">ALPC</Link>
        <div className="flex items-center lg:hidden">
          <ThemeButton />
          <Link href="/account" className="btn btn-quiet btn-sm">Account</Link>
          <button type="button" onClick={signOut} className="btn btn-quiet btn-sm">Sign out</button>
        </div>
      </div>

      <nav aria-label="App" className="flex gap-x-5 overflow-x-auto px-4 pb-3 text-sm lg:block lg:flex-1 lg:space-y-6 lg:overflow-visible lg:px-3 lg:pb-0">
        {GROUPS.map(group => (
          <div key={group.label} className="flex shrink-0 gap-x-4 lg:block">
            <p className="hidden px-2 pb-1 text-xs t-faint lg:block">{group.label}</p>
            <ul className="flex gap-x-4 lg:block lg:space-y-px">
              {group.items.map(item => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`block whitespace-nowrap rounded-[3px] py-1.5 no-underline lg:px-2 ${
                        active ? 'font-semibold lg:bg-[var(--paper)]' : 't-graphite hover:text-[var(--ink)] hover:underline hover:underline-offset-4'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="hidden border-t border-[var(--rule)] px-5 py-4 text-sm lg:block">
        {user && (
          <Link href="/account" className="mb-3 block min-w-0 no-underline hover:underline hover:underline-offset-4">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-xs t-graphite">{user.email}</p>
          </Link>
        )}
        <div className="-ml-2 flex flex-col items-start">
          <ThemeButton />
          <button type="button" onClick={signOut} className="btn btn-quiet btn-sm">Sign out</button>
        </div>
      </div>
    </aside>
  );
}
