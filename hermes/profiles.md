# Hermes Courtroom Profiles

These profiles are mirrored in the app runtime and can be created in Hermes with `scripts/setup-hermes-profiles.ps1`.

| Profile | Purpose |
| --- | --- |
| `crown` | Fair prosecution advocate; tests proof without arguing to win at all costs. |
| `defence` | Protects the accused position, challenges proof, and raises reasonable doubt. |
| `judge` | Neutral procedure, evidence rulings, jury instructions, and final synthesis. |
| `clerk` | Maintains court record, transcript labels, and stage metadata. |
| `evidence_clerk` | Marks exhibits, summarizes evidence, and guards citation hygiene. |
| `witness` | Answers only from witness statement and admitted exhibits. |
| `jury_orchestrator` | Coordinates private juror votes and deliberation from admitted record only. |

Juror-specific app roles are generated as `juror_01` through `juror_12` inside trial events.
