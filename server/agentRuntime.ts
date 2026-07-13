import type { AgentRole, ProviderStatus } from '../shared/types.js'
import type { AppConfig } from './config.js'
import {
  MiniMaxProvider,
  type MiniMaxChunk,
  type MiniMaxTurnInput,
  parseOpenAiCompatibleSse,
} from './minimax.js'
import { runtimeStatus } from './hermes.js'

export interface CourtroomAgentRuntime {
  getStatus(): ProviderStatus
  streamTurn(input: MiniMaxTurnInput): AsyncGenerator<MiniMaxChunk>
}

export class HermesBackedRuntime implements CourtroomAgentRuntime {
  private lastError: string | null = null

  constructor(
    private readonly config: Pick<AppConfig, 'hermes' | 'minimax'>,
    private readonly minimax: MiniMaxProvider,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  getStatus(): ProviderStatus {
    return runtimeStatus(this.minimax.getStatus(), {
      hermesBaseUrl: this.config.hermes.baseUrl,
      hermesRequired: this.config.hermes.required,
      hermesProfiles: this.configuredHermesProfiles(),
      minimaxDisabled: this.config.minimax.disabled,
      lastError: this.lastError,
    })
  }

  async *streamTurn(input: MiniMaxTurnInput): AsyncGenerator<MiniMaxChunk> {
    const endpoint = this.resolveHermesEndpoint(input.stage.role)

    if (!endpoint) {
      if (this.config.hermes.required || this.config.minimax.disabled) {
        const message = `Hermes profile endpoint is required but not configured for role "${input.stage.role}".`
        this.lastError = message
        throw new Error(message)
      }

      yield* this.minimax.streamTurn(input)
      return
    }

    try {
      yield* this.streamViaHermes(input, endpoint)
      this.lastError = null
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hermes runtime failed.'
      this.lastError = message
      if (this.config.hermes.required || this.config.minimax.disabled) {
        throw new Error(message, { cause: error })
      }
      yield* this.minimax.streamTurn(input)
    }
  }

  private async *streamViaHermes(
    input: MiniMaxTurnInput,
    endpoint: HermesEndpoint,
  ): AsyncGenerator<MiniMaxChunk> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (endpoint.apiKey) {
      headers.Authorization = `Bearer ${endpoint.apiKey}`
    }

    const response = await this.fetchFn(`${endpoint.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: endpoint.model,
        messages: input.messages,
        stream: true,
        max_completion_tokens: input.stage.maxCompletionTokens,
      }),
    })

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '')
      throw new Error(`Hermes profile "${endpoint.role}" failed with ${response.status}: ${body.slice(0, 240)}`)
    }

    yield* parseOpenAiCompatibleSse(response.body)
  }

  private resolveHermesEndpoint(role: AgentRole): HermesEndpoint | null {
    const normalizedRole = normalizeRole(role)
    const baseUrl = this.config.hermes.profileUrls[normalizedRole] || this.config.hermes.baseUrl
    if (!baseUrl) return null

    return {
      role: normalizedRole,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey: this.config.hermes.profileApiKeys[normalizedRole] || this.config.hermes.apiKey,
      model: this.config.hermes.profileModels[normalizedRole] || normalizedRole,
    }
  }

  private configuredHermesProfiles(): string[] {
    return Object.keys(this.config.hermes.profileUrls).toSorted()
  }
}

interface HermesEndpoint {
  role: string
  baseUrl: string
  apiKey: string
  model: string
}

function normalizeRole(role: AgentRole): string {
  return role.toLowerCase()
}
