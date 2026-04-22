# DT

DT is an internal reporting-agent prototype for people who need to turn vague manager messages into visible, durable work.

Given one manager instruction, the app helps you:
- create a structured `WorkItem`
- clarify decision ownership
- draft a manager-facing reply
- track follow-ups so work does not disappear
- generate daily, weekly, and monthly report summaries

## Stack

- Next.js 16
- React 19
- TypeScript
- Prisma 6
- SQLite
- Vitest
- Optional OpenAI rewrite layer via the Responses API

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create your env file

Copy the example file:

```bash
cp .env.example .env
```

Default values:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5-mini"
```

Notes:
- `DATABASE_URL` points to the local SQLite file used by Prisma.
- `OPENAI_API_KEY` is optional. If left empty, the app uses the deterministic analysis pipeline only.
- `OPENAI_MODEL` is optional. The current default is `gpt-5-mini`.

### 3. Bootstrap the database

```bash
npm run db:bootstrap
```

Why this exists:
- Prisma is still the data access layer.
- For this repo, the first version avoids relying on Prisma's migration engine as the critical path.
- `db:bootstrap` creates the SQLite tables and indexes needed by the app.

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How the App Behaves

### Without OpenAI

If `OPENAI_API_KEY` is empty, DT uses its built-in deterministic analysis pipeline:
- manager message intake
- work-item decomposition
- decision-boundary judgment
- follow-up creation
- report aggregation

This is the default fallback path and should keep the app usable even with no model credentials.

### With OpenAI

If `OPENAI_API_KEY` is set, DT adds an optional rewrite layer on top of the deterministic draft:
- it keeps the deterministic analysis as the source of truth
- it asks the model to improve the human-facing fields
- if the API call or JSON parsing fails, DT falls back to the deterministic draft

Current environment status is shown in the UI header.

## Common Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run test:watch
npm run db:bootstrap
npm run db:generate
npm run db:migrate
```

What they do:
- `npm run dev`: start the local development server
- `npm run build`: build the production app
- `npm run start`: run the production build locally
- `npm run lint`: run ESLint
- `npm test`: run Vitest once with coverage
- `npm run test:watch`: run Vitest in watch mode
- `npm run db:bootstrap`: create the local SQLite schema and indexes
- `npm run db:generate`: regenerate the Prisma client
- `npm run db:migrate`: Prisma migration command if you want to use migrations later

## Project Shape

Important files:
- [src/app/page.tsx](/Users/seoyang/my_projects/DT/src/app/page.tsx): main UI
- [src/app/actions.ts](/Users/seoyang/my_projects/DT/src/app/actions.ts): server actions for create/update/rerun flows
- [src/lib/analysis.ts](/Users/seoyang/my_projects/DT/src/lib/analysis.ts): deterministic analysis pipeline
- [src/lib/llm.ts](/Users/seoyang/my_projects/DT/src/lib/llm.ts): optional OpenAI rewrite layer
- [src/lib/reports.ts](/Users/seoyang/my_projects/DT/src/lib/reports.ts): shared report aggregation
- [src/lib/bootstrap.ts](/Users/seoyang/my_projects/DT/src/lib/bootstrap.ts): runtime database bootstrap
- [prisma/schema.prisma](/Users/seoyang/my_projects/DT/prisma/schema.prisma): Prisma schema

## Testing

Run the main checks with:

```bash
npm run lint
npm test
npm run build
```

These should pass before pushing changes.

## Current Limitations

- Message intake is manual. There is no Feishu, Slack, or WeCom integration yet.
- Manager adaptation is still lightweight and driven by a structured profile, not deep conversation history.
- The OpenAI layer currently rewrites existing drafts; it does not replace the deterministic pipeline.
- SQLite is used for local persistence in this first version.

## Repository

- GitHub: [Yangxu1201/DT](https://github.com/Yangxu1201/DT)
