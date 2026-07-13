import dotenv from 'dotenv'

dotenv.config()

type RoleMap = Record<string, string>

export interface AppConfig {
  host: string
  port: number
  dbPath: string
  maxUploadBytes: number
  minimax: {
    apiKey: string
    baseUrl: string
    disabled: boolean
    model: string
    mock: boolean
    serviceTier: 'standard' | 'priority'
    timeoutMs: number
  }
  hermes: {
    baseUrl: string
    apiKey: string
    required: boolean
    profileUrls: RoleMap
    profileApiKeys: RoleMap
    profileModels: RoleMap
  }
}

export function loadConfig(): AppConfig {
  return {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 5174),
    dbPath: process.env.JUDGE_JURY_DB_PATH || 'data/judge-jury.sqlite',
    maxUploadBytes: Number(process.env.JUDGE_JURY_MAX_UPLOAD_BYTES || 250 * 1024 * 1024),
    minimax: {
      apiKey: process.env.MINIMAX_API_KEY || '',
      baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
      disabled: boolEnv(process.env.MINIMAX_DISABLED),
      model: process.env.MINIMAX_MODEL || 'MiniMax-M3',
      mock: process.env.MINIMAX_MOCK === '1',
      serviceTier: process.env.MINIMAX_SERVICE_TIER === 'priority' ? 'priority' : 'standard',
      timeoutMs: Number(process.env.MINIMAX_TIMEOUT_MS || 90_000),
    },
    hermes: {
      baseUrl: process.env.HERMES_BASE_URL || '',
      apiKey: process.env.HERMES_API_KEY || '',
      required: boolEnv(process.env.HERMES_REQUIRED),
      profileUrls: parseRoleMap('HERMES_PROFILE_URLS', /^HERMES_PROFILE_([A-Z0-9_]+)_URL$/),
      profileApiKeys: parseRoleMap(
        'HERMES_PROFILE_API_KEYS',
        /^HERMES_PROFILE_([A-Z0-9_]+)_API_KEY$/,
      ),
      profileModels: parseRoleMap('HERMES_PROFILE_MODELS', /^HERMES_PROFILE_([A-Z0-9_]+)_MODEL$/),
    },
  }
}

export function redactSecret(value: string): string {
  if (!value) return ''
  if (value.length <= 8) return '[redacted]'
  return `${value.slice(0, 3)}...[redacted]...${value.slice(-3)}`
}

function boolEnv(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function parseRoleMap(jsonEnvName: string, roleEnvPattern: RegExp): RoleMap {
  const roleMap: RoleMap = {}
  const raw = process.env[jsonEnvName]

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      for (const [role, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value.trim()) {
          roleMap[normalizeRole(role)] = value.trim()
        }
      }
    } catch {
      for (const part of raw.split(',')) {
        const [role, ...valueParts] = part.split('=')
        const value = valueParts.join('=').trim()
        if (role?.trim() && value) {
          roleMap[normalizeRole(role)] = value
        }
      }
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(roleEnvPattern)
    if (match?.[1] && value?.trim()) {
      roleMap[normalizeRole(match[1])] = value.trim()
    }
  }

  return roleMap
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase()
}
