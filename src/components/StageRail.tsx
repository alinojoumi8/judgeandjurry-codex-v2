import { CheckCircle2, CircleDot, Clock3 } from 'lucide-react'

import type { TrialStageId } from '../../shared/types'
import { stages } from '../stageData'

interface StageRailProps {
  currentStage: TrialStageId | null
  completedStageIds: Set<string>
}

export function StageRail({ currentStage, completedStageIds }: StageRailProps) {
  return (
    <nav className="stage-rail" aria-label="Trial stages">
      {stages.map((stage) => {
        const active = stage.id === currentStage
        const completed = completedStageIds.has(stage.id)
        const Icon = completed ? CheckCircle2 : active ? CircleDot : Clock3
        return (
          <div className={`stage-pill ${active ? 'active' : ''} ${completed ? 'done' : ''}`} key={stage.id}>
            <Icon size={16} aria-hidden="true" />
            <span>{stage.label}</span>
          </div>
        )
      })}
    </nav>
  )
}
