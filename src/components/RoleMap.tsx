import { BadgeCheck, Gavel, Landmark, Scale, ScrollText, UsersRound, UserRound } from 'lucide-react'

import type { AgentRole, HermesProfile, TrialStageId } from '../../shared/types'

interface RoleMapProps {
  profiles: HermesProfile[]
  activeRole: AgentRole | null
  currentStage: TrialStageId | null
}

const iconByProfile: Record<string, typeof Scale> = {
  crown: Landmark,
  defence: Scale,
  judge: Gavel,
  clerk: ScrollText,
  evidence_clerk: BadgeCheck,
  witness: UserRound,
  jury_orchestrator: UsersRound,
}

export function RoleMap({ profiles, activeRole, currentStage }: RoleMapProps) {
  return (
    <aside className="panel role-map" aria-label="Courtroom roles">
      <div className="panel-heading">
        <h2>Courtroom</h2>
        <span>{currentStage ?? 'ready'}</span>
      </div>
      <div className="role-list">
        {profiles.map((profile) => {
          const Icon = iconByProfile[profile.id] ?? UserRound
          const active = profile.id === activeRole
          return (
            <div className={`role-row ${active ? 'active' : ''}`} key={profile.id}>
              <span className="role-icon">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span>
                <strong>{profile.label}</strong>
                <small>{profile.allowedEvidence}</small>
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
