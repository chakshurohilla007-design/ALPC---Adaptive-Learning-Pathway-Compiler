'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, getToken, type StudyLevel, type StudyPage, type StudyResource } from '@/lib/api';

const LEVEL_HEADING: Record<StudyLevel, string> = {
  intro: 'Start here',
  practice: 'Practise the basics',
  core: 'Core material',
  advanced: 'Going further',
};

const TYPE_TEXT: Record<StudyResource['type'], string> = {
  video: 'Video',
  article: 'Article',
  visualization: 'Visualisation',
  problems: 'Problem set',
};

const LEVEL_SENTENCE: Record<string, string> = {
  remedial: 'so this page starts with introductions',
  practice: 'so this page mixes introductions with practice',
  core: 'so this page skips the introductions and goes to the core material',
  advanced: 'so this page goes straight to the harder material',
};

function groupByLevel(list: StudyResource[]) {
  const groups: { level: StudyLevel; items: StudyResource[] }[] = [];
  for (const r of list) {
    const g = groups.find(x => x.level === r.level);
    if (g) g.items.push(r); else groups.push({ level: r.level, items: [r] });
  }
  return groups;
}

function ResourceRow({ r, busy, onToggle }: { r: StudyResource; busy: boolean; onToggle: (r: StudyResource) => void }) {
  const done = Boolean(r.doneAt);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 py-4">
      <div className="min-w-0">
        <p className="text-xs t-graphite">{TYPE_TEXT[r.type]} · {r.source}</p>
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`link mt-0.5 inline-block text-[1rem] font-medium ${done ? 't-graphite' : ''}`}
        >
          {r.title}<span className="sr-only"> (opens in a new tab)</span>
        </a>
        {r.note && <p className="mt-1 text-sm t-graphite">{r.note}</p>}
      </div>
      <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap pt-5 text-sm">
        <input
          type="checkbox"
          checked={done}
          disabled={busy}
          onChange={() => onToggle(r)}
          className="h-4 w-4 accent-[var(--ink)]"
        />
        <span className={done ? 't-pass' : 't-graphite'}>{done ? 'Done' : 'Mark as done'}</span>
      </label>
    </li>
  );
}

function ResourceGroups({ list, busy, onToggle }: {
  list: StudyResource[]; busy: Set<string>; onToggle: (r: StudyResource) => void;
}) {
  return (
    <div className="space-y-8">
      {groupByLevel(list).map(g => (
        <div key={g.level}>
          <h3 className="text-[0.9375rem] font-semibold">{LEVEL_HEADING[g.level]}</h3>
          <ul className="mt-1 divide-y divide-[var(--rule-soft)] border-y border-[var(--rule-soft)]">
            {g.items.map(r => <ResourceRow key={r.id} r={r} busy={busy.has(r.id)} onToggle={onToggle} />)}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function StudyTopicPage() {
  const router = useRouter();
  const skill = decodeURIComponent(useParams<{ skill: string }>().skill);
  const [page, setPage] = useState<StudyPage | null>(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    let active = true;
    setPage(null);
    setError('');
    setSaveError('');
    api.getStudy(skill)
      .then(result => { if (active) setPage(result); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [skill, router, reload]);

  const setDone = useCallback((id: string, doneAt: string | null) => {
    setPage(p => p && ({
      ...p,
      chosen: p.chosen.map(r => (r.id === id ? { ...r, doneAt } : r)),
      others: p.others.map(r => (r.id === id ? { ...r, doneAt } : r)),
    }));
  }, []);

  const toggle = useCallback(async (r: StudyResource) => {
    const wasDone = r.doneAt;
    setSaveError('');
    setBusy(b => new Set(b).add(r.id));
    setDone(r.id, wasDone ? null : new Date().toISOString());
    try {
      const res = await api.setStudyDone(skill, r.id, !wasDone);
      setDone(r.id, res.doneAt);
    } catch (err) {
      setDone(r.id, wasDone);
      setSaveError(err instanceof Error ? err.message : 'Your progress could not be saved.');
    } finally {
      setBusy(b => { const n = new Set(b); n.delete(r.id); return n; });
    }
  }, [skill, setDone]);

  if (error) {
    return (
      <div className="mx-auto max-w-[52rem] px-4 py-16 sm:px-6">
        <h1 className="text-[1.75rem]">This study page could not be loaded</h1>
        <p className="mt-2 t-graphite">{error}</p>
        <button onClick={() => setReload(n => n + 1)} className="btn btn-primary mt-6 mr-3">Retry</button>
        <Link href="/study" className="btn btn-outline mt-6">All topics</Link>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="mx-auto max-w-[52rem] space-y-4 px-4 py-8 sm:px-6" aria-label="Compiling your pathway">
        <div className="skel h-8 w-72" />
        <div className="skel h-4 w-full max-w-[32rem]" />
        <div className="mt-8 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skel h-12 w-full" />)}
        </div>
      </div>
    );
  }

  const { decision } = page;
  const chosenDone = page.chosen.filter(r => r.doneAt).length;
  const decidedOn = new Date(decision.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

  return (
    <div className="mx-auto max-w-[52rem] px-4 py-8 sm:px-6">
      <p className="text-sm"><Link href="/study" className="link">Study</Link></p>
      <header className="pb-8 pt-3">
        <h1 className="text-[1.75rem]">{page.skill}</h1>
        <p className="mt-2 prose-measure text-[0.9375rem]">
          {page.masteryPercent != null ? <>Your mastery is <span className="t-num">{page.masteryPercent}%</span>. </> : null}
          {decision.outcome ? (
            <>
              Your pathway program reached <span className="ident">{decision.outcome}</span>
              {LEVEL_SENTENCE[decision.outcome] ? <>, {LEVEL_SENTENCE[decision.outcome]}.</> : '.'}
            </>
          ) : !decision.error ? (
            <>Your pathway program reached no outcome, so everything for this topic is listed.</>
          ) : null}
        </p>
        <p className="mt-1 text-sm t-graphite">
          {decision.reused
            ? `Decided ${decidedOn}. It is compiled again when your mastery changes.`
            : 'Compiled just now from your current mastery.'}
          {decision.decisionId && <> <Link href={`/history/${decision.decisionId}`} className="link">Why this?</Link></>}
        </p>
      </header>

      {decision.error && (
        <p className="notice notice-error mb-8" role="alert">
          The pathway could not be compiled, so nothing is chosen for you and everything is listed below. {decision.error}
        </p>
      )}
      {saveError && <p className="notice notice-error mb-6" role="alert">{saveError}</p>}

      <div className="space-y-12">
        {page.chosen.length > 0 && (
          <section aria-labelledby="chosen-h">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="chosen-h" className="text-lg">Chosen for you</h2>
              <p className="text-sm t-graphite t-num" aria-live="polite">{chosenDone} of {page.chosen.length} done</p>
            </div>
            <progress className="mt-3 h-2 w-full accent-[var(--ink)]" value={chosenDone} max={page.chosen.length} aria-label="Recommended resources completed" />
            {chosenDone === page.chosen.length && <p className="mt-2 text-sm t-pass" role="status">Recommended resources complete. Take the topic quiz to update your learning path.</p>}
            <div className="mt-4"><ResourceGroups list={page.chosen} busy={busy} onToggle={toggle} /></div>
          </section>
        )}

        <section aria-labelledby="test-h" className="panel p-5">
          <h2 id="test-h" className="text-lg">Test yourself</h2>
          <p className="mt-2 text-[0.9375rem]">
            When you have worked through these, take a five-question quiz on {page.skill}. Your answers update your
            mastery, and the next time you open this page a new pathway is compiled from it.
          </p>
          <Link href={`/quiz/adaptive?skill=${encodeURIComponent(page.skill)}`} className="btn btn-primary btn-sm mt-4">
            Quiz me on {page.skill}
          </Link>
        </section>

        {page.others.length > 0 && (
          page.chosen.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-[0.9375rem] font-medium">
                Everything else on {page.skill} <span className="font-normal t-graphite t-num">({page.others.length})</span>
              </summary>
              <div className="mt-6"><ResourceGroups list={page.others} busy={busy} onToggle={toggle} /></div>
            </details>
          ) : (
            <section aria-labelledby="all-h">
              <h2 id="all-h" className="text-lg">Everything on {page.skill}</h2>
              <div className="mt-4"><ResourceGroups list={page.others} busy={busy} onToggle={toggle} /></div>
            </section>
          )
        )}
      </div>
    </div>
  );
}
