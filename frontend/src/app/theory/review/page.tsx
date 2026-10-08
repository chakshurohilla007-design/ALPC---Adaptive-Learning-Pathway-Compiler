'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getToken, type TheoryAttempt } from '@/lib/api';
type ReviewAttempt = TheoryAttempt & { userId: { _id: string; name: string }; prompt: string };

function ReviewAnswer({ attempt, onSaved }: { attempt: ReviewAttempt; onSaved: () => void }) {
  const [score, setScore] = useState(String(attempt.confirmedScore ?? attempt.score));
  const [comment, setComment] = useState(attempt.reviewComment || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.confirmTheoryReview(attempt._id, Number(score), comment); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Review could not be saved.'); }
    finally { setBusy(false); }
  }
  return <li className="border-b border-[var(--rule-soft)] py-6">
    <h2 className="text-lg">{attempt.userId?.name || 'Student'}: {attempt.skill} ({attempt.maxMarks} marks)</h2>
    <p className="mt-1 text-sm t-graphite">Automatic estimate: {attempt.score}/{attempt.maxMarks}. Submitted {new Date(attempt.createdAt).toLocaleString()}.</p>
    <p className="mt-3 font-medium">{attempt.prompt}</p>
    <p className="mt-4 whitespace-pre-wrap">{attempt.answer}</p>
    <details className="mt-4"><summary className="cursor-pointer">Rubric and expected points</summary><ul className="mt-3 space-y-2 text-sm">{attempt.feedback.map(f => <li key={f.label}><strong>{f.label}:</strong> {f.guidance}</li>)}</ul></details>
    <form onSubmit={save} className="mt-4 space-y-3">
      <label className="block text-sm">Confirmed marks<input required type="number" min={0} max={attempt.maxMarks} step={0.5} value={score} disabled={busy || attempt.status === 'confirmed'} onChange={e => setScore(e.target.value)} className="ml-3 w-24 border border-[var(--rule-soft)] bg-transparent p-2" /></label>
      <label className="block text-sm">Feedback<textarea required minLength={5} maxLength={2000} rows={3} value={comment} disabled={busy || attempt.status === 'confirmed'} onChange={e => setComment(e.target.value)} className="mt-2 block w-full border border-[var(--rule-soft)] bg-transparent p-2" /></label>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-sm" disabled={busy || score === '' || comment.trim().length < 5}>{busy ? 'Saving...' : attempt.status === 'confirmed' ? 'Retry mastery update' : 'Confirm marks and update mastery'}</button>
    </form>
  </li>;
}

export default function TheoryReviewPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<ReviewAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    let active = true; setLoading(true); setError('');
    api.getTheoryReviews().then(r => { if (active) setAttempts(r.attempts); })
      .catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router, reload]);
  return <div className="mx-auto max-w-[52rem] px-4 py-8 sm:px-6">
    <Link href="/theory" className="link text-sm">Written answers</Link>
    <div className="mt-3 flex items-center justify-between gap-3"><h1 className="text-[1.75rem]">Teacher review</h1><button className="link" onClick={() => setReload(n => n + 1)}>Refresh</button></div>
    <p className="mt-2 text-sm t-graphite">Read the explanation and award marks for correct understanding, including valid alternative wording. Confirmed marks contribute 30% to the updated mastery estimate; existing mastery contributes 70%.</p>
    {error && <p className="notice notice-error mt-4" role="alert">{error}</p>}
    {loading ? <p className="mt-6" role="status">Loading assigned answers...</p> : !error && attempts.length === 0 ? <p className="mt-6">No answers are waiting for your review.</p> : <ul>{attempts.map(a => <ReviewAnswer key={a._id} attempt={a} onSaved={() => setReload(n => n + 1)} />)}</ul>}
  </div>;
}
