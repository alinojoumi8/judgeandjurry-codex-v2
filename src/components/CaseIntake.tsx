import { FormEvent, useState } from 'react'
import { FilePlus2, Play } from 'lucide-react'

import type { Matter } from '../../shared/types'

interface CaseIntakeProps {
  matter: Matter | null
  busy: boolean
  onCreateMatter: (input: { title: string; jurisdiction: string; narrative: string }) => Promise<void>
  onUpload: (file: File) => Promise<void>
  onStartTrial: () => Promise<void>
}

export function CaseIntake({ matter, busy, onCreateMatter, onUpload, onStartTrial }: CaseIntakeProps) {
  const [title, setTitle] = useState('R. v. Sample Accused')
  const [jurisdiction, setJurisdiction] = useState('Ontario / Canada')
  const [narrative, setNarrative] = useState(
    'The Crown alleges fraudulent misrepresentation connected to investor funds. Defence disputes intent, reliance, loss causation, and disclosure completeness.',
  )

  async function submitMatter(event: FormEvent) {
    event.preventDefault()
    await onCreateMatter({ title, jurisdiction, narrative })
  }

  return (
    <section className="panel case-intake" aria-label="Matter intake">
      <div className="panel-heading">
        <h2>Matter Intake</h2>
        <span>{matter ? 'active' : 'new'}</span>
      </div>
      {matter ? (
        <div className="active-matter">
          <strong>{matter.title}</strong>
          <span>{matter.jurisdiction}</span>
          <p>{matter.narrative}</p>
        </div>
      ) : (
        <form onSubmit={submitMatter} className="intake-form">
          <label>
            Matter title
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            Jurisdiction
            <input value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} />
          </label>
          <label>
            Narrative
            <textarea value={narrative} onChange={(event) => setNarrative(event.target.value)} rows={5} />
          </label>
          <button disabled={busy} type="submit">
            Create matter
          </button>
        </form>
      )}
      <div className="intake-actions">
        <label className="file-button">
          <FilePlus2 size={18} aria-hidden="true" />
          Upload evidence
          <input
            type="file"
            disabled={!matter || busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void onUpload(file)
              event.currentTarget.value = ''
            }}
          />
        </label>
        <button type="button" disabled={!matter || busy} onClick={() => void onStartTrial()}>
          <Play size={18} aria-hidden="true" />
          Start trial
        </button>
      </div>
    </section>
  )
}
