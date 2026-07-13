import type { TrialStage } from '../shared/types'

export const stages: TrialStage[] = [
  { id: 'intake', label: 'Intake', role: 'clerk', maxCompletionTokens: 900, thinking: 'disabled' },
  {
    id: 'evidence_room',
    label: 'Evidence',
    role: 'evidence_clerk',
    maxCompletionTokens: 1_200,
    thinking: 'adaptive',
  },
  {
    id: 'charge_elements',
    label: 'Elements',
    role: 'judge',
    maxCompletionTokens: 1_600,
    thinking: 'adaptive',
  },
  {
    id: 'crown_opening',
    label: 'Openings',
    role: 'crown',
    maxCompletionTokens: 1_800,
    thinking: 'adaptive',
  },
  {
    id: 'defence_opening',
    label: 'Defence',
    role: 'defence',
    maxCompletionTokens: 1_800,
    thinking: 'adaptive',
  },
  { id: 'crown_direct', label: 'Witnesses', role: 'crown', maxCompletionTokens: 1_800, thinking: 'adaptive' },
  { id: 'defence_cross', label: 'Cross', role: 'defence', maxCompletionTokens: 1_800, thinking: 'adaptive' },
  { id: 'motions', label: 'Motions', role: 'judge', maxCompletionTokens: 1_600, thinking: 'adaptive' },
  { id: 'closings', label: 'Closings', role: 'defence', maxCompletionTokens: 2_000, thinking: 'adaptive' },
  { id: 'judge_charge', label: 'Charge', role: 'judge', maxCompletionTokens: 2_000, thinking: 'adaptive' },
  {
    id: 'jury_private_votes',
    label: 'Votes',
    role: 'jury_orchestrator',
    maxCompletionTokens: 1_600,
    thinking: 'adaptive',
  },
  {
    id: 'jury_deliberation',
    label: 'Jury',
    role: 'jury_orchestrator',
    maxCompletionTokens: 2_000,
    thinking: 'adaptive',
  },
  { id: 'verdict', label: 'Verdict', role: 'judge', maxCompletionTokens: 2_400, thinking: 'adaptive' },
]
