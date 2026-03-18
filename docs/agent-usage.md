# Agent Usage

## Development Mode

The repository is being developed under an RLCR workflow with multiple workers owning separate file ranges. Round 0 requires the goal tracker to be initialized before implementation starts.

## This Round

Worker 1 owns:

- `README.md`
- `docs/**`
- `package.json`
- `tsconfig.json`
- `.gitignore`
- `.humanize/rlcr/2026-03-18_14-02-34/goal-tracker.md`

This round intentionally avoids product-code implementation and focuses on shared planning, command contracts, and delivery documentation.

## Expected Coordination Rules

- Do not modify files outside the assigned ownership ranges.
- Keep the module contract documented in `docs/module-design.md`.
- Preserve the package script names and their intended entrypoints unless the worker team agrees on an update and the docs are revised in the same round.
- Keep the zero-dependency rule in place.

## AI Assistance Record

- Workflow: RLCR round-0 setup with worker partitioning.
- Skill used: `humanize-rlcr` for loop requirements and tracker initialization.
- Agent contribution in this round: extracted acceptance criteria from `plan.md`, created project metadata, and authored course-delivery documents.
- External services: none required for this round.
