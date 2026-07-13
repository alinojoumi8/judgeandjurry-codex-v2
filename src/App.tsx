import { useEffect, useMemo, useState } from 'react'

import type { TrialEvent, TrialSession, WorkspaceState } from '../shared/types'
import {
  admitExhibit,
  advanceTrial,
  createAndStartTrial,
  createMatter,
  getTrialReport,
  getState,
  pauseTrial,
  postTrialAction,
  uploadEvidence,
} from './api'
import { ActionBar } from './components/ActionBar'
import { CaseIntake } from './components/CaseIntake'
import { EvidenceBinder } from './components/EvidenceBinder'
import { ProviderPanel } from './components/ProviderPanel'
import { RoleMap } from './components/RoleMap'
import { StageRail } from './components/StageRail'
import { Transcript } from './components/Transcript'
import { VerdictPanel } from './components/VerdictPanel'
import { useTrialEvents } from './hooks/useTrialEvents'
import { deriveTrialView } from './trialView'
import './App.css'

function App() {
  const [state, setState] = useState<WorkspaceState | null>(null)
  const [trial, setTrial] = useState<TrialSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const liveEvents = useTrialEvents(trial?.id ?? state?.activeTrial?.id ?? null)

  const persistedTrial = trial ?? state?.activeTrial ?? null
  const matter = state?.activeMatter ?? null
  const evidence = state?.evidence ?? []
  const provider = state?.provider
  const profiles = state?.profiles ?? []
  const allEvents = useMemo(() => mergeEvents(persistedTrial?.events ?? [], liveEvents), [persistedTrial, liveEvents])
  const activeTrial = useMemo(() => deriveTrialView(persistedTrial, allEvents), [persistedTrial, allEvents])
  const trialActionsDisabled = !activeTrial || busy || activeTrial.status !== 'running'
  const pauseDisabled = !activeTrial || busy || activeTrial.status !== 'running'
  const advanceDisabled = !activeTrial || busy || activeTrial.status !== 'paused'
  const completedStageIds = useMemo(
    () =>
      new Set(
        allEvents
          .filter((event) => event.type === 'transcript.turn' && event.stage)
          .map((event) => event.stage as string),
      ),
    [allEvents],
  )
  const activeRole = allEvents.findLast((event) => event.role)?.role ?? activeTrial?.events.findLast((event) => event.role)?.role ?? null

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    const next = await getState()
    setState(next)
    setTrial(next.activeTrial)
  }

  async function runMutation(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  async function exportReport() {
    if (!activeTrial) throw new Error('Start a trial first.')
    const report = await getTrialReport(activeTrial.id)
    const blob = new Blob([JSON.stringify(report.report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${filenameSafe(report.trial.id)}-verdict-report.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={`app-shell ${activeTrial ? 'has-action-bar' : ''}`}>
      <header className="top-bar">
        <div>
          <span className="brand-mark" aria-hidden="true">
            J&J
          </span>
          <div>
            <strong>Judge & Jury</strong>
            <small>Hermes courtroom simulation powered by MiniMax-M3</small>
          </div>
        </div>
        <div className="top-status">
          <span>{activeTrial?.status ?? 'ready'}</span>
          <span>{provider?.model ?? 'MiniMax-M3'}</span>
        </div>
      </header>

      <StageRail currentStage={activeTrial?.currentStage ?? null} completedStageIds={completedStageIds} />

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="workspace-grid">
        <div className="left-stack">
          <RoleMap profiles={profiles} activeRole={activeRole} currentStage={activeTrial?.currentStage ?? null} />
          <CaseIntake
            matter={matter}
            busy={busy}
            onCreateMatter={(input) =>
              runMutation(async () => {
                await createMatter(input)
                await refresh()
              })
            }
            onUpload={(file) =>
              runMutation(async () => {
                if (!matter) throw new Error('Create a matter first.')
                await uploadEvidence(matter.id, file)
                await refresh()
              })
            }
            onStartTrial={() =>
              runMutation(async () => {
                if (!matter) throw new Error('Create a matter first.')
                const started = await createAndStartTrial(matter.id)
                setTrial(started.trial)
              })
            }
          />
        </div>

        <Transcript events={allEvents} />

        <div className="right-stack">
          {provider ? <ProviderPanel provider={provider} trial={activeTrial} /> : null}
          <EvidenceBinder
            evidence={evidence}
            trialId={activeTrial?.id ?? null}
            onAdmit={(evidenceId) =>
              runMutation(async () => {
                if (!activeTrial) throw new Error('Start a trial first.')
                await admitExhibit(activeTrial.id, evidenceId, 'Exhibit admitted for simulation use.')
                await refresh()
              })
            }
          />
          <VerdictPanel
            trial={activeTrial}
            events={allEvents}
            onExportReport={() => runMutation(exportReport)}
          />
        </div>
      </div>

      {activeTrial ? (
        <ActionBar
          disabled={trialActionsDisabled}
          pauseDisabled={pauseDisabled}
          advanceDisabled={advanceDisabled}
          onPause={(content) =>
            runMutation(async () => {
              await pauseTrial(activeTrial.id, content)
              await refresh()
            })
          }
          onObject={(content) =>
            runMutation(async () => {
              await postTrialAction(activeTrial.id, 'object', content)
            })
          }
          onRule={(content) =>
            runMutation(async () => {
              await postTrialAction(activeTrial.id, 'rule', content)
            })
          }
          onCallWitness={(content) =>
            runMutation(async () => {
              await postTrialAction(activeTrial.id, 'call-witness', content)
            })
          }
          onAdvance={() =>
            runMutation(async () => {
              const advanced = await advanceTrial(activeTrial.id)
              setTrial(advanced.trial)
              await refresh()
            })
          }
        />
      ) : null}
    </div>
  )
}

function filenameSafe(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

function mergeEvents(persisted: TrialEvent[], live: TrialEvent[]): TrialEvent[] {
  const byId = new Map<string, TrialEvent>()
  for (const event of [...persisted, ...live]) byId.set(event.id, event)
  return Array.from(byId.values()).toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export default App
