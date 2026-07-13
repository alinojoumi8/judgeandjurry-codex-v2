import type { HermesProfile, ProviderStatus } from '../shared/types.js'

export const hermesProfiles: HermesProfile[] = [
  {
    id: 'crown',
    label: 'Crown',
    description: 'Fair prosecution advocate; tests proof without arguing to win at all costs.',
    privateMemory: true,
    allowedEvidence: 'matter-record',
    toolAccess: ['memory', 'file', 'kanban'],
  },
  {
    id: 'defence',
    label: 'Defence',
    description: 'Protects the accused position, challenges proof, and raises reasonable doubt.',
    privateMemory: true,
    allowedEvidence: 'matter-record',
    toolAccess: ['memory', 'file', 'kanban'],
  },
  {
    id: 'judge',
    label: 'Judge',
    description: 'Neutral procedure, evidence rulings, jury instructions, and final synthesis.',
    privateMemory: true,
    allowedEvidence: 'admitted-only',
    toolAccess: ['memory', 'file', 'kanban'],
  },
  {
    id: 'clerk',
    label: 'Clerk',
    description: 'Maintains court record, transcript labels, and stage metadata.',
    privateMemory: false,
    allowedEvidence: 'all-marked',
    toolAccess: ['file'],
  },
  {
    id: 'evidence_clerk',
    label: 'Evidence Clerk',
    description: 'Marks exhibits, summarizes evidence, and guards citation hygiene.',
    privateMemory: false,
    allowedEvidence: 'all-marked',
    toolAccess: ['file', 'search_files'],
  },
  {
    id: 'witness',
    label: 'Witness',
    description: 'Answers only from witness statement and admitted exhibits.',
    privateMemory: true,
    allowedEvidence: 'admitted-only',
    toolAccess: ['file'],
  },
  {
    id: 'jury_orchestrator',
    label: 'Jury',
    description: 'Coordinates private juror votes and deliberation from admitted record only.',
    privateMemory: true,
    allowedEvidence: 'admitted-only',
    toolAccess: ['memory'],
  },
]

interface RuntimeStatusOptions {
  hermesBaseUrl: string
  hermesRequired: boolean
  hermesProfiles: string[]
  minimaxDisabled: boolean
  lastError: string | null
}

export function runtimeStatus(
  provider: Omit<
    ProviderStatus,
    | 'runtime'
    | 'hermesConfigured'
    | 'hermesRequired'
    | 'hermesProfiles'
    | 'minimaxDisabled'
    | 'minimaxFallbackEnabled'
  >,
  options: RuntimeStatusOptions,
): ProviderStatus {
  const hermesConfigured = Boolean(options.hermesBaseUrl || options.hermesProfiles.length)
  return {
    model: hermesConfigured ? 'Hermes courtroom profiles' : provider.model,
    baseUrl: options.hermesBaseUrl || (options.hermesProfiles.length ? 'profile endpoints' : provider.baseUrl),
    serviceTier: provider.serviceTier,
    mock: provider.mock,
    hasToken: provider.hasToken,
    runtime: hermesConfigured ? 'hermes' : 'direct-minimax',
    hermesConfigured,
    hermesRequired: options.hermesRequired,
    hermesProfiles: options.hermesProfiles,
    minimaxDisabled: options.minimaxDisabled,
    minimaxFallbackEnabled: !options.hermesRequired && !options.minimaxDisabled,
    lastError: options.lastError ?? provider.lastError,
  }
}
