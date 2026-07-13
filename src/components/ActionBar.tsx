import { FastForward, Gavel, Hand, Pause, UserPlus } from 'lucide-react'
import { useState } from 'react'

interface ActionBarProps {
  disabled: boolean
  pauseDisabled: boolean
  advanceDisabled: boolean
  onPause: (content: string) => Promise<void>
  onObject: (content: string) => Promise<void>
  onRule: (content: string) => Promise<void>
  onCallWitness: (content: string) => Promise<void>
  onAdvance: () => Promise<void>
}

export function ActionBar({
  disabled,
  pauseDisabled,
  advanceDisabled,
  onPause,
  onObject,
  onRule,
  onCallWitness,
  onAdvance,
}: ActionBarProps) {
  const [note, setNote] = useState('Foundation is unclear; request a ruling on admissibility.')

  return (
    <footer className="action-bar" aria-label="Court controls">
      <label>
        Court note
        <input value={note} onChange={(event) => setNote(event.target.value)} disabled={disabled} />
      </label>
      <button type="button" disabled={pauseDisabled} onClick={() => void onPause(note)}>
        <Pause size={18} aria-hidden="true" />
        Pause
      </button>
      <button type="button" disabled={disabled} onClick={() => void onObject(note)}>
        <Hand size={18} aria-hidden="true" />
        Object
      </button>
      <button type="button" disabled={disabled} onClick={() => void onRule(note)}>
        <Gavel size={18} aria-hidden="true" />
        Rule
      </button>
      <button type="button" disabled={disabled} onClick={() => void onCallWitness(note)}>
        <UserPlus size={18} aria-hidden="true" />
        Call witness
      </button>
      <button type="button" disabled={advanceDisabled} onClick={() => void onAdvance()}>
        <FastForward size={18} aria-hidden="true" />
        Advance
      </button>
    </footer>
  )
}
