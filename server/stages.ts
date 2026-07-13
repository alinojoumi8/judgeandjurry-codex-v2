import type { AgentRole, TrialStage, TrialStageId } from '../shared/types.js'

export const trialStages: TrialStage[] = [
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
    label: 'Crown Opening',
    role: 'crown',
    maxCompletionTokens: 1_800,
    thinking: 'adaptive',
  },
  {
    id: 'defence_opening',
    label: 'Defence Opening',
    role: 'defence',
    maxCompletionTokens: 1_800,
    thinking: 'adaptive',
  },
  {
    id: 'crown_direct',
    label: 'Direct',
    role: 'crown',
    maxCompletionTokens: 1_800,
    thinking: 'adaptive',
  },
  {
    id: 'defence_cross',
    label: 'Cross',
    role: 'defence',
    maxCompletionTokens: 1_800,
    thinking: 'adaptive',
  },
  { id: 'motions', label: 'Motions', role: 'judge', maxCompletionTokens: 1_600, thinking: 'adaptive' },
  { id: 'closings', label: 'Closings', role: 'defence', maxCompletionTokens: 2_000, thinking: 'adaptive' },
  {
    id: 'judge_charge',
    label: 'Judge Charge',
    role: 'judge',
    maxCompletionTokens: 2_000,
    thinking: 'adaptive',
  },
  {
    id: 'jury_private_votes',
    label: 'Juror Votes',
    role: 'jury_orchestrator',
    maxCompletionTokens: 1_600,
    thinking: 'adaptive',
  },
  {
    id: 'jury_deliberation',
    label: 'Deliberation',
    role: 'jury_orchestrator',
    maxCompletionTokens: 2_000,
    thinking: 'adaptive',
  },
  { id: 'verdict', label: 'Verdict', role: 'judge', maxCompletionTokens: 2_400, thinking: 'adaptive' },
]

export function stageById(id: TrialStageId): TrialStage {
  const stage = trialStages.find((candidate) => candidate.id === id)
  if (!stage) {
    throw new Error(`Unknown trial stage: ${id}`)
  }
  return stage
}

export function roleLabel(role: AgentRole): string {
  if (role.startsWith('juror_')) {
    return `Juror ${role.replace('juror_', '')}`
  }

  const labels: Record<string, string> = {
    crown: 'Crown',
    defence: 'Defence',
    judge: 'Judge',
    clerk: 'Clerk',
    evidence_clerk: 'Evidence Clerk',
    witness: 'Witness',
    jury_orchestrator: 'Jury',
  }

  return labels[role] ?? role
}
