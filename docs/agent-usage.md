# Agent Usage

## Workflow

The repository was developed under the `humanize-rlcr` skill in RLCR agent-teams mode.

- Round 0: initialize the RLCR loop, bootstrap the repository structure, implement the first pass of source files, and establish the tracked goal/acceptance baseline.
- Round 1: respond to Codex review findings, rewire the runtime to the external custom algorithms, expand verification coverage, rebuild the deterministic demo around the real app runtime, and realign the delivery docs.

## Round 1 Agent Allocation

- Runtime/service worker:
  - exported the nested runtime algorithm bundle from `src/algorithms/`
  - made `getRuntime().source.algorithms` resolve to `external`
  - rejected invalid destination `sortBy`
  - enabled typo-tolerant food search through the custom fuzzy/index-backed path
- Verification worker:
  - switched `scripts/validate-data.ts` to the real runtime seed
  - added package-level runtime/service coverage in `tests/runtime-services.test.ts`
  - wired `tests/data-seed.test.ts` into the package test entrypoint
- Exchange/compression worker:
  - replaced fallback journal compression with `src/algorithms/compression.ts` while preserving the service contract
- Demo worker:
  - rebuilt `scripts/demo-support.ts` and `tests/integration-smoke.test.ts` around `createAppServices()` and the real seed/runtime data

## Coordination Notes

- Workers were assigned strict file ownership to avoid silent overwrites.
- Multiple retry attempts were needed because some subagent runs failed with infrastructure stream disconnects rather than repository-level blockers.
- The final repository state was verified from the shared workspace after integrating the successful worker outputs.

## AI Assistance Record

- Skill used: `humanize-rlcr`
- Model/workflow: Codex + RLCR review loop with fresh worker teams in Round 1
- External services: none
- Network usage: none
- Primary AI-assisted areas:
  - runtime algorithm integration
  - verification/test expansion
  - deterministic demo scripting
  - delivery-document alignment
