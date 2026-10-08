'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api, getToken, type TheoryQuestion, type TheoryResult, type TheoryAttempt } from '@/lib/api';
import type { Worker } from 'tesseract.js';

export default function TheoryPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<TheoryQuestion[]>([]);
  const [questionId, setQuestionId] = useState('');
  const [marks, setMarks] = useState(5);
  const [answer, setAnswer] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [reviewerError, setReviewerError] = useState('');
  const [result, setResult] = useState<TheoryResult | null>(null);
  const [attempts, setAttempts] = useState<TheoryAttempt[]>([]);
  const [reload, setReload] = useState(0);
  const [reviewers, setReviewers] = useState<{ name: string; email: string }[]>([]);
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [canReview, setCanReview] = useState(false);
  const worker = useRef<Worker | null>(null);
  const mounted = useRef(false);
  const question = questions.find(q => q.id === questionId);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void worker.current?.terminate(); worker.current = null; };
  }, []);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    let active = true;
    setLoading(true);
    setError('');
    api.getTheoryQuestions().then(r => {
      if (active) { setQuestions(r.questions); setQuestionId(current => current || r.questions[0]?.id || ''); }
    }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    api.getTheoryAttempts().then(r => { if (active) { setAttempts(r.attempts); setHistoryError(''); } })
      .catch(() => { if (active) setHistoryError('Previous answers could not be loaded.'); });
    api.getTheoryReviewers().then(r => { if (active) { setReviewers(r.reviewers); setCanReview(r.canReview); setReviewerError(''); } })
      .catch(() => { if (active) setReviewerError('Teacher availability could not be loaded. Refresh reviews to retry.'); });
    return () => { active = false; };
  }, [router, reload]);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function changeQuestion(id: string) {
    setQuestionId(id); setAnswer(''); setConfirmed(false); setResult(null); setFile(null); setError(''); setOcrProgress('');
  }

  async function extract() {
    if (!file || ocrBusy) return;
    setOcrBusy(true); setError(''); setOcrProgress('Loading text recognition...');
    try {
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 20000000) throw new Error('This image is too large. Resize it to under 20 megapixels.');
      const { createWorker } = await import('tesseract.js');
      const w = await createWorker('eng', 1, { logger: m => {
        if (mounted.current) setOcrProgress(`${m.status}${m.progress != null ? ` ${Math.round(m.progress * 100)}%` : ''}`);
      } });
      if (!mounted.current) { await w.terminate(); return; }
      worker.current = w;
      const { data } = await w.recognize(file);
      if (mounted.current) {
        setAnswer(data.text.slice(0, 12000)); setConfirmed(false); setResult(null);
        setOcrProgress(`Text extracted. Recognition confidence: ${Math.round(data.confidence)}%. Check every line before submitting.`);
        if (!data.text.trim()) setError('No text was detected. Try a clearer photo or type your answer.');
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Text extraction failed. You can type your answer instead.');
    } finally {
      await worker.current?.terminate(); worker.current = null;
      if (mounted.current) setOcrBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || ocrBusy || !confirmed || !question) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const r = await api.submitTheory({ questionId, marks, answer, textConfirmed: confirmed, reviewerEmail });
      if (!mounted.current) return;
      setResult(r);
      setAttempts(prev => [{ _id: r.attemptId, questionId, skill: r.skill, answer, score: r.score, maxMarks: r.maxMarks, status: r.status, feedback: r.feedback, createdAt: new Date().toISOString() }, ...prev].slice(0, 20));
    } catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Your answer could not be saved.'); }
    finally { if (mounted.current) setBusy(false); }
  }

  return <div className="mx-auto max-w-[52rem] px-4 py-8 sm:px-6">
    <header className="pb-6"><h1 className="text-[1.75rem]">Written answers</h1><p className="mt-2 text-sm t-graphite">5- and 10-mark theory practice. Type an answer or extract text from a photo.</p>{canReview && <Link href="/theory/review" className="link mt-3 inline-block">Teacher review queue</Link>}</header>
    {error && <p className="notice notice-error mb-4" role="alert">{error}</p>}
    {loading ? <p role="status">Loading questions...</p> : questions.length === 0 ? <button className="btn btn-outline" onClick={() => setReload(n => n + 1)}>Reload questions</button> : <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <label className="text-sm">Topic<select className="mt-1 block border border-[var(--rule-soft)] bg-transparent p-2" disabled={busy || ocrBusy} value={questionId} onChange={e => changeQuestion(e.target.value)}>{questions.map(q => <option value={q.id} key={q.id}>{q.skill}</option>)}</select></label>
        <label className="text-sm">Marks<select className="mt-1 block border border-[var(--rule-soft)] bg-transparent p-2" disabled={busy || ocrBusy} value={marks} onChange={e => { setMarks(Number(e.target.value)); setResult(null); setConfirmed(false); }}><option value={5}>5 marks</option><option value={10}>10 marks</option></select></label>
      </div>
      <section><h2 className="text-lg">Question</h2><p className="mt-2">{question?.prompt}</p><p className="mt-2 text-sm t-graphite">{marks === 5 ? 'Cover the main concepts clearly.' : 'Include complexity, trade-offs, and a worked example where relevant.'}</p></section>
      <section className="border-y border-[var(--rule-soft)] py-5">
        <label className="block text-sm font-medium" htmlFor="answer-image">Answer photo or screenshot</label>
        <input id="answer-image" className="mt-2 block max-w-full text-sm" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || ocrBusy} onChange={e => {
          const image = e.target.files?.[0];
          if (!image) return;
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.type) || image.size > 8 * 1024 * 1024) { setError('Choose a PNG, JPEG or WebP image under 8 MB.'); e.target.value = ''; return; }
          setFile(image); setError(''); setOcrProgress(''); setConfirmed(false);
        }} />
        {preview && <Image src={preview} alt="Your answer image" width={800} height={600} unoptimized className="mt-3 max-h-80 w-auto max-w-full object-contain" />}
        <button type="button" className="btn btn-outline btn-sm mt-3" disabled={!file || busy || ocrBusy} onClick={extract}>{ocrBusy ? 'Extracting text...' : 'Extract text'}</button>
        <p className="mt-2 text-sm t-graphite">The image stays in your browser. Handwriting may be misread; diagrams are not graded. Extraction replaces the answer text below.</p>
        {ocrProgress && <p className="mt-2 text-sm" role="status">{ocrProgress}</p>}
      </section>
      <div><label htmlFor="theory-answer" className="font-medium">Your answer</label><textarea id="theory-answer" rows={12} minLength={20} maxLength={12000} required disabled={busy || ocrBusy} value={answer} onChange={e => { setAnswer(e.target.value); setConfirmed(false); setResult(null); }} className="mt-2 block w-full resize-y border border-[var(--rule-soft)] bg-transparent p-3" /><p className="mt-1 text-sm t-graphite">{answer.length} / 12,000 characters</p></div>
      <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={confirmed} disabled={busy || ocrBusy} onChange={e => setConfirmed(e.target.checked)} />I checked that this text matches my intended answer.</label>
      <label className="block text-sm">Teacher review<select value={reviewerEmail} disabled={busy || ocrBusy} onChange={e => setReviewerEmail(e.target.value)} className="mt-2 block max-w-full border border-[var(--rule-soft)] bg-transparent p-2"><option value="">Practice estimate only</option>{reviewers.map(r => <option key={r.email} value={r.email}>{r.name} ({r.email})</option>)}</select></label>
      {reviewerError && <p className="text-sm" role="alert">{reviewerError}</p>}
      <p className="text-sm t-graphite">Automatic marks are estimates. {reviewerEmail ? 'Submitting shares your answer text with the selected teacher. Only teacher-confirmed marks update mastery.' : 'Choose a teacher for confirmed marks, or keep this as practice. Estimates do not change mastery.'}</p>
      <button type="submit" className="btn btn-primary" disabled={busy || ocrBusy || !confirmed || answer.trim().length < 20}>{busy ? 'Saving assessment...' : 'Assess answer'}</button>
    </form>}
    {result && <section className="mt-10 border-t border-[var(--rule-soft)] pt-6" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading" className="text-xl">Estimated marks: {result.score} / {result.maxMarks}</h2>
      <p className="mt-2 text-sm t-graphite">{result.status === 'pending' ? 'Sent to your teacher for review. ' : 'Saved as a practice estimate. '}Detected terms are not proof that an explanation is correct.</p>
      <ul className="mt-4 divide-y divide-[var(--rule-soft)]">{result.feedback.map(f => <li key={f.label} className="py-3"><p className="font-medium">{f.label} <span className="t-num">{f.marks}/{f.maxMarks}</span></p><p className="text-sm t-graphite">{f.detected ? 'Rubric term detected.' : 'Rubric term not detected; check whether you explained this differently.'} {f.guidance}</p></li>)}</ul>
      <details className="mt-4"><summary className="cursor-pointer font-medium">Model answer</summary><p className="mt-3">{result.modelAnswer}</p></details>
      <Link className="btn btn-outline btn-sm mt-5" href={`/study/${encodeURIComponent(result.skill)}`}>Study {result.skill}</Link>
    </section>}
    <section className="mt-10 border-t border-[var(--rule-soft)] pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg">Previous written answers</h2><button className="link text-sm" disabled={busy || ocrBusy} onClick={() => setReload(n => n + 1)}>Refresh reviews</button></div>
      {historyError && <p className="mt-2 text-sm" role="alert">{historyError} <button className="link" onClick={() => setReload(n => n + 1)}>Retry</button></p>}
      {!loading && !historyError && attempts.length === 0 && <p className="mt-2 text-sm t-graphite">Your submitted answers will appear here.</p>}
      <ul className="mt-3 divide-y divide-[var(--rule-soft)]">{attempts.map(a => <li key={a._id} className="py-3"><details><summary className="cursor-pointer">{a.skill}: {a.status === 'confirmed' ? a.confirmedScore : a.score}/{a.maxMarks} {a.status === 'confirmed' ? 'teacher confirmed' : a.status === 'pending' ? 'estimated, awaiting review' : 'estimated'} · {new Date(a.createdAt).toLocaleString()}</summary>{a.reviewComment && <p className="mt-3 text-sm">Teacher feedback: {a.reviewComment}</p>}{a.status === 'confirmed' && <p className="mt-2 text-sm">{a.masteryApplied ? 'Mastery updated. ' : 'Mastery update awaiting completion. '}<Link className="link" href={`/study/${encodeURIComponent(a.skill)}`}>Open updated learning path</Link></p>}<p className="mt-3 whitespace-pre-wrap text-sm">{a.answer}</p><ul className="mt-3 space-y-2 text-sm">{a.feedback.map(f => <li key={f.label}>{f.label}: {f.marks}/{f.maxMarks}. {f.guidance}</li>)}</ul></details></li>)}</ul>
    </section>
  </div>;
}
