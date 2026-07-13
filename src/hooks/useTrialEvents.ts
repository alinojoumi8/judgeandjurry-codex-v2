import { useEffect, useState } from 'react'

import type { TrialEvent } from '../../shared/types'

export function useTrialEvents(trialId: string | null): TrialEvent[] {
  const [events, setEvents] = useState<TrialEvent[]>([])

  useEffect(() => {
    setEvents([])
    if (!trialId) return

    const source = new EventSource(`/api/trials/${trialId}/events`)
    source.addEventListener('trial.event', (message) => {
      const event = JSON.parse((message as MessageEvent).data) as TrialEvent
      setEvents((current) => {
        if (current.some((item) => item.id === event.id)) return current
        return [...current, event]
      })
    })
    source.addEventListener('error', () => {
      source.close()
    })

    return () => source.close()
  }, [trialId])

  return events
}
