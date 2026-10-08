# ALPC: Adaptive Learning Pathway Compiler

[![CI](https://github.com/chakshurohilla007-design/ALPC---Adaptive-Learning-Pathway-Compiler/actions/workflows/ci.yml/badge.svg)](https://github.com/chakshurohilla007-design/ALPC---Adaptive-Learning-Pathway-Compiler/actions/workflows/ci.yml)

A learning app where the decision about what a student studies next is made by a
compiled program. Teachers write adaptive rules in **Path-Lang**, a small language
built for this project. ALPC lexes it with Flex, parses it with Bison, checks it,
generates LLVM IR and runs it with `lli`. The program prints the student's score
and the outcome it reached, and the app follows that outcome. Every decision is
stored, so a student can open any recommendation and see the program, the rule
that was taken and each compiler stage.

```
OUTCOME remedial;
OUTCOME practice;
OUTCOME core;

SET performance = 62;
SET mastery = 35;
SET state = 62;

IF performance < 50 OR mastery < 25 GOTO remedial;
IF (performance < 70 OR mastery < 40) AND performance >= 50 GOTO practice;
IF performance >= 50 GOTO core;
```

Running this prints `62` and then `outcome practice`.

## What is in the app

| Page | What it does |
|---|---|
| Playground (`/compiler`) | Edit Path-Lang with errors underlined as you type. Compile and run it, then inspect tokens, the parse trace, the AST, the LLVM IR, the control-flow graph (with the path that ran) and the IR after `opt -O2`. |
| Pathway builder (`/pathway-builder`) | Build rules with a form, including a second condition joined by AND or OR, test them on a sample student and save them. |
| Dashboard (`/dashboard`) | Mastery per topic (Bayesian Knowledge Tracing), accuracy by week, topics due for review and the latest compiler decision. |
| Study (`/study`) | One page per topic with videos, articles, visualisations and problem sets. The compiled outcome decides which level you see first. Mark resources as done. |
| Quizzes (`/quiz/...`) | A 15-question diagnostic, a mixed practice quiz on your weakest topics, and a 5-question quiz on one topic. Options are shuffled every time; results show the right answer and why. |
| Decision history (`/history`) | Every decision made for you. Each one opens to the program, the rule taken, every stage and the printed output. |
| Account (`/account`) | Delete your account and everything stored for it. |

## How a decision is made

1. Your quiz answers update your mastery per topic (ML service, BKT and IRT).
2. The backend writes a Path-Lang program: your numbers become `SET` lines and the
   pathway's rules become `IF … GOTO` lines.
3. `alpc --json` compiles it, and `lli` runs the generated IR.
4. The program prints two lines: the alignment score and `outcome <name>`. That line
   is the decision. Nothing re-evaluates the rules in JavaScript.
5. The program, every stage's output and the outcome are saved as a compiler decision.

The language and the compiler's guarantees are specified in [SPEC.md](SPEC.md).

## Repository layout

```
src/            the compiler: scanner.l (Flex), parser.y (Bison), ast, semantics, codegen, main
tests/          compiler fixtures (golden tokens, trace, AST, IR checks, run output) and AST unit tests
examples/       pathway.edu and its expected output
backend/        Express API: runs alpc, lli and opt; MongoDB models; study resources
  src/data/resources.json   study links per topic and level (edit freely)
frontend/       Next.js 15 app
ml-service/     FastAPI service for mastery (BKT) and question difficulty (IRT)
docs/           architecture, API, demo script, decision records
```

## Deploy online

Written-answer practice is available at `/theory`: 5- and 10-mark questions,
typed answers or browser OCR, editable extracted text, estimated rubric marks,
model answers, and saved attempts. See [docs/THEORY.md](docs/THEORY.md) for the
supported topics and grading limits. Estimated theory marks are kept separate
from quiz mastery.

Follow [docs/DEPLOY.md](docs/DEPLOY.md) for MongoDB Atlas, the two Render services,
and the Vercel frontend. The root Dockerfile includes the compiler and LLVM; do
not deploy the legacy backend-only Dockerfile.

## Setting up on Windows

1. **Compiler toolchain.** Install [MSYS2](https://www.msys2.org), then in the
   *MSYS2 MINGW64* terminal:
   ```bash
   pacman -S --needed make flex bison diffutils mingw-w64-x86_64-gcc mingw-w64-x86_64-llvm
   ```
2. **Build the compiler** from the repo root, in that terminal:
   ```bash
   make
   make check        # every fixture should pass
   ```
   `npm run build:compiler` (build.bat) does the same from PowerShell. The binary
   is not kept in git; CI builds one for Windows on every push (Actions → the run →
   `alpc-windows`).
3. **MongoDB.** Install it (`winget install MongoDB.Server`) or use Atlas.
4. **Backend config.** Copy `backend/.env.example` to `backend/.env` and fill it in.
5. **Dependencies.**
   ```powershell
   npm install --prefix backend
   npm install --prefix frontend
   npm run setup:ml
   ```
6. **Run** each in its own terminal from the repo root:
   ```powershell
   npm run dev:backend      # http://localhost:5000
   npm run dev:ml           # http://localhost:8000
   npm run dev:frontend     # http://localhost:3000
   ```

## Configuration (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/learnsmart` | Database |
| `JWT_SECRET` | development key | Signs login tokens. With `NODE_ENV=production` the server will not start unless this is a private value of at least 32 characters. |
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` | Mastery service |
| `FRONTEND_URL` | `http://localhost:3000` in development | Exact CORS origin, required in production; no trailing slash |
| `TRUST_PROXY_HOPS` | `0` | Set to `1` for the single Render proxy; keep `0` for direct local access |
| `ML_SERVICE_HOST` | unset | Render public ML hostname; used with HTTPS when `ML_SERVICE_URL` is unset |
| `ML_TIMEOUT_MS` | `5000` | ML request timeout; the Blueprint sets `120000` for cold starts |
| `ALPC_BIN` | `alpc.exe` / `alpc` in the repo root | Compiler |
| `LLI_BIN`, `OPT_BIN` | `lli`, `opt` on PATH | LLVM interpreter and optimizer |
| `COMPILE_PER_MINUTE`, `CHECK_PER_MINUTE` | `30`, `150` | Per-client limits on the public compile and live-check routes |

## Tests

| Command | Covers |
|---|---|
| `make check` | Every compiler fixture: tokens, parse trace, AST, IR verified with `opt`, and `lli` output |
| `make test-asan` | The same fixtures and AST unit tests under ASan/UBSan on Linux; UBSan trap mode on Windows |
| `npm test` | Backend: the PRD integration tests, study pages, and features (review schedule, option shuffling, JWT rule, rate limits, account deletion, AND/OR rules, optimizer). Uses the real compiler. |
| `npm run build:frontend` | Production build of the app |

GitHub Actions runs all of them, plus a Windows compiler build and Docker image
builds with API/compiler/ML smoke tests, on every push
([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Before deploying

- Set `NODE_ENV=production` and a private `JWT_SECRET`.
- Set `FRONTEND_URL` to the site's address, not `*`.
- The rate limiter keeps its counts in memory, which suits one backend process. With
  several processes, rate-limit at the proxy instead.
