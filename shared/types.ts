export type AgentRole =
  | 'crown'
  | 'defence'
  | 'judge'
  | 'clerk'
  | 'evidence_clerk'
  | 'witness'
  | 'jury_orchestrator'
  | `juror_${string}`

export type TrialStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed'

export type TrialStageId =
  | 'intake'
  | 'evidence_room'
  | 'charge_elements'
  | 'crown_opening'
  | 'defence_opening'
  | 'crown_direct'
  | 'defence_cross'
  | 'motions'
  | 'closings'
  | 'judge_charge'
  | 'jury_private_votes'
  | 'jury_deliberation'
  | 'verdict'

export type TrialEventType =
  | 'stage.started'
  | 'agent.delta'
  | 'transcript.turn'
  | 'objection.raised'
  | 'ruling.issued'
  | 'exhibit.admitted'
  | 'witness.called'
  | 'jury.vote'
  | 'usage.reported'
  | 'verdict.ready'
  | 'trial.paused'
  | 'trial.failed'

export interface Matter {
  id: string
  title: string
  jurisdiction: string
  narrative: string
  createdAt: string
  updatedAt: string
}

export interface EvidenceItem {
  id: string
  matterId: string
  exhibitId: string
  name: string
  type: 'pdf' | 'docx' | 'text' | 'image' | 'other'
  mimeType: string
  size: number
  text: string
  summary: string
  status: 'marked' | 'admitted' | 'excluded'
  uploadedAt: string
}

export interface CitationRef {
  exhibitId: string
  evidenceId: string
  label: string
}

export interface TrialEvent {
  id: string
  trialId: string
  type: TrialEventType
  stage: TrialStageId | null
  role: AgentRole | null
  title: string
  content: string
  citations: CitationRef[]
  metadata: Record<string, unknown>
  createdAt: string
}

export interface TrialStage {
  id: TrialStageId
  label: string
  role: AgentRole
  maxCompletionTokens: number
  thinking: 'adaptive' | 'disabled'
}

export interface TrialSession {
  id: string
  matterId: string
  status: TrialStatus
  currentStage: TrialStageId | null
  providerModel: string
  providerTier: string
  totalTokens: number
  createdAt: string
  completedAt: string | null
  events: TrialEvent[]
}

export interface ProviderStatus {
  model: string
  baseUrl: string
  serviceTier: string
  mock: boolean
  hasToken: boolean
  runtime: 'hermes' | 'direct-minimax'
  hermesConfigured: boolean
  hermesRequired: boolean
  hermesProfiles: string[]
  minimaxDisabled: boolean
  minimaxFallbackEnabled: boolean
  lastError: string | null
}

export interface HermesProfile {
  id: AgentRole
  label: string
  description: string
  privateMemory: boolean
  allowedEvidence: 'admitted-only' | 'matter-record' | 'all-marked'
  toolAccess: string[]
}

export interface WorkspaceState {
  matters: Matter[]
  activeMatter: Matter | null
  evidence: EvidenceItem[]
  trials: TrialSession[]
  activeTrial: TrialSession | null
  provider: ProviderStatus
  profiles: HermesProfile[]
}
