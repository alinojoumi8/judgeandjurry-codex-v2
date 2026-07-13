import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { z } from 'zod'

import type { AppConfig } from './config.js'
import type { CourtroomAgentRuntime } from './agentRuntime.js'
import { hermesProfiles } from './hermes.js'
import { CourtroomStore } from './db.js'
import { extractEvidenceText } from './evidence.js'
import { TrialEventBus } from './events.js'
import { trialStages } from './stages.js'
import { TrialService } from './trialService.js'

export interface AppDependencies {
  config: AppConfig
  store: CourtroomStore
  runtime: CourtroomAgentRuntime
  events: TrialEventBus
  trialService: TrialService
}

const matterSchema = z.object({
  title: z.string().trim().min(1),
  jurisdiction: z.string().trim().min(1).default('Ontario / Canada'),
  narrative: z.string().trim().min(1),
})

const actionSchema = z.object({
  title: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1),
  role: z.string().trim().min(1).optional(),
  evidenceId: z.string().trim().min(1).optional(),
})

const controlSchema = z.object({
  content: z.string().trim().min(1).optional(),
})

function asyncHandler(
  handler: (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) => Promise<void>,
) {
  return (request: express.Request, response: express.Response, next: express.NextFunction) => {
    void handler(request, response, next).catch(next)
  }
}

export function createApp(deps: AppDependencies): express.Express {
  const app = express()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: deps.config.maxUploadBytes },
  })

  app.use(cors({ origin: true }))
  app.use(express.json({ limit: '5mb' }))

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, provider: providerStatus(deps) })
  })

  app.get('/api/state', (_request, response) => {
    response.json(workspaceState(deps))
  })

  app.get('/api/run-options', (_request, response) => {
    response.json({
      stages: trialStages,
      profiles: hermesProfiles,
      provider: providerStatus(deps),
    })
  })

  app.get('/api/hermes/profiles', (_request, response) => {
    response.json({ profiles: hermesProfiles, provider: providerStatus(deps) })
  })

  app.post('/api/hermes/runs/:id/approval', asyncHandler(async (request, response) => {
    const runId = request.params.id
    if (!deps.config.hermes.baseUrl) {
      response.json({
        runId,
        status: 'accepted',
        forwarded: false,
        note: 'Approval recorded locally. Configure HERMES_BASE_URL to forward approvals to Hermes.',
      })
      return
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (deps.config.hermes.apiKey) {
      headers.Authorization = `Bearer ${deps.config.hermes.apiKey}`
    }
    const hermesUrl = `${deps.config.hermes.baseUrl.replace(/\/+$/, '')}/runs/${runId}/approval`
    const hermesResponse = await fetch(hermesUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request.body ?? {}),
    }).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : 'Hermes request failed.'
      response.status(502).json({
        error: 'Hermes approval forwarding failed.',
        detail: redactDetail(detail),
      })
      return null
    })
    if (!hermesResponse) return

    if (!hermesResponse.ok) {
      const body = await hermesResponse.text().catch(() => '')
      response.status(502).json({
        error: `Hermes approval forwarding failed with ${hermesResponse.status}.`,
        detail: redactDetail(body),
      })
      return
    }

    const body = await hermesResponse.json().catch(() => ({ status: 'accepted' }))
    response.json({ runId, status: 'accepted', forwarded: true, hermes: body })
  }))

  app.get('/api/matters', (_request, response) => {
    response.json({ matters: deps.store.listMatters() })
  })

  app.post('/api/matters', (request, response) => {
    const input = matterSchema.parse(request.body)
    const matter = deps.store.createMatter(input)
    response.status(201).json({ matter })
  })

  app.post('/api/matters/:id/evidence', upload.single('file'), asyncHandler(async (request, response) => {
    const matterId = String(request.params.id)
    const file = request.file
    if (!file) {
      response.status(400).json({ error: 'Upload a file field named file.' })
      return
    }

    deps.store.getMatter(matterId)
    const extracted = await extractEvidenceText(file.originalname, file.mimetype, file.buffer)
    const evidence = deps.store.addEvidence({
      matterId,
      name: file.originalname,
      type: extracted.type,
      mimeType: file.mimetype,
      size: file.size,
      text: extracted.text,
      summary: extracted.summary,
    })
    response.status(201).json({ evidence })
  }))

  app.post('/api/trials', (request, response) => {
    const schema = z.object({ matterId: z.string().trim().min(1) })
    const { matterId } = schema.parse(request.body)
    deps.store.getMatter(matterId)
    const trial = deps.trialService.createTrial(matterId)
    response.status(201).json({ trial })
  })

  app.get('/api/trials/:id', (request, response) => {
    response.json({ trial: deps.store.getTrial(request.params.id) })
  })

  app.post('/api/trials/:id/start', (request, response) => {
    response.json({ trial: deps.trialService.startTrial(request.params.id) })
  })

  app.get('/api/trials/:id/events', (request, response) => {
    const trialId = request.params.id
    deps.store.getTrial(trialId)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders?.()

    for (const event of deps.store.listEvents(trialId)) {
      response.write(`event: trial.event\ndata: ${JSON.stringify(event)}\n\n`)
    }

    const unsubscribe = deps.events.subscribe(trialId, (event) => {
      response.write(`event: trial.event\ndata: ${JSON.stringify(event)}\n\n`)
    })
    const heartbeat = setInterval(() => {
      response.write(': heartbeat\n\n')
    }, 20_000)

    request.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })

  app.post('/api/trials/:id/actions/object', (request, response) => {
    const input = actionSchema.parse(request.body)
    const event = deps.store.appendEvent(request.params.id, {
      type: 'objection.raised',
      stage: deps.store.getTrial(request.params.id).currentStage,
      role: 'defence',
      title: input.title ?? 'Objection',
      content: input.content,
    })
    deps.events.publish(event)
    response.status(201).json({ event })
  })

  app.post('/api/trials/:id/actions/rule', (request, response) => {
    const input = actionSchema.parse(request.body)
    const event = deps.store.appendEvent(request.params.id, {
      type: 'ruling.issued',
      stage: deps.store.getTrial(request.params.id).currentStage,
      role: 'judge',
      title: input.title ?? 'Ruling',
      content: input.content,
    })
    deps.events.publish(event)
    response.status(201).json({ event })
  })

  app.post('/api/trials/:id/actions/admit-exhibit', (request, response) => {
    const input = actionSchema.parse(request.body)
    if (!input.evidenceId) {
      response.status(400).json({ error: 'evidenceId is required.' })
      return
    }
    const evidence = deps.store.setEvidenceStatus(input.evidenceId, 'admitted')
    const event = deps.store.appendEvent(request.params.id, {
      type: 'exhibit.admitted',
      stage: deps.store.getTrial(request.params.id).currentStage,
      role: 'evidence_clerk',
      title: `${evidence.exhibitId} admitted`,
      content: input.content,
      citations: [{ exhibitId: evidence.exhibitId, evidenceId: evidence.id, label: evidence.name }],
    })
    deps.events.publish(event)
    response.status(201).json({ evidence, event })
  })

  app.post('/api/trials/:id/actions/call-witness', (request, response) => {
    const input = actionSchema.parse(request.body)
    const event = deps.store.appendEvent(request.params.id, {
      type: 'witness.called',
      stage: deps.store.getTrial(request.params.id).currentStage,
      role: 'witness',
      title: input.title ?? 'Witness Called',
      content: input.content,
    })
    deps.events.publish(event)
    response.status(201).json({ event })
  })

  app.post('/api/trials/:id/pause', (request, response) => {
    const input = controlSchema.parse(request.body)
    const result = deps.trialService.pauseTrial(request.params.id, input.content)
    response.status(201).json(result)
  })

  app.post('/api/trials/:id/advance', (request, response) => {
    const trial = deps.trialService.advanceTrial(request.params.id)
    response.status(202).json({ trial, note: 'Trial engine resumed from the next pending stage.' })
  })

  app.get('/api/trials/:id/report', (request, response) => {
    const trial = deps.store.getTrial(request.params.id)
    const verdict =
      trial.events.findLast((event) => event.type === 'transcript.turn' && event.stage === 'verdict') ??
      trial.events.findLast((event) => event.type === 'verdict.ready')
    response.json({
      trial,
      report: {
        title: 'Judge & Jury Verdict Report',
        generatedAt: new Date().toISOString(),
        verdict: verdict?.content ?? 'Verdict has not been generated yet.',
        disclaimer: 'Decision-support simulation only. This is not legal advice or a binding court outcome.',
      },
    })
  })

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    response.status(400).json({ error: message.replace(/Bearer\s+\S+/g, 'Bearer [redacted]') })
  })

  return app
}

function workspaceState(deps: AppDependencies) {
  const matters = deps.store.listMatters()
  const activeMatter = matters[0] ?? null
  const trials = activeMatter ? deps.store.listTrials(activeMatter.id) : deps.store.listTrials()
  return {
    matters,
    activeMatter,
    evidence: activeMatter ? deps.store.listEvidence(activeMatter.id) : [],
    trials,
    activeTrial: trials[0] ?? null,
    provider: providerStatus(deps),
    profiles: hermesProfiles,
  }
}

function providerStatus(deps: AppDependencies) {
  return deps.runtime.getStatus()
}

function redactDetail(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[redacted]')
    .slice(0, 240)
}
