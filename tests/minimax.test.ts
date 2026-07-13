import { describe, expect, it } from 'vitest'

import { buildMiniMaxRequest, MiniMaxProvider } from '../server/minimax.js'
import type { TrialStage } from '../shared/types.js'

const stage: TrialStage = {
  id: 'crown_opening',
  label: 'Crown Opening',
  role: 'crown',
  maxCompletionTokens: 1200,
  thinking: 'adaptive',
}

describe('MiniMaxProvider', () => {
  it('builds the token-plan chat completions request without exposing secrets', () => {
    const request = buildMiniMaxRequest('MiniMax-M3', 'standard', {
      stage,
      messages: [{ role: 'user', content: 'Open court.' }],
    })

    expect(request).toMatchObject({
      model: 'MiniMax-M3',
      stream: true,
      max_completion_tokens: 1200,
      thinking: { type: 'adaptive' },
      stream_options: { include_usage: true },
      service_tier: 'standard',
    })
    expect(JSON.stringify(request)).not.toContain('sk-')
  })

  it('streams deterministic mock text when mock mode is enabled', async () => {
    const provider = new MiniMaxProvider({
      apiKey: '',
      baseUrl: 'https://api.minimax.io/v1',
      disabled: false,
      model: 'MiniMax-M3',
      mock: true,
      serviceTier: 'standard',
      timeoutMs: 1000,
    })

    let content = ''
    let usage = 0
    for await (const chunk of provider.streamTurn({
      stage,
      messages: [{ role: 'user', content: 'Open court.' }],
    })) {
      content += chunk.content
      usage += chunk.usage?.total_tokens ?? 0
    }

    expect(content).toContain('Crown Opening')
    expect(usage).toBeGreaterThan(0)
  })
})
