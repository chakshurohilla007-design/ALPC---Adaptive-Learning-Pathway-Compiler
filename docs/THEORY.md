# Written-answer practice

Open **Written answers** in the signed-in sidebar (`/theory`). The first version
supports Arrays, Stacks, and Binary Search, each with 5- and 10-mark rubrics.

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
separate from quiz Attempt and Mastery. They do not update official mastery,
quiz analytics, review schedules, or compiler pathways. Teacher confirmation
and semantic grading are not implemented; no teacher role exists yet.
Account deletion removes written attempts as well as the other student data.

## API

All routes require the existing Bearer token:

- `GET /api/theory/questions`: supported question IDs, topics, and prompts.
- `POST /api/theory/submit`: `questionId`, numeric `marks` (5 or 10), `answer`
  (20 to 12,000 characters), and `textConfirmed: true`. Scores are computed on
  the server; client-provided scores/user IDs are ignored. Submission is limited
  to 10 requests per minute per client.
- `GET /api/theory/attempts`: the authenticated user's latest 20 submissions.

Run `npm run test:theory` for grading and authenticated route tests.
