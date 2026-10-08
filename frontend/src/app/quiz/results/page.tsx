'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type AdaptiveResult, type AlpcCompileResult } from '@/lib/api';
import { OutcomeCard } from '@/components/alpc/OutcomeCard';
import { PipelineVisualization } from '@/components/alpc/PipelineVisualization';

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AdaptiveResult | null>(null);
  const [decision, setDecision] = useState<(AlpcCompileResult & { source?: string }) | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [studySkill, setStudySkill] = useState<string | null>(null);
  const [mistakesOnly, setMistakesOnly] = useState(false);
  const [reviewTopic, setReviewTopic] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('learnsmart_quiz_result');
    if (!raw) { router.push('/dashboard'); return; }
    const parsed: AdaptiveResult & { topic?: string | null } = JSON.parse(raw);
    setResult(parsed);

    // Compile the student's next step with ALPC from this quiz's numbers.
    // A topic quiz decides for that topic; a mixed quiz for the weakest one.
    const skill = parsed.topic || parsed.recommendations?.[0]?.skill || parsed.results?.[0]?.skill;
    if (skill) {
      setStudySkill(skill);
      setCompiling(true);
      api.generatePathway({
        skill,
        performance: parsed.summary.scorePercent,
        mastery: parsed.masteryMap?.[skill] ?? parsed.recommendations?.[0]?.masteryScore ?? 0.5,
      })
        .then(setDecision)
        .catch(err => setDecisionError(err instanceof Error ? err.message : 'The compiler decision failed.'))
        .finally(() => setCompiling(false));
    }
  }, [router]);

  if (!result) {
    return (
      <div className="mx-auto max-w-[48rem] px-4 py-8 sm:px-6" aria-label="Loading results">
        <div className="skel h-8 w-72" />
        <div className="skel mt-3 h-4 w-96 max-w-full" />
      </div>
    );
  }

  const { summary, results, recommendations, analytics } = result;
  const focus = recommendations[0];
  const topicScores = Array.from(new Set(results.map(r => r.skill))).map(skill => {
    const answers = results.filter(r => r.skill === skill);
    return { skill, total: answers.length, correct: answers.filter(r => r.correct).length };
  }).sort((a, b) => (b.total - b.correct) - (a.total - a.correct) || a.skill.localeCompare(b.skill));
  const reviewedAnswers = results.filter(r => (!mistakesOnly || !r.correct) && (!reviewTopic || r.skill === reviewTopic))
    .sort((a, b) => Number(a.correct) - Number(b.correct));

  return (
    <div className="mx-auto max-w-[48rem] px-4 py-8 sm:px-6">
      <header className="pb-8">
        <p className="text-sm t-graphite">Practice quiz results</p>
        <h1 className="mt-1 text-[2rem]">
          {summary.correct} of {summary.total} correct
        </h1>
        <p className="mt-2 text-[0.9375rem] t-graphite">
          Score {summary.scorePercent}%.
          {analytics && <> Your average mastery is now {analytics.averageMasteryPercent}%.</>}
        </p>
      </header>

      <div className="space-y-12">
        <section aria-labelledby="decision-h" className="panel space-y-4 p-5">
          <div>
            <h2 id="decision-h" className="text-lg">What to do next</h2>
            <p className="mt-1 text-sm t-graphite">
              Your score was written into a Path-Lang program and compiled by ALPC. The outcome it reached is your next step.
            </p>
          </div>
          {compiling && (
            <div className="space-y-2" aria-label="Compiling"><div className="skel h-7 w-40" /><div className="skel h-4 w-64" /></div>
          )}
          {decisionError && <p className="notice notice-error" role="alert">{decisionError}</p>}
          {decision && (
            <>
              <OutcomeCard result={decision} />
              <div className="flex flex-wrap gap-2">
                {studySkill && (
                  <Link href={`/study/${encodeURIComponent(studySkill)}`} className="btn btn-primary btn-sm">Study {studySkill}</Link>
                )}
                <button type="button" className="btn btn-outline btn-sm" aria-expanded={showTrace} onClick={() => setShowTrace(v => !v)}>
                  {showTrace ? 'Hide compiler trace' : 'Show compiler trace'}
                </button>
                {decision.decisionId && (
                  <Link href={`/history/${decision.decisionId}`} className="btn btn-quiet btn-sm">Why this?</Link>
                )}
                <Link href="/compiler" className="btn btn-quiet btn-sm">Open the playground</Link>
              </div>
              {showTrace && (
                <div className="space-y-4">
                  {decision.source && <div className="listing"><pre>{decision.source}</pre></div>}
                  <PipelineVisualization stages={decision.stages} />
                </div>
              )}
            </>
          )}
        </section>

        {focus && (
          <section aria-labelledby="focus-h">
            <h2 id="focus-h" className="text-lg">Focus on {focus.skill}</h2>
            <p className="mt-2">{focus.explanation}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm t-graphite">Mastery</dt>
                <dd className="m-0 font-medium t-num">{focus.masteryPercent}%</dd>
              </div>
              {focus.commonError && (
                <div>
                  <dt className="text-sm t-graphite">Common mistake</dt>
                  <dd className="m-0 text-[0.9375rem]">{focus.commonError}</dd>
                </div>
              )}
              {focus.suggestedAction && (
                <div>
                  <dt className="text-sm t-graphite">Try this</dt>
                  <dd className="m-0 text-[0.9375rem]">{focus.suggestedAction}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <section aria-labelledby="answers-h">
          <h2 className="text-lg">Results by topic</h2>
          <ul className="mt-3 mb-8 divide-y divide-[var(--rule-soft)] border-y border-[var(--rule-soft)]">
            {topicScores.map(t => <li key={t.skill} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="font-medium">{t.skill}</p><p className="text-sm t-graphite">{t.correct} of {t.total} correct · {t.total - t.correct} mistakes</p></div>
              <div className="flex flex-wrap gap-3 text-sm">
                <button className="link" onClick={() => { setReviewTopic(t.skill); setMistakesOnly(true); }}>Review mistakes</button>
                <Link className="link" href={`/study/${encodeURIComponent(t.skill)}`}>Study</Link>
                <Link className="link" href={`/quiz/adaptive?skill=${encodeURIComponent(t.skill)}`}>Practise</Link>
              </div>
            </li>)}
          </ul>
          <h2 id="answers-h" className="text-lg">Your answers</h2>
          <p className="mt-1 text-sm t-graphite">Wrong answers first, each with the right answer and why.</p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={mistakesOnly} onChange={e => setMistakesOnly(e.target.checked)} />Mistakes only</label>
            <label className="flex items-center gap-2">Topic
              <select value={reviewTopic} onChange={e => setReviewTopic(e.target.value)} className="border border-[var(--rule-soft)] bg-transparent p-2">
                <option value="">All topics</option>
                {topicScores.map(t => <option key={t.skill} value={t.skill}>{t.skill}</option>)}
              </select>
            </label>
            <span className="t-graphite" aria-live="polite">{reviewedAnswers.length} answers shown</span>
          </div>
          {reviewedAnswers.length === 0 && <p className="mt-4 t-pass" role="status">{mistakesOnly ? 'No mistakes in this selection.' : 'No answers in this selection.'}</p>}
          <ol className="mt-3 divide-y divide-[var(--rule-soft)] border-y border-[var(--rule-soft)]">
            {reviewedAnswers.map(r => (
              <li key={r.questionId} className="py-4">
                <p className="text-xs t-graphite">
                  {r.skill} · <span className={r.correct ? 't-pass' : 't-mark'}>{r.correct ? 'Correct' : 'Wrong'}</span> · mastery now{' '}
                  <span className="t-num">{Math.round(r.updatedMastery * 100)}%</span>
                </p>
                {r.question && <p className="mt-1 font-medium">{r.question}</p>}
                {!r.correct && r.yourAnswer != null && (
                  <p className="mt-1 text-sm">You chose: <span className="t-mark">{r.yourAnswer}</span></p>
                )}
                {r.correctAnswer && (
                  <p className="mt-0.5 text-sm">{r.correct ? 'Answer' : 'Right answer'}: <span className="font-medium">{r.correctAnswer}</span></p>
                )}
                {r.explanation && <p className="mt-1 text-sm t-graphite">{r.explanation}</p>}
              </li>
            ))}
          </ol>
        </section>

        {recommendations.length > 1 && (
          <section aria-labelledby="more-h">
            <h2 id="more-h" className="text-lg">Other topics to review</h2>
            <ul className="mt-3 divide-y divide-[var(--rule-soft)] border-y border-[var(--rule-soft)]">
              {recommendations.slice(1).map(rec => (
                <li key={rec.skill} className="py-3">
                  <p className="font-medium">{rec.skill} <span className="font-normal t-graphite t-num">{rec.masteryPercent}%</span></p>
                  <p className="mt-1 text-sm">{rec.explanation}</p>
                  {rec.suggestedAction && <p className="mt-1 text-sm t-graphite">Try this: {rec.suggestedAction}</p>}
                  <Link href={`/study/${encodeURIComponent(rec.skill)}`} className="link mt-2 inline-block text-sm">Study {rec.skill}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn btn-primary">Back to the dashboard</Link>
          {studySkill && (
            <Link href={`/quiz/adaptive?skill=${encodeURIComponent(studySkill)}`} className="btn btn-outline">Another {studySkill} quiz</Link>
          )}
          <Link href="/quiz/adaptive" className="btn btn-quiet">Mixed practice quiz</Link>
        </div>
      </div>
    </div>
  );
}
