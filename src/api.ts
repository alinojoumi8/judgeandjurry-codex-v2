import type { EvidenceItem, TrialEvent, TrialSession, WorkspaceState } from '../shared/types'

export interface VerdictReportResponse {
  trial: TrialSession
  report: {
    title: string
    generatedAt: string
    verdict: string
    disclaimer: string
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(body.error ?? response.statusText)
  }
  return (await response.json()) as T
}

export function getState(): Promise<WorkspaceState> {
  return apiFetch<WorkspaceState>('/api/state')
}

export function createMatter(input: {
  title: string
  jurisdiction: string
  narrative: string
}): Promise<{ matter: WorkspaceState['activeMatter'] }> {
  return apiFetch('/api/matters', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function uploadEvidence(matterId: string, file: File): Promise<{ evidence: EvidenceItem }> {
  const form = new FormData()
  form.append('file', file)
  return apiFetch(`/api/matters/${matterId}/evidence`, {
    method: 'POST',
    body: form,
  })
}

export async function createAndStartTrial(matterId: string): Promise<{ trial: TrialSession }> {
  const created = await apiFetch<{ trial: TrialSession }>('/api/trials', {
    method: 'POST',
    body: JSON.stringify({ matterId }),
  })
  return apiFetch(`/api/trials/${created.trial.id}/start`, { method: 'POST' })
}

export function postTrialAction(
  trialId: string,
  action: 'object' | 'rule' | 'call-witness',
  content: string,
): Promise<{ event: TrialEvent }> {
  return apiFetch(`/api/trials/${trialId}/actions/${action}`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function pauseTrial(trialId: string, content: string): Promise<{ event: TrialEvent; trial: TrialSession }> {
  return apiFetch(`/api/trials/${trialId}/pause`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function advanceTrial(trialId: string): Promise<{ trial: TrialSession; note: string }> {
  return apiFetch(`/api/trials/${trialId}/advance`, { method: 'POST' })
}

export function admitExhibit(
  trialId: string,
  evidenceId: string,
  content: string,
): Promise<{ evidence: EvidenceItem; event: TrialEvent }> {
  return apiFetch(`/api/trials/${trialId}/actions/admit-exhibit`, {
    method: 'POST',
    body: JSON.stringify({ evidenceId, content }),
  })
}

export function getTrialReport(trialId: string): Promise<VerdictReportResponse> {
  return apiFetch(`/api/trials/${trialId}/report`)
}
