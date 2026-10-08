import type { Metadata } from 'next';
import { DocPage } from '@/components/layout/DocPage';

export const metadata: Metadata = { title: 'Privacy: ALPC' };

export default function PrivacyPage() {
  return (
    <DocPage title="Privacy" updated="8 October 2026">
      <p>
        ALPC is a student project. This page lists everything the app stores about you, where it is kept, and how to
        have it removed. It describes the code in this repository; whoever runs a copy of it is responsible for their
        own deployment.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li><strong>Your account:</strong> name, email address, and a bcrypt hash of your password. The password itself is never stored.</li>
        <li><strong>Quiz answers:</strong> for each question you answer, the option you picked, whether it was correct, the topic, and the time.</li>
        <li><strong>Written answers:</strong> submitted text, topic, estimated marks, rubric feedback, and submission time. Answer images are processed in your browser and are not uploaded or stored by the backend.</li>
        <li><strong>Mastery estimates:</strong> one score between 0 and 1 per topic, updated after each answer.</li>
        <li><strong>Recommendations:</strong> the study suggestions generated for you.</li>
        <li><strong>Compiler decisions:</strong> the Path-Lang program generated for you, the outcome it reached, the alignment score, and the output of each compiler stage.</li>
        <li><strong>Study progress:</strong> which study resources you marked as done, and when.</li>
        <li><strong>Pathways you build:</strong> the name, topic, outcomes and rules you save in the pathway builder.</li>
      </ul>

      <h2>Where it is kept</h2>
      <p>
        Everything above lives in the MongoDB database configured for the backend. Your answers are also sent to the
        project’s own ML service, which computes mastery and returns it; that service keeps nothing. Programs you type
        into the playground or pathway builder simulation are compiled on the backend server and deleted after the
        run. Only the programs generated from your own quiz results, on the dashboard, the results page or a study page, are
        saved as compiler decisions.
      </p>

      <h2>In your browser</h2>
      <p>Image text extraction downloads the open-source OCR worker and English recognition data from external CDNs. Those providers receive the download request, but the answer image is processed locally. Check extracted text before submitting it to our backend.</p>
      <p>
        The app keeps your sign-in token and your name and email in local storage so you stay signed in. The token
        expires after 7 days. It also remembers whether you chose the light or dark theme. Signing out removes the token
        and your details.
      </p>

      <h2>What the app does not do</h2>
      <ul>
        <li>There is no analytics, advertising or tracking code.</li>
        <li>Fonts are served from this site, so no font provider sees your visit.</li>
        <li>
          Study pages link to outside sites such as YouTube, LeetCode and VisuAlgo but do not embed them, so those
          sites see nothing until you open a link. Once you do, their own privacy policies apply.
        </li>
        <li>Your data is not sold or shared with anyone.</li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        Open Account (from the sidebar, or your name at the bottom of it) and choose Delete my account. After you
        confirm with your password, the account and everything listed above is removed from the database straight
        away: answers, mastery, recommendations, compiler decisions, study progress and the pathways you built.
        Nothing is kept.
      </p>
    </DocPage>
  );
}
