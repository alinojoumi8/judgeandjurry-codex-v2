import { FileText, LockKeyhole, UnlockKeyhole } from 'lucide-react'

import type { EvidenceItem } from '../../shared/types'

interface EvidenceBinderProps {
  evidence: EvidenceItem[]
  trialId: string | null
  onAdmit: (evidenceId: string) => Promise<void>
}

export function EvidenceBinder({ evidence, trialId, onAdmit }: EvidenceBinderProps) {
  return (
    <aside className="panel evidence-binder" aria-label="Evidence binder">
      <div className="panel-heading">
        <h2>Evidence Binder</h2>
        <span>{evidence.length} exhibits</span>
      </div>
      <div className="evidence-list">
        {evidence.length === 0 ? <p className="empty-note">Upload disclosure, witness notes, or text exhibits.</p> : null}
        {evidence.map((item) => (
          <article className="evidence-item" key={item.id}>
            <div className="evidence-title">
              <FileText size={18} aria-hidden="true" />
              <strong>{item.exhibitId}</strong>
              <span>{item.status}</span>
            </div>
            <h3>{item.name}</h3>
            <p>{item.summary}</p>
            <button
              type="button"
              disabled={!trialId || item.status === 'admitted'}
              onClick={() => void onAdmit(item.id)}
            >
              {item.status === 'admitted' ? (
                <UnlockKeyhole size={16} aria-hidden="true" />
              ) : (
                <LockKeyhole size={16} aria-hidden="true" />
              )}
              {item.status === 'admitted' ? 'Admitted' : 'Admit'}
            </button>
          </article>
        ))}
      </div>
    </aside>
  )
}
