'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, getToken, type AlpcContent, type AlpcDecision, type AlpcStage } from '@/lib/api';
import { PipelineVisualization } from '@/components/alpc/PipelineVisualization';
import { TracedProgram } from '@/components/alpc/TracedProgram';

type Decision = AlpcDecision & { stages: AlpcStage[] };

export default function DecisionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ decision: Decision; content: AlpcContent | null } | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    let active = true;
    setError('');
    setData(null);
    api.getAlpcDecision(id).then(result => { if (active) setData(result); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [id, router, reload]);

  if (error) {
    return (
      <div className="mx-auto max-w-[60rem] px-4 py-16 sm:px-6">
        <h1 className="text-[1.75rem]">This decision could not be loaded</h1>
        <p className="mt-2 t-graphite">{error}</p>
        <button onClick={() => setReload(n => n + 1)} className="btn btn-primary mt-6 mr-3">Retry</button>
        <Link href="/history" className="btn btn-outline mt-6">Back to decision history</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-[60rem] space-y-4 px-4 py-8 sm:px-6" aria-label="Loading decision">
        <div className="skel h-8 w-80 max-w-full" />
        <div className="skel h-4 w-64" />
        <div className="skel h-48 w-full" />
      </div>
    );
  }

  const { decision: d, content } = data;
  const mastery = Math.round(d.mastery <= 1 ? d.mastery * 100 : d.mastery);
  const run = d.stages.find(s => s.id === 'run');

  return (
    <div className="mx-auto max-w-[60rem] px-4 py-8 sm:px-6">
      <p className="text-sm"><Link href="/history" className="link">Decision history</Link></p>
      <header className="pb-8 pt-3">
        <h1 className="text-[1.75rem]">
          Why {d.skill} led to {d.outcome ? <span className="ident">{d.outcome}</span> : 'no outcome'}
        </h1>
        <p className="mt-1 text-[0.9375rem] t-graphite">
          Decided {new Date(d.createdAt).toLocaleString()}. Each step below is what the compiler produced at the time.
        </p>
      </header>

      <ol className="space-y-12">
        <li>
          <h2 className="text-lg">1. Your numbers</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div><dt className="text-sm t-graphite">Topic</dt><dd className="m-0 font-medium">{d.skill}</dd></div>
            <div><dt className="text-sm t-graphite">Performance</dt><dd className="m-0 font-medium t-num">{Math.round(d.performance)}</dd></div>
            <div><dt className="text-sm t-graphite">Mastery</dt><dd className="m-0 font-medium t-num">{mastery}</dd></div>
          </dl>
        </li>

        <li>
          <h2 className="text-lg">2. The program written from them</h2>
          <p className="mt-1 text-sm t-graphite">Your numbers became the SET lines. Rules run from top to bottom and the first one that holds wins.</p>
          <div className="mt-3"><TracedProgram source={d.pathLangSource} outcome={d.outcome} /></div>
        </li>

        <li>
          <h2 className="text-lg">3. How the compiler handled it</h2>
          <div className="mt-3"><PipelineVisualization stages={d.stages} /></div>
        </li>

        <li>
          <h2 className="text-lg">4. What the program printed</h2>
          {run?.stdout ? (
            <div className="listing mt-3"><pre>{run.stdout.trim()}</pre></div>
          ) : (
            <p className="mt-2 text-sm t-graphite">The program did not run.</p>
          )}
          <p className="mt-2 text-sm t-graphite">
            The first line is the alignment score{d.binaryOutput ? ' in binary' : ''}; the second is the outcome the program reached.
          </p>
        </li>

        <li>
          <h2 className="text-lg">5. The recommendation</h2>
          {content && content.steps.length > 0 ? (
            <>
              <p className="mt-2">{content.description}</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5">
                {content.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </>
          ) : (
            <p className="mt-2 t-graphite">No recommendation is attached to this outcome.</p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/study/${encodeURIComponent(d.skill)}`} className="btn btn-primary">Study {d.skill}</Link>
            <Link href={`/quiz/adaptive?skill=${encodeURIComponent(d.skill)}`} className="btn btn-outline">Practise {d.skill}</Link>
            <Link href="/compiler" className="btn btn-outline">Try the program in the playground</Link>
          </div>
        </li>
      </ol>
    </div>
  );
}
