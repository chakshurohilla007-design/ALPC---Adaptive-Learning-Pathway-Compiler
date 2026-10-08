'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getToken, type StudyTopic } from '@/lib/api';

function level(p: number) {
  return p >= 70 ? 'strong' : p >= 40 ? 'moderate' : 'weak';
}

export default function StudyIndexPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<StudyTopic[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [unfinishedOnly, setUnfinishedOnly] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    let active = true;
    setError('');
    api.getStudyTopics()
      .then(r => { if (active) setTopics([...r.topics].sort((a, b) => (a.masteryPercent ?? 101) - (b.masteryPercent ?? 101))); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [router, reload]);

  const visible = (topics || []).filter(t => t.skill.toLowerCase().includes(search.trim().toLowerCase()) && (!unfinishedOnly || t.done < t.resources));
  const next = topics?.find(t => t.done < t.resources);
  const completed = (topics || []).reduce((sum, t) => sum + t.done, 0);
  const total = (topics || []).reduce((sum, t) => sum + t.resources, 0);

  return (
    <div className="mx-auto max-w-[60rem] px-4 py-8 sm:px-6">
      <header className="pb-8">
        <h1 className="text-[1.75rem]">Study</h1>
        <p className="mt-1 prose-measure text-[0.9375rem] t-graphite">
          Videos, articles, visualisations and problem sets for each topic. What a page shows first is decided by your
          pathway program: a low score starts you on introductions, a high one on harder material. Lowest mastery first.
        </p>
      </header>

      {error && <div className="notice notice-error" role="alert">{error} <button className="link" onClick={() => setReload(n => n + 1)}>Retry</button></div>}

      {!topics && !error && (
        <div className="space-y-3" aria-label="Loading topics">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="skel h-5 w-full" />)}
        </div>
      )}

      {topics && (
        <>
        <section className="mb-8 border-y border-[var(--rule-soft)] py-5" aria-label="Learning progress">
          <p className="text-sm t-graphite">{completed} of {total} resources completed</p>
          {total > 0 && <progress className="mt-2 h-2 w-full accent-[var(--ink)]" value={completed} max={total} aria-label="Overall study progress" />}
          {next ? <div className="mt-4">
            <h2 className="text-lg">Continue with {next.skill}</h2>
            <p className="mt-1 text-sm t-graphite">{next.masteryPercent == null ? 'Mastery has not been measured yet.' : `Mastery: ${next.masteryPercent}%. This is your lowest-mastery topic with unfinished resources.`}</p>
            <Link className="btn btn-primary btn-sm mt-3" href={`/study/${encodeURIComponent(next.skill)}`}>Continue studying</Link>
          </div> : total > 0 ? <p className="mt-4">All resources complete. <Link className="link" href="/quiz/adaptive">Take a practice quiz</Link></p> : null}
        </section>
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">Find a topic
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 border border-[var(--rule-soft)] bg-transparent p-2" />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unfinishedOnly} onChange={e => setUnfinishedOnly(e.target.checked)} />Unfinished only</label>
        </div>
        {visible.length === 0 && <p className="py-4 t-graphite" role="status">{topics.length ? 'No topics match these filters.' : 'No study topics are available yet.'}</p>}
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Topic</th><th className="w-[30%]">Mastery</th><th className="w-12 text-right">%</th>
                <th>Last outcome</th><th className="text-right">Done</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(t => (
                <tr key={t.skill}>
                  <td><Link href={`/study/${encodeURIComponent(t.skill)}`} className="link font-medium">{t.skill}</Link></td>
                  <td>
                    {t.masteryPercent == null ? <span className="text-sm t-faint">not measured</span> : (
                      <div className={`meter meter-${level(t.masteryPercent)}`} role="img" aria-label={`${t.masteryPercent} percent`}>
                        <span style={{ width: `${t.masteryPercent}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="text-right t-num">{t.masteryPercent ?? ''}</td>
                  <td>{t.outcome ? <span className="ident">{t.outcome}</span> : <span className="t-faint">none yet</span>}</td>
                  <td className="whitespace-nowrap text-right t-num">{t.done} of {t.resources}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
