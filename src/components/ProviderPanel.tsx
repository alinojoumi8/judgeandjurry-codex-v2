import { Activity, Cpu, ShieldCheck } from 'lucide-react'

import type { ProviderStatus, TrialSession } from '../../shared/types'

interface ProviderPanelProps {
  provider: ProviderStatus
  trial: TrialSession | null
}

export function ProviderPanel({ provider, trial }: ProviderPanelProps) {
  return (
    <section className="panel provider-panel" aria-label="Runtime status">
      <div className="panel-heading">
        <h2>Runtime</h2>
        <span>{provider.runtime}</span>
      </div>
      <div className="metric-row">
        <Cpu size={17} aria-hidden="true" />
        <span>{provider.model}</span>
      </div>
      <div className="metric-row">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>
          {provider.hermesRequired ? 'Hermes required' : `${provider.serviceTier} tier`}
        </span>
      </div>
      <div className="metric-row">
        <Activity size={17} aria-hidden="true" />
        <span>{trial?.totalTokens ?? 0} tokens</span>
      </div>
      <p className={provider.hermesConfigured ? 'status-good' : 'status-warning'}>
        {provider.hermesConfigured
          ? `${provider.hermesProfiles.length || 1} Hermes profile endpoint${(provider.hermesProfiles.length || 1) === 1 ? '' : 's'} configured`
          : 'Hermes not configured'}
      </p>
      <p className={provider.minimaxFallbackEnabled ? 'status-warning' : 'status-good'}>
        {provider.minimaxDisabled
          ? 'Direct MiniMax disabled'
          : provider.minimaxFallbackEnabled
            ? 'Direct MiniMax fallback enabled'
            : provider.hasToken
              ? 'MiniMax token loaded server-side'
              : 'MiniMax token missing; mock mode will run'}
      </p>
      {provider.lastError ? <p className="status-error">{provider.lastError}</p> : null}
    </section>
  )
}
