import { loadConfig, redactSecret } from './config.js'
import { createApp } from './app.js'
import { HermesBackedRuntime } from './agentRuntime.js'
import { CourtroomStore } from './db.js'
import { TrialEventBus } from './events.js'
import { MiniMaxProvider } from './minimax.js'
import { TrialService } from './trialService.js'

const config = loadConfig()
const store = new CourtroomStore(config.dbPath)
const provider = new MiniMaxProvider(config.minimax)
const runtime = new HermesBackedRuntime(config, provider)
const events = new TrialEventBus()
const trialService = new TrialService(store, runtime, events)
const app = createApp({ config, store, runtime, events, trialService })

app.listen(config.port, config.host, () => {
  const status = provider.getStatus()
  console.log(
    JSON.stringify({
      event: 'server.started',
      host: config.host,
      port: config.port,
      dbPath: config.dbPath,
      minimaxModel: status.model,
      minimaxBaseUrl: status.baseUrl,
      minimaxToken: redactSecret(config.minimax.apiKey),
      minimaxDisabled: config.minimax.disabled,
      minimaxMock: status.mock,
      hermesConfigured: Boolean(config.hermes.baseUrl || Object.keys(config.hermes.profileUrls).length),
      hermesRequired: config.hermes.required,
      hermesProfiles: Object.keys(config.hermes.profileUrls).toSorted(),
    }),
  )
})
