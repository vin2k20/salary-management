# CLAUDE.md

Project rules for AI pair programming on this repository.

## The project

Salary management for ACME HR: a web application where global and country HR managers maintain pay data for 10,000 employees in the USA, Canada, Australia and India, and see how the organisation pays people on a dashboard.

Read before working on anything:

- `docs/implementation-plan.md`: the step being worked on, section 2 (how we work) and section 5 (answers to the clarification questions).
- `docs/high-level-design.md` and `docs/decisions-and-questions.md`: the sections listed under "Read first" for the step.
- `docs/requirements.md` for scope, and `docs/design-approach-and-trade-offs.md` for the reasoning behind choices.

## How we work

- Work on one plan step at a time, on a branch named `step/NN-short-name`. Do not start the next step.
- Commit the shared Zod schemas first when a step has both API and UI work.
- Test first: commit the failing test, then the code that makes it pass, then any clean-up.
- Run lint, type check and all tests before asking to commit.
- **Ask Vineet before every commit and every push.** Show the files and the full commit message first.
- Follow the definition of done in section 2.3 of the plan, and update the progress tracker when a step is merged.

## Commit messages

- Subject in Conventional Commits style with the workspace as the scope, for example `feat(api): add employee list endpoint`.
- Body: one short sentence on what the commit does, then bullet points listing what changed in the software.
- Describe the software only. Never describe prompts or how the AI was used.
- End with the `Co-Authored-By: Claude` trailer.
- Use the repository's local git settings. Never change the global git configuration.

## Engineering rules

- TypeScript in strict mode everywhere. Node.js 24 LTS, Express 5, Zod, Drizzle ORM with PostgreSQL, React with Vite.
- Money is stored as whole minor units with an ISO 4217 currency code. Never use floating point numbers for money.
- Every repository function takes the caller's scope. Records outside a country HR user's scope return 404.
- Every change to employees, pay, pay components and users is written to the change log in the same transaction.
- Business rules live in plain functions that can be tested without a database.
- Tests are fast and deterministic: no real network calls, and the clock and external clients are passed in.
- No secrets, real personal data or pay amounts in code, logs or commits. Configuration comes from environment variables.
- Do not add dependencies or services that are not in the decisions document without asking first.

## Documents

- Plain, direct English. No em dashes, en dashes, curly quotes or filler words.
- Only Markdown files and diagrams are committed. Word (.docx) copies are kept outside the repository and never committed.
- When the design changes, update the related document and record the decision with its reason.
- `docs/ai/log.md` is the project history: add one line per completed step describing what was built. No prompts and no small tweaks.
- If something is unclear, choose the simplest option that fits the documents, note it in the pull request, and record it in the decisions document. Ask Vineet when a choice changes scope.

## Commands

Filled in during step 01, when the tooling is set up.
