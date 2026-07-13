import { EventEmitter } from 'node:events'

import type { TrialEvent } from '../shared/types.js'

export class TrialEventBus {
  private readonly emitter = new EventEmitter()

  publish(event: TrialEvent): void {
    this.emitter.emit(event.trialId, event)
  }

  subscribe(trialId: string, listener: (event: TrialEvent) => void): () => void {
    this.emitter.on(trialId, listener)
    return () => this.emitter.off(trialId, listener)
  }
}
