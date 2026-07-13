import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import type {
  AgentRole,
  CitationRef,
  EvidenceItem,
  Matter,
  ProviderStatus,
  TrialEvent,
  TrialEventType,
  TrialSession,
  TrialStageId,
  TrialStatus,
} from '../shared/types.js'
import { nowIso } from './time.js'

type Row = Record<string, unknown>

export interface CreateMatterInput {
  title: string
  jurisdiction: string
  narrative: string
}

export interface AddEvidenceInput {
  matterId: string
  name: string
  type: EvidenceItem['type']
  mimeType: string
  size: number
  text: string
  summary: string
}

export interface AppendEventInput {
  type: TrialEventType
  stage?: TrialStageId | null
  role?: AgentRole | null
  title: string
  content: string
  citations?: CitationRef[]
  metadata?: Record<string, unknown>
}

export class CourtroomStore {
  private readonly db: DatabaseSync

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(resolve(dbPath)), { recursive: true })
    }
    this.db = new DatabaseSync(dbPath)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.migrate()
  }

  close(): void {
    this.db.close()
  }

  createMatter(input: CreateMatterInput): Matter {
    const id = randomUUID()
    const createdAt = nowIso()
    this.db
      .prepare(
        `INSERT INTO matters (id, title, jurisdiction, narrative, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.title, input.jurisdiction, input.narrative, createdAt, createdAt)
    return this.getMatter(id)
  }

  listMatters(): Matter[] {
    return this.db
      .prepare('SELECT * FROM matters ORDER BY created_at DESC')
      .all()
      .map((row) => this.rowToMatter(row as Row))
  }

  getMatter(id: string): Matter {
    const row = this.db.prepare('SELECT * FROM matters WHERE id = ?').get(id) as Row | undefined
    if (!row) {
      throw new Error(`Matter not found: ${id}`)
    }
    return this.rowToMatter(row)
  }

  addEvidence(input: AddEvidenceInput): EvidenceItem {
    const id = randomUUID()
    const exhibitId = this.nextExhibitId(input.matterId)
    const uploadedAt = nowIso()
    this.db
      .prepare(
        `INSERT INTO evidence_items
         (id, matter_id, exhibit_id, name, type, mime_type, size, text, summary, status, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.matterId,
        exhibitId,
        input.name,
        input.type,
        input.mimeType,
        input.size,
        input.text,
        input.summary,
        'marked',
        uploadedAt,
      )
    return this.getEvidence(id)
  }

  listEvidence(matterId: string): EvidenceItem[] {
    return this.db
      .prepare('SELECT * FROM evidence_items WHERE matter_id = ? ORDER BY exhibit_id')
      .all(matterId)
      .map((row) => this.rowToEvidence(row as Row))
  }

  getEvidence(id: string): EvidenceItem {
    const row = this.db
      .prepare('SELECT * FROM evidence_items WHERE id = ?')
      .get(id) as Row | undefined
    if (!row) {
      throw new Error(`Evidence not found: ${id}`)
    }
    return this.rowToEvidence(row)
  }

  setEvidenceStatus(id: string, status: EvidenceItem['status']): EvidenceItem {
    this.db.prepare('UPDATE evidence_items SET status = ? WHERE id = ?').run(status, id)
    return this.getEvidence(id)
  }

  createTrial(matterId: string, provider: Pick<ProviderStatus, 'model' | 'serviceTier'>): TrialSession {
    const id = randomUUID()
    const createdAt = nowIso()
    this.db
      .prepare(
        `INSERT INTO trial_sessions
         (id, matter_id, status, current_stage, provider_model, provider_tier, total_tokens, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, matterId, 'draft', null, provider.model, provider.serviceTier, 0, createdAt, null)
    return this.getTrial(id)
  }

  listTrials(matterId?: string): TrialSession[] {
    const rows = matterId
      ? this.db
          .prepare('SELECT * FROM trial_sessions WHERE matter_id = ? ORDER BY created_at DESC')
          .all(matterId)
      : this.db.prepare('SELECT * FROM trial_sessions ORDER BY created_at DESC').all()
    return rows.map((row) => this.rowToTrial(row as Row))
  }

  getTrial(id: string): TrialSession {
    const row = this.db
      .prepare('SELECT * FROM trial_sessions WHERE id = ?')
      .get(id) as Row | undefined
    if (!row) {
      throw new Error(`Trial not found: ${id}`)
    }
    return this.rowToTrial(row)
  }

  updateTrialStatus(id: string, status: TrialStatus, currentStage?: TrialStageId | null): TrialSession {
    const completedAt = status === 'completed' || status === 'failed' ? nowIso() : null
    this.db
      .prepare(
        `UPDATE trial_sessions
         SET status = ?, current_stage = COALESCE(?, current_stage), completed_at = COALESCE(?, completed_at)
         WHERE id = ?`,
      )
      .run(status, currentStage ?? null, completedAt, id)
    return this.getTrial(id)
  }

  setCurrentStage(id: string, stage: TrialStageId): void {
    this.db
      .prepare('UPDATE trial_sessions SET status = ?, current_stage = ? WHERE id = ?')
      .run('running', stage, id)
  }

  addUsage(id: string, tokens: number): void {
    this.db
      .prepare('UPDATE trial_sessions SET total_tokens = total_tokens + ? WHERE id = ?')
      .run(Math.max(0, Math.round(tokens)), id)
  }

  appendEvent(trialId: string, input: AppendEventInput): TrialEvent {
    const id = randomUUID()
    const createdAt = nowIso()
    this.db
      .prepare(
        `INSERT INTO trial_events
         (id, trial_id, type, stage, role, title, content, citations_json, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        trialId,
        input.type,
        input.stage ?? null,
        input.role ?? null,
        input.title,
        input.content,
        JSON.stringify(input.citations ?? []),
        JSON.stringify(input.metadata ?? {}),
        createdAt,
      )
    return this.getEvent(id)
  }

  listEvents(trialId: string): TrialEvent[] {
    return this.db
      .prepare('SELECT * FROM trial_events WHERE trial_id = ? ORDER BY created_at, rowid')
      .all(trialId)
      .map((row) => this.rowToEvent(row as Row))
  }

  getEvent(id: string): TrialEvent {
    const row = this.db.prepare('SELECT * FROM trial_events WHERE id = ?').get(id) as Row | undefined
    if (!row) {
      throw new Error(`Event not found: ${id}`)
    }
    return this.rowToEvent(row)
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS matters (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        narrative TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS evidence_items (
        id TEXT PRIMARY KEY,
        matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
        exhibit_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        text TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL,
        uploaded_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trial_sessions (
        id TEXT PRIMARY KEY,
        matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        current_stage TEXT,
        provider_model TEXT NOT NULL,
        provider_tier TEXT NOT NULL,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS trial_events (
        id TEXT PRIMARY KEY,
        trial_id TEXT NOT NULL REFERENCES trial_sessions(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        stage TEXT,
        role TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        citations_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS role_memories (
        id TEXT PRIMARY KEY,
        trial_id TEXT NOT NULL REFERENCES trial_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        scope TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_evidence_matter ON evidence_items(matter_id);
      CREATE INDEX IF NOT EXISTS idx_trial_matter ON trial_sessions(matter_id);
      CREATE INDEX IF NOT EXISTS idx_events_trial ON trial_events(trial_id, created_at);
    `)
  }

  private nextExhibitId(matterId: string): string {
    const row = this.db
      .prepare('SELECT COUNT(*) AS count FROM evidence_items WHERE matter_id = ?')
      .get(matterId) as { count: number }
    return `E-${String(row.count + 1).padStart(3, '0')}`
  }

  private rowToMatter(row: Row): Matter {
    return {
      id: String(row.id),
      title: String(row.title),
      jurisdiction: String(row.jurisdiction),
      narrative: String(row.narrative),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
  }

  private rowToEvidence(row: Row): EvidenceItem {
    return {
      id: String(row.id),
      matterId: String(row.matter_id),
      exhibitId: String(row.exhibit_id),
      name: String(row.name),
      type: row.type as EvidenceItem['type'],
      mimeType: String(row.mime_type),
      size: Number(row.size),
      text: String(row.text),
      summary: String(row.summary),
      status: row.status as EvidenceItem['status'],
      uploadedAt: String(row.uploaded_at),
    }
  }

  private rowToTrial(row: Row): TrialSession {
    const id = String(row.id)
    return {
      id,
      matterId: String(row.matter_id),
      status: row.status as TrialStatus,
      currentStage: (row.current_stage as TrialStageId | null) ?? null,
      providerModel: String(row.provider_model),
      providerTier: String(row.provider_tier),
      totalTokens: Number(row.total_tokens),
      createdAt: String(row.created_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      events: this.listEvents(id),
    }
  }

  private rowToEvent(row: Row): TrialEvent {
    return {
      id: String(row.id),
      trialId: String(row.trial_id),
      type: row.type as TrialEventType,
      stage: (row.stage as TrialStageId | null) ?? null,
      role: (row.role as AgentRole | null) ?? null,
      title: String(row.title),
      content: String(row.content),
      citations: JSON.parse(String(row.citations_json)) as CitationRef[],
      metadata: JSON.parse(String(row.metadata_json)) as Record<string, unknown>,
      createdAt: String(row.created_at),
    }
  }
}
