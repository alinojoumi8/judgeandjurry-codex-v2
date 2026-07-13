import { Radio, ScrollText } from 'lucide-react'

import type { TrialEvent } from '../../shared/types'

interface TranscriptProps {
  events: TrialEvent[]
}

export function Transcript({ events }: TranscriptProps) {
  const transcriptEvents = events.filter((event) =>
    ['stage.started', 'transcript.turn', 'objection.raised', 'ruling.issued', 'jury.vote', 'verdict.ready'].includes(
      event.type,
    ),
  )
  const liveDelta = events
    .filter((event) => event.type === 'agent.delta')
    .slice(-8)
    .map((event) => event.content)
    .join('')

  return (
    <main className="panel transcript-panel" aria-label="Live court transcript">
      <div className="panel-heading transcript-heading">
        <h1>Judge & Jury</h1>
        <span>
          <Radio size={15} aria-hidden="true" />
          live court record
        </span>
      </div>
      <div className="transcript-list">
        {transcriptEvents.length === 0 ? (
          <div className="empty-transcript">
            <ScrollText size={28} aria-hidden="true" />
            <p>Create a matter, upload evidence, and start the trial to open the record.</p>
          </div>
        ) : null}
        {transcriptEvents.map((event) => (
          <article className={`turn ${event.type.replace('.', '-')}`} key={event.id}>
            <div className="turn-meta">
              <span>{event.title}</span>
              <time>{new Date(event.createdAt).toLocaleTimeString()}</time>
            </div>
            <p>{event.content}</p>
            {event.citations.length > 0 ? (
              <div className="citation-row">
                {event.citations.map((citation) => (
                  <span key={`${event.id}-${citation.exhibitId}`}>{citation.exhibitId}</span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
        {liveDelta ? (
          <article className="turn streaming-line" aria-live="polite">
            <div className="turn-meta">
              <span>Streaming</span>
              <time>now</time>
            </div>
            <p>{liveDelta}</p>
          </article>
        ) : null}
      </div>
    </main>
  )
}
