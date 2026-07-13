import type { TrialStage } from '../shared/types.js'
import type { AppConfig } from './config.js'

export interface MiniMaxUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export interface MiniMaxChunk {
  content: string
  usage?: MiniMaxUsage
  done?: boolean
}

export interface MiniMaxTurnInput {
  stage: TrialStage
  messages: Array<{ role: 'system' | 'user'; content: string }>
}

export interface MiniMaxProviderStatus {
  model: string
  baseUrl: string
  disabled: boolean
  serviceTier: string
  mock: boolean
  hasToken: boolean
  lastError: string | null
}

type FetchFn = typeof fetch

export class MiniMaxProvider {
  private lastError: string | null = null
  private readonly config: AppConfig['minimax']
  private readonly fetchFn: FetchFn

  constructor(config: AppConfig['minimax'], fetchFn: FetchFn = fetch) {
    this.config = config
    this.fetchFn = fetchFn
  }

  getStatus(): MiniMaxProviderStatus {
    return {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      disabled: this.config.disabled,
      serviceTier: this.config.serviceTier,
      mock: this.config.mock,
      hasToken: Boolean(this.config.apiKey),
      lastError: this.lastError,
    }
  }

  async *streamTurn(input: MiniMaxTurnInput): AsyncGenerator<MiniMaxChunk> {
    if (this.config.disabled) {
      const message = 'Direct MiniMax provider is disabled.'
      this.lastError = message
      throw new Error(message)
    }

    if (this.config.mock || !this.config.apiKey) {
      yield* this.mockTurn(input)
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const response = await this.fetchFn(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildMiniMaxRequest(this.config.model, this.config.serviceTier, input)),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`MiniMax request failed with ${response.status}: ${body.slice(0, 240)}`)
      }

      if (!response.body) {
        throw new Error('MiniMax response did not include a stream body.')
      }

      yield* parseOpenAiCompatibleSse(response.body)
      this.lastError = null
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MiniMax request failed.'
      this.lastError = message
      throw new Error(message, { cause: error })
    } finally {
      clearTimeout(timeout)
    }
  }

  private async *mockTurn(input: MiniMaxTurnInput): AsyncGenerator<MiniMaxChunk> {
    const role = input.stage.role
    const text = [
      `${input.stage.label}: ${role} records a simulated courtroom turn anchored to the matter record.`,
      'The court record remains citation-first. Any missing proof is treated as an unresolved issue rather than a fact.',
      role === 'judge'
        ? 'The jury is reminded that the burden stays with the Crown and unanimity is required for a criminal verdict.'
        : 'Counsel should return to admitted exhibits before asking the trier of fact to draw an inference.',
    ].join(' ')

    const words = text.split(' ')
    for (let index = 0; index < words.length; index += 8) {
      await new Promise((resolve) => setTimeout(resolve, 8))
      yield { content: `${words.slice(index, index + 8).join(' ')} ` }
    }
    yield {
      content: '',
      usage: {
        prompt_tokens: 180,
        completion_tokens: words.length,
        total_tokens: 180 + words.length,
      },
      done: true,
    }
  }
}

export function buildMiniMaxRequest(
  model: string,
  serviceTier: string,
  input: MiniMaxTurnInput,
): Record<string, unknown> {
  return {
    model,
    messages: input.messages,
    stream: true,
    max_completion_tokens: input.stage.maxCompletionTokens,
    thinking: { type: input.stage.thinking },
    stream_options: { include_usage: true },
    service_tier: serviceTier,
  }
}

export async function* parseOpenAiCompatibleSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<MiniMaxChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') {
        if (payload === '[DONE]') yield { content: '', done: true }
        continue
      }

      const parsed = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
        usage?: MiniMaxUsage
      }
      const content =
        parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? ''
      yield { content, usage: parsed.usage }
    }
  }
}
