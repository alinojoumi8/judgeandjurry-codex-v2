import { CheckCheck, Download, TriangleAlert } from 'lucide-react'

import type { TrialEvent, TrialSession } from '../../shared/types'

interface VerdictPanelProps {
  trial: TrialSession | null
  events: TrialEvent[]
  onExportReport: () => Promise<void>
}

export function VerdictPanel({ trial, events, onExportReport }: VerdictPanelProps) {
  const verdict = events.findLast((event) => event.stage === 'verdict' && event.type === 'transcript.turn')
  const ready = events.findLast((event) => event.type === 'verdict.ready')

  return (
    <section className="panel verdict-panel" aria-label="Verdict report">
      <div className="panel-heading">
        <h2>Verdict</h2>
        <div className="panel-actions">
          <span>{trial?.status ?? 'not started'}</span>
          <button type="button" disabled={!trial} onClick={() => void onExportReport()} title="Export verdict report">
            <Download size={16} aria-hidden="true" />
            Export
          </button>
        </div>
      </div>
      {verdict ? (
        <div className="verdict-ready">
          <CheckCheck size={22} aria-hidden="true" />
          <p>{verdict.content}</p>
        </div>
      ) : (
        <div className="verdict-waiting">
          <TriangleAlert size={20} aria-hidden="true" />
          <p>{ready?.content ?? 'The jury has not reached the verdict stage yet.'}</p>
        </div>
      )}
    </section>
  )
}
