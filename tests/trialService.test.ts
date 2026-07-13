import { describe, expect, it } from 'vitest'

import { HermesBackedRuntime } from '../server/agentRuntime.js'
import { CourtroomStore } from '../server/db.js'
import { TrialEventBus } from '../server/events.js'
import { MiniMaxProvider } from '../server/minimax.js'
import { TrialService } from '../server/trialService.js'
import type { CourtroomAgentRuntime } from '../server/agentRuntime.js'
import type { MiniMaxChunk, MiniMaxTurnInput } from '../server/minimax.js'
import type { ProviderStatus } from '../shared/types.js'

describe('TrialService', () => {
  it('runs a full mock courtroom trial and persists jury votes and verdict readiness', async () => {
    const store = new CourtroomStore(':memory:')
    const provider = new MiniMaxProvider({
      apiKey: '',
      baseUrl: 'https://api.minimax.io/v1',
      disabled: false,
      model: 'MiniMax-M3',
      mock: true,
      serviceTier: 'standard',
      timeoutMs: 1000,
    })
    const runtime = new HermesBackedRuntime(
      {
        hermes: {
          baseUrl: '',
          apiKey: '',
          required: false,
          profileUrls: {},
          profileApiKeys: {},
          profileModels: {},
        },
        minimax: {
          apiKey: '',
          baseUrl: 'https://api.minimax.io/v1',
          disabled: false,
          model: 'MiniMax-M3',
          mock: true,
          serviceTier: 'standard',
          timeoutMs: 1000,
        },
      },
      provider,
    )
    const service = new TrialService(store, runtime, new TrialEventBus())

    const matter = store.createMatter({
      title: 'R. v. Test',
      jurisdiction: 'Ontario / Canada',
      narrative: 'The Crown alleges fraud. Defence disputes intent and causation.',
    })
    store.addEvidence({
      matterId: matter.id,
      name: 'complaint.txt',
      type: 'text',
      mimeType: 'text/plain',
      size: 42,
      text: 'The complainant says funds were transferred after a promise.',
      summary: 'Complainant statement about transfer and promise.',
    })

    const trial = service.createTrial(matter.id)
    await service.executeTrial(trial.id)

    const completed = store.getTrial(trial.id)
    const events = completed.events
    expect(completed.status).toBe('completed')
    expect(events.some((event) => event.type === 'transcript.turn' && event.stage === 'verdict')).toBe(true)
    expect(events.filter((event) => event.type === 'jury.vote')).toHaveLength(12)
    expect(completed.totalTokens).toBeGreaterThan(0)
    store.close()
  })

  it('pauses after the current stage and resumes from the next pending stage', async () => {
    const store = new CourtroomStore(':memory:')
    const service = new TrialService(store, new SlowRuntime(), new TrialEventBus())
    const matter = store.createMatter({
      title: 'R. v. Pause',
      jurisdiction: 'Ontario / Canada',
      narrative: 'A short case narrative.',
    })
    const trial = service.createTrial(matter.id)

    const run = service.executeTrial(trial.id)
    await waitFor(() => store.listEvents(trial.id).some((event) => event.type === 'stage.started'))
    const paused = service.pauseTrial(trial.id, 'Pause after this stage.')
    await run

    const pausedTrial = store.getTrial(trial.id)
    expect(paused.event.type).toBe('trial.paused')
    expect(paused.trial.status).toBe('paused')
    expect(pausedTrial.status).toBe('paused')
    expect(pausedTrial.events.some((event) => event.type === 'verdict.ready')).toBe(false)
    expect(pausedTrial.events.filter((event) => event.type === 'transcript.turn')).toHaveLength(1)

    service.advanceTrial(trial.id)
    await waitFor(() => store.getTrial(trial.id).status === 'completed', 2_000)

    const completed = store.getTrial(trial.id)
    expect(completed.events.filter((event) => event.type === 'transcript.turn')).toHaveLength(13)
    expect(completed.events.filter((event) => event.stage === 'intake' && event.type === 'transcript.turn')).toHaveLength(1)
    store.close()
  })
})

class SlowRuntime implements CourtroomAgentRuntime {
  getStatus(): ProviderStatus {
    return {
      runtime: 'direct-minimax',
      model: 'SlowRuntime',
      baseUrl: 'mock://slow-runtime',
      serviceTier: 'standard',
      mock: true,
      hasToken: false,
      hermesConfigured: false,
      hermesRequired: false,
      hermesProfiles: [],
      minimaxDisabled: false,
      minimaxFallbackEnabled: false,
      lastError: null,
    }
  }

  async *streamTurn(input: MiniMaxTurnInput): AsyncGenerator<MiniMaxChunk> {
    await new Promise((resolve) => setTimeout(resolve, 25))
    yield { content: `${input.stage.label}: stage completed. ` }
    yield {
      content: '',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      done: true,
    }
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for condition.')
}
