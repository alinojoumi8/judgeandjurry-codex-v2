import { describe, expect, it, vi } from 'vitest'

import { HermesBackedRuntime } from '../server/agentRuntime.js'
import { MiniMaxProvider } from '../server/minimax.js'
import type { AppConfig } from '../server/config.js'
import type { TrialStage } from '../shared/types.js'

const stage: TrialStage = {
  id: 'crown_opening',
  label: 'Crown Opening',
  role: 'crown',
  maxCompletionTokens: 900,
  thinking: 'adaptive',
}

const baseConfig: Pick<AppConfig, 'hermes' | 'minimax'> = {
  minimax: {
    apiKey: '',
    baseUrl: 'https://api.minimax.io/v1',
    disabled: true,
    model: 'MiniMax-M3',
    mock: true,
    serviceTier: 'standard',
    timeoutMs: 1000,
  },
  hermes: {
    baseUrl: '',
    apiKey: 'local-hermes-key',
    required: true,
    profileUrls: {},
    profileApiKeys: {},
    profileModels: {},
  },
}

describe('HermesBackedRuntime', () => {
  it('fails loudly when Hermes is required and no role endpoint is configured', async () => {
    const provider = new MiniMaxProvider(baseConfig.minimax)
    const runtime = new HermesBackedRuntime(baseConfig, provider)

    await expect(
      collect(
        runtime.streamTurn({
          stage,
          messages: [{ role: 'user', content: 'Open court.' }],
        }),
      ),
    ).rejects.toThrow('Hermes profile endpoint is required')
  })

  it('routes a courtroom role to its Hermes profile URL without MiniMax-only fields', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      const body = new TextEncoder().encode(
        [
          'data: {"choices":[{"delta":{"content":"Crown ready."}}],"usage":{"total_tokens":12}}',
          '',
          'data: [DONE]',
          '',
        ].join('\n'),
      )
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(body)
            controller.close()
          },
        }),
      )
    })
    const config: Pick<AppConfig, 'hermes' | 'minimax'> = {
      ...baseConfig,
      hermes: {
        ...baseConfig.hermes,
        profileUrls: { crown: 'http://127.0.0.1:8650' },
        profileModels: { crown: 'crown' },
      },
    }
    const provider = new MiniMaxProvider(config.minimax)
    const runtime = new HermesBackedRuntime(config, provider, fetchFn as typeof fetch)

    const chunks = await collect(
      runtime.streamTurn({
        stage,
        messages: [{ role: 'user', content: 'Open court.' }],
      }),
    )

    expect(chunks.map((chunk) => chunk.content).join('')).toContain('Crown ready.')
    expect(fetchFn).toHaveBeenCalledOnce()
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8650/v1/chat/completions')
    const body = JSON.parse(String(init?.body))
    expect(body).toMatchObject({
      model: 'crown',
      stream: true,
      max_completion_tokens: 900,
    })
    expect(body).not.toHaveProperty('service_tier')
    expect(body).not.toHaveProperty('thinking')
  })
})

async function collect<T>(generator: AsyncGenerator<T>): Promise<T[]> {
  const chunks: T[] = []
  for await (const chunk of generator) chunks.push(chunk)
  return chunks
}
