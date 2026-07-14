# Verification Record

## Frozen Inputs

- Career parent: `42d601d54fd0a6728522b5e5fcecceb81ae83e6c`
- School parent: `8dd40b2c13002f94dc3b76e270c66c6366fa9956`
- Core integration tree: `4217e66455c753a925635fcc9d7c282a1cd9009d`
- Unresolved merge paths: zero

## Automated Gates

- `npm run lint`: passed.
- `npm run build`: passed, including all Career and canonical School routes.
- Session-stream presentation: 20 passed.
- Assessment action, UX edge, auth middleware, and School hierarchy checks:
  passed.
- The ownership resolver reproduced the exact core tree from the two frozen
  parents.

## Career Browser Matrix

The merged app ran on frontend `3001`, backend `8088`, with Career CDP on
`9222`.

- Interview Prep: a grounded payment-incident answer with concrete prevention
  and restored-service evidence was accepted; no repeated missing-gap loop or
  unearned praise remained.
- GD Prep: a learner addressed the actual dominant and waiting participants,
  set a respectful boundary, returned to topic, and advanced without a false
  repeated-boundary failure.
- Interview Test: the opening and first three probes were semantically distinct;
  the early-end confirmation exposed answered and coverage requirements; the
  insufficient report remained unscored.
- GD Test: an inactive Challenger was absent from roster and controls; the
  requested Consensus Builder contributed substantively; the Analyst followed
  with a discussion contribution; no transient duplicate appeared. Safe
  simulator notes were separated from learner caveats.
- Full ten-turn Interview and GD runs, report reload, and desktop/mobile report
  layouts were completed before the final targeted correction pass.
- Career report reload still worked after isolated School navigation, with no
  School identity or evidence appearing in Career.

Career experience review rubric (product quality, not learner score):

| Dimension | Score |
| --- | ---: |
| Grounding and specificity | 9.1/10 |
| Interview/GD mode authenticity | 9.0/10 |
| Routing and control integrity | 9.4/10 |
| Report transparency | 9.3/10 |
| Continuity and reload behavior | 9.1/10 |
| Tutor support and tone | 9.0/10 |
| Overall | 9.2/10 |

No routing, answer leakage, double debit, report clipping, or continuity failure
remained in the verified Career matrix.

## School Browser Matrix

School used a separate dedicated authenticated Chrome profile; Career identity
was not reused.

- An unauthenticated isolated context redirected `/school` to login and made
  no School data request before authentication.
- The dedicated learner resumed an inherited 12/18 insufficient-evidence
  placement. The original Continue button was a real dead action because state
  emitted `finish_placement` while reports and start authorization used
  `resume_placement`.
- After correction, Continue emitted one
  `POST /api/school/placement/start` with status 200 and opened a fresh
  question.
- The learner completed all eight Class 5 snapshot tracks, advanced through a
  focused check and confirmation, and persisted 10 answered items across
  deterministic and evaluated open answers.
- The current inherited School evaluator still classified that strong attempt
  as insufficient evidence. This is preserved School product work, not a merge
  regression; the new integrated baseline makes the continuation action usable
  for the School tutor/UI agents.

## Browser Harness Debt

- Phase A assumes a pristine School account always remains on the School shell;
  an account with an active placement correctly redirects to that placement.
- The live placement answer map is labelled Class 3 and does not cover the
  current Class 5 authored bank. Browser QA therefore continued against visible
  questions rather than adding a misleading static answer-key map.

These harness and School calibration items do not affect Career and must be
handled on a future School branch derived from this integrated baseline.
