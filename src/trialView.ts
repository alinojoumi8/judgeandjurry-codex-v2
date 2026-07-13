import type { TrialEvent, TrialSession, TrialStageId, TrialStatus } from '../shared/types.js'

export function deriveTrialView(
  trial: TrialSession | null,
  events: TrialEvent[],
): TrialSession | null {
  if (!trial) return null

  const latestStage = findLastEvent(events, (event) => event.type === 'stage.started' && Boolean(event.stage))
  const failed = findLastEvent(events, (event) => event.type === 'trial.failed')
  const verdictReady = findLastEvent(events, (event) => event.type === 'verdict.ready')
  const totalTokens = events
    .filter((event) => event.type === 'usage.reported')
    .reduce((sum, event) => {
      const value = Number(event.metadata.totalTokens)
      return sum + (Number.isFinite(value) ? value : 0)
    }, 0)

  let status: TrialStatus = trial.status
  if (failed) {
    status = 'failed'
  } else if (verdictReady) {
    status = 'completed'
  } else if (latestStage || trial.status === 'running') {
    status = 'running'
  }

  return {
    ...trial,
    status,
    currentStage: (latestStage?.stage as TrialStageId | null) ?? trial.currentStage,
    totalTokens: totalTokens || trial.totalTokens,
    events,
  }
}

function findLastEvent(
  events: TrialEvent[],
  predicate: (event: TrialEvent) => boolean,
): TrialEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (predicate(events[index])) {
      return events[index]
    }
  }
  return undefined
}
