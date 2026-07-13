import { describe, expect, it } from 'vitest'

import { deriveTrialView } from '../src/trialView.js'
import type { TrialEvent, TrialSession } from '../shared/types.js'

const baseTrial: TrialSession = {
  id: 'trial-1',
  matterId: 'matter-1',
  status: 'running',
  currentStage: 'intake',
  providerModel: 'MiniMax-M3',
  providerTier: 'standard',
  totalTokens: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  events: [],
}

function event(partial: Partial<TrialEvent>): TrialEvent {
  return {
    id: partial.id ?? crypto.randomUUID(),
    trialId: 'trial-1',
    type: partial.type ?? 'stage.started',
    stage: partial.stage ?? 'intake',
    role: partial.role ?? 'clerk',
    title: partial.title ?? 'event',
    content: partial.content ?? '',
    citations: partial.citations ?? [],
    metadata: partial.metadata ?? {},
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
  }
}

describe('deriveTrialView', () => {
  it('derives live status, current stage, and token usage from streamed events', () => {
    const view = deriveTrialView(baseTrial, [
      event({ stage: 'intake', createdAt: '2026-01-01T00:00:01.000Z' }),
      event({
        type: 'usage.reported',
        stage: 'intake',
        metadata: { totalTokens: 100 },
        createdAt: '2026-01-01T00:00:02.000Z',
      }),
      event({ stage: 'verdict', createdAt: '2026-01-01T00:00:03.000Z' }),
      event({
        type: 'usage.reported',
        stage: 'verdict',
        metadata: { totalTokens: 250 },
        createdAt: '2026-01-01T00:00:04.000Z',
      }),
      event({ type: 'verdict.ready', stage: 'verdict', createdAt: '2026-01-01T00:00:05.000Z' }),
    ])

    expect(view?.status).toBe('completed')
    expect(view?.currentStage).toBe('verdict')
    expect(view?.totalTokens).toBe(350)
  })
})
