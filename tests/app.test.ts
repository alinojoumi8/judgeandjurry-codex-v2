import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HermesBackedRuntime } from '../server/agentRuntime.js'
import { createApp } from '../server/app.js'
import { CourtroomStore } from '../server/db.js'
import { TrialEventBus } from '../server/events.js'
import { MiniMaxProvider } from '../server/minimax.js'
import { TrialService } from '../server/trialService.js'
import type { AppConfig } from '../server/config.js'

function testDeps() {
  const config: AppConfig = {
    host: '127.0.0.1',
    port: 0,
    dbPath: ':memory:',
    maxUploadBytes: 1024 * 1024,
    minimax: {
      apiKey: '',
      baseUrl: 'https://api.minimax.io/v1',
      disabled: false,
      model: 'MiniMax-M3',
      mock: true,
      serviceTier: 'standard',
      timeoutMs: 1000,
    },
    hermes: {
      baseUrl: '',
      apiKey: '',
      required: false,
      profileUrls: {},
      profileApiKeys: {},
      profileModels: {},
    },
  }
  const store = new CourtroomStore(':memory:')
  const provider = new MiniMaxProvider(config.minimax)
  const runtime = new HermesBackedRuntime(config, provider)
  const events = new TrialEventBus()
  const trialService = new TrialService(store, runtime, events)
  const app = createApp({ config, store, runtime, events, trialService })
  return { app, config, store }
}

describe('API app', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates matters and returns runtime state without leaking provider tokens', async () => {
    const { app, store } = testDeps()

    const created = await request(app).post('/api/matters').send({
      title: 'R. v. API',
      jurisdiction: 'Ontario / Canada',
      narrative: 'A short case narrative.',
    })

    expect(created.status).toBe(201)
    const state = await request(app).get('/api/state')
    expect(state.status).toBe(200)
    expect(state.text).not.toContain('sk-')
    expect(state.body.activeMatter.title).toBe('R. v. API')
    store.close()
  })

  it('pauses trials, resumes them, and returns a verdict report', async () => {
    const { app, store } = testDeps()

    const matterResponse = await request(app).post('/api/matters').send({
      title: 'R. v. Controls',
      jurisdiction: 'Ontario / Canada',
      narrative: 'A short case narrative.',
    })
    const trialResponse = await request(app).post('/api/trials').send({
      matterId: matterResponse.body.matter.id,
    })
    const trialId = String(trialResponse.body.trial.id)
    store.updateTrialStatus(trialId, 'running', 'intake')

    const paused = await request(app).post(`/api/trials/${trialId}/pause`).send({
      content: 'Pause for a court note.',
    })
    expect(paused.status).toBe(201)
    expect(paused.body.trial.status).toBe('paused')
    expect(paused.body.event.type).toBe('trial.paused')

    const advanced = await request(app).post(`/api/trials/${trialId}/advance`).send()
    expect(advanced.status).toBe(202)
    expect(advanced.body.trial.status).toBe('running')
    await waitFor(() => store.getTrial(trialId).status === 'completed', 2_000)

    const report = await request(app).get(`/api/trials/${trialId}/report`)
    expect(report.status).toBe(200)
    expect(report.body.report.title).toBe('Judge & Jury Verdict Report')
    expect(report.body.report.disclaimer).toContain('not legal advice')
    store.close()
  })

  it('records Hermes approvals locally when forwarding is not configured', async () => {
    const { app, store } = testDeps()

    const approval = await request(app).post('/api/hermes/runs/run-1/approval').send({ approved: true })

    expect(approval.status).toBe(200)
    expect(approval.body).toMatchObject({ runId: 'run-1', status: 'accepted', forwarded: false })
    store.close()
  })

  it('forwards Hermes approvals when HERMES_BASE_URL is configured', async () => {
    const { app, config, store } = testDeps()
    config.hermes.baseUrl = 'http://127.0.0.1:8650/'
    config.hermes.apiKey = 'local-hermes-key'
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchFn)

    const approval = await request(app).post('/api/hermes/runs/run-2/approval').send({ approved: true })

    expect(approval.status).toBe(200)
    expect(approval.body).toMatchObject({ runId: 'run-2', status: 'accepted', forwarded: true })
    expect(fetchFn).toHaveBeenCalledOnce()
    const [url, init] = fetchFn.mock.calls[0] as [string | URL | Request, RequestInit | undefined]
    expect(url).toBe('http://127.0.0.1:8650/runs/run-2/approval')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer local-hermes-key' })
    store.close()
  })

  it('returns a redacted 502 when Hermes approval forwarding fails', async () => {
    const { app, config, store } = testDeps()
    config.hermes.baseUrl = 'http://127.0.0.1:8650/'
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bearer sk-test-secret leaked', { status: 503 })))

    const approval = await request(app).post('/api/hermes/runs/run-3/approval').send({ approved: true })

    expect(approval.status).toBe(502)
    expect(approval.body.error).toContain('Hermes approval forwarding failed')
    expect(approval.body.detail).toContain('Bearer [redacted]')
    expect(approval.body.detail).not.toContain('sk-test-secret')
    store.close()
  })
})

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for condition.')
}
