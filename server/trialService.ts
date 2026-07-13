import type { AgentRole, EvidenceItem, TrialEvent, TrialSession, TrialStage } from '../shared/types.js'
import { CourtroomStore } from './db.js'
import { TrialEventBus } from './events.js'
import { buildMessages } from './prompts.js'
import { roleLabel, trialStages } from './stages.js'
import type { CourtroomAgentRuntime } from './agentRuntime.js'

export class TrialService {
  private readonly activeRuns = new Set<string>()

  constructor(
    private readonly store: CourtroomStore,
    private readonly runtime: CourtroomAgentRuntime,
    private readonly events: TrialEventBus,
  ) {}

  createTrial(matterId: string): TrialSession {
    const status = this.runtime.getStatus()
    return this.store.createTrial(matterId, {
      model: status.model,
      serviceTier: status.serviceTier,
    })
  }

  startTrial(trialId: string): TrialSession {
    const trial = this.store.updateTrialStatus(trialId, 'running', 'intake')
    this.queueExecution(trialId)
    return trial
  }

  pauseTrial(trialId: string, content = 'Courtroom simulation paused by court control.'): {
    event: TrialEvent
    trial: TrialSession
  } {
    const current = this.store.getTrial(trialId)
    if (current.status === 'completed' || current.status === 'failed') {
      throw new Error(`Cannot pause a ${current.status} trial.`)
    }

    this.store.updateTrialStatus(trialId, 'paused', current.currentStage)
    const event = this.record(trialId, {
      type: 'trial.paused',
      stage: current.currentStage,
      role: 'clerk',
      title: 'Trial Paused',
      content,
    })
    return { event, trial: this.store.getTrial(trialId) }
  }

  advanceTrial(trialId: string): TrialSession {
    const current = this.store.getTrial(trialId)
    if (current.status === 'completed' || current.status === 'failed') {
      throw new Error(`Cannot advance a ${current.status} trial.`)
    }

    const nextStage = nextPendingStage(current.events)
    const trial = this.store.updateTrialStatus(trialId, 'running', nextStage?.id ?? current.currentStage ?? 'intake')
    this.queueExecution(trialId)
    return trial
  }

  async executeTrial(trialId: string): Promise<void> {
    const trial = this.store.getTrial(trialId)
    const matter = this.store.getMatter(trial.matterId)
    const evidence = this.store.listEvidence(matter.id)

    try {
      for (const stage of trialStages.slice(nextStageIndex(trial.events))) {
        const current = this.store.getTrial(trialId)
        if (current.status === 'paused' || current.status === 'completed' || current.status === 'failed') {
          return
        }

        this.store.setCurrentStage(trialId, stage.id)
        this.record(trialId, {
          type: 'stage.started',
          stage: stage.id,
          role: stage.role,
          title: stage.label,
          content: `${roleLabel(stage.role)} has the floor.`,
          metadata: { stage },
        })

        const previousEvents = this.store.listEvents(trialId)
        const messages = buildMessages({ matter, evidence, previousEvents, stage })
        const content = await this.streamStage(trialId, stage, messages)

        this.record(trialId, {
          type: 'transcript.turn',
          stage: stage.id,
          role: stage.role,
          title: `${roleLabel(stage.role)} - ${stage.label}`,
          content,
          citations: citationRefsFromContent(content, evidence),
          metadata: { hermesProfile: stage.role },
        })

        if (stage.id === 'jury_private_votes') {
          for (const vote of jurorVotes(content)) {
            this.record(trialId, {
              type: 'jury.vote',
              stage: stage.id,
              role: vote.role,
              title: `${roleLabel(vote.role)} initial vote`,
              content: vote.rationale,
              metadata: { leaning: vote.leaning, confidence: vote.confidence },
            })
          }
        }

        if (this.store.getTrial(trialId).status === 'paused') {
          return
        }
      }

      this.record(trialId, {
        type: 'verdict.ready',
        stage: 'verdict',
        role: 'judge',
        title: 'Verdict Report Ready',
        content:
          'Decision-support verdict generated. Review citations, unresolved issues, and disclaimer before relying on this simulation.',
        metadata: { disclaimer: 'Not legal advice and not a binding court outcome.' },
      })
      this.store.updateTrialStatus(trialId, 'completed', 'verdict')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Trial execution failed.'
      this.record(trialId, {
        type: 'trial.failed',
        stage: this.store.getTrial(trialId).currentStage,
        role: 'clerk',
        title: 'Trial Paused',
        content: message,
      })
      this.store.updateTrialStatus(trialId, 'failed')
    }
  }

  private async streamStage(
    trialId: string,
    stage: TrialStage,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ): Promise<string> {
    let content = ''
    let totalTokens = 0

    for await (const chunk of this.runtime.streamTurn({ stage, messages })) {
      if (chunk.content) {
        content += chunk.content
        this.events.publish({
          id: `delta-${trialId}-${stage.id}-${Date.now()}`,
          trialId,
          type: 'agent.delta',
          stage: stage.id,
          role: stage.role,
          title: `${roleLabel(stage.role)} streaming`,
          content: chunk.content,
          citations: [],
          metadata: {},
          createdAt: new Date().toISOString(),
        })
      }

      if (chunk.usage?.total_tokens) {
        totalTokens = chunk.usage.total_tokens
      }
    }

    if (totalTokens > 0) {
      this.store.addUsage(trialId, totalTokens)
      this.record(trialId, {
        type: 'usage.reported',
        stage: stage.id,
        role: 'clerk',
        title: 'Provider Usage',
        content: `${totalTokens} tokens reported for ${stage.label}.`,
        metadata: { totalTokens },
      })
    }

    return content.trim()
  }

  private record(trialId: string, input: Parameters<CourtroomStore['appendEvent']>[1]): TrialEvent {
    const event = this.store.appendEvent(trialId, input)
    this.events.publish(event)
    return event
  }

  private queueExecution(trialId: string): void {
    if (this.activeRuns.has(trialId)) return
    this.activeRuns.add(trialId)
    setTimeout(() => {
      void this.executeTrial(trialId).finally(() => {
        this.activeRuns.delete(trialId)
      })
    }, 0)
  }
}

function citationRefsFromContent(content: string, evidence: EvidenceItem[]) {
  const ids = new Set(content.match(/E-\d{3}/g) ?? [])
  return evidence
    .filter((item) => ids.has(item.exhibitId))
    .map((item) => ({
      exhibitId: item.exhibitId,
      evidenceId: item.id,
      label: item.name,
    }))
}

function nextPendingStage(events: TrialEvent[]): TrialStage | null {
  return trialStages[nextStageIndex(events)] ?? null
}

function nextStageIndex(events: TrialEvent[]): number {
  const completedStages = new Set(
    events
      .filter((event) => event.type === 'transcript.turn' && event.stage)
      .map((event) => event.stage),
  )
  const index = trialStages.findIndex((stage) => !completedStages.has(stage.id))
  return index === -1 ? trialStages.length : index
}

function jurorVotes(seed: string): Array<{
  role: AgentRole
  leaning: 'crown' | 'defence' | 'mixed'
  confidence: number
  rationale: string
}> {
  const leanings: Array<'crown' | 'defence' | 'mixed'> = ['crown', 'defence', 'mixed']
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0

  return Array.from({ length: 12 }, (_, index) => {
    const leaning = leanings[(hash + index) % leanings.length]
    const confidence = 58 + ((hash + index * 7) % 31)
    return {
      role: `juror_${String(index + 1).padStart(2, '0')}` as AgentRole,
      leaning,
      confidence,
      rationale: `Initial ${leaning} leaning at ${confidence}% confidence, subject to deliberation and judge instructions.`,
    }
  })
}
