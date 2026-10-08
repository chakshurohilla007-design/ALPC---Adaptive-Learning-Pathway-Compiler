# Written-answer practice

Open **Written answers** in the signed-in sidebar (`/theory`). The first version
supports all nine study topics, each with 5- and 10-mark rubrics.

Students can type an answer or select a PNG/JPEG/WebP photo under 8 MB and
20 megapixels. Tesseract.js extracts English text inside the browser; only the
student-confirmed text is submitted. OCR downloads its worker and recognition
data from CDNs, so the first extraction needs internet access. Handwriting can
be poorly recognized. Diagrams are not evaluated. Students must edit the
detected text before confirming it.

## Assessment limits

This is a rubric-term detector, not a semantic or teacher-grade evaluator.
Each rubric criterion earns at most one estimated point when a supported term
appears. Obvious negated sentences are excluded, but this does not reliably
detect incorrect explanations, contradictions, copied answers, or alternative
correct wording. Feedback shows the expected concepts and a model answer.

Estimated practice marks and the submitted text are saved in TheoryAttempt,
separate from quiz Attempt and Mastery. Estimates do not update mastery.
Students may select an available teacher before submitting. That teacher can
read the confirmed answer text at `/theory/review`, enter marks in half-point
increments, and provide feedback. Only the assigned teacher may confirm marks;
teachers cannot review their own answers. A review cannot be revised after
confirmation in this release.

Confirmed marks update mastery using `0.7 * currentMastery + 0.3 * (marks / total)`.
This is a transparent partial-credit heuristic, not the ML service's binary BKT
update. The mark and review are saved before applying mastery. The mastery
document atomically records the attempt ID with the score update, preventing
repeated requests from counting the same assessment twice. If saving fails,
the teacher retries the same marks and feedback. Review reminders include
confirmed written assessments. The dashboard reads updated mastery; opening
the study page recompiles a pathway when that mastery is newer than its decision.

Semantic AI grading and reliable handwriting/diagram recognition are not
implemented. Human confirmation is required for marks that affect mastery.
Account deletion removes written attempts as well as the other student data.

## Enable teachers

1. Have the teacher register an ordinary account.
2. Set `THEORY_REVIEWER_EMAILS=teacher@example.com` in `backend/.env`, or the
   API service's environment settings on Render. Multiple emails may be
   comma-separated. These addresses are visible to signed-in students.
3. Restart/redeploy the API. A teacher sees **Teacher review queue** on Written
   answers. Students can select that teacher when submitting.
4. Use a different student account to submit an answer, confirm it as the teacher,
   then refresh reviews as the student and open the updated study pathway.

The server checks the live account email against this allowlist for every review
request. A token or registration payload cannot grant teacher access. Without
configuration, everyone can still use practice estimates, but nobody can confirm
marks. Images remain local; the teacher sees the student-confirmed text only.

## API

All routes require the existing Bearer token:

- `GET /api/theory/questions`: supported question IDs, topics, and prompts.
- `POST /api/theory/submit`: `questionId`, numeric `marks` (5 or 10), `answer`
  (20 to 12,000 characters), and `textConfirmed: true`. Scores are computed on
  the server; client-provided scores/user IDs are ignored. Submission is limited
  to 10 requests per minute per client.
  Optional `reviewerEmail` requests review by a configured teacher.
- `GET /api/theory/attempts`: the authenticated user's latest 20 submissions.
- `GET /api/theory/reviewers`: configured registered teachers and caller review access.
- `GET /api/theory/reviews`: only the teacher's assigned pending or unfinished reviews.
- `POST /api/theory/reviews/:id/confirm`: numeric `score` and text `comment`.

Run `npm run test:theory` for grading and authenticated route tests.
Set `THEORY_TEST_MONGODB_URI` to a disposable MongoDB database to also exercise
atomic mastery updates against MongoDB. CI supplies an isolated database.
