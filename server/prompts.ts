import type { EvidenceItem, Matter, TrialEvent, TrialStage } from '../shared/types.js'
import { roleLabel } from './stages.js'

export interface PromptContext {
  matter: Matter
  evidence: EvidenceItem[]
  previousEvents: TrialEvent[]
  stage: TrialStage
}

const roleRules: Record<string, string> = {
  crown:
    'You are Crown counsel. You are a fair public-interest prosecutor. Present the prosecution theory clearly, acknowledge proof gaps, and never argue merely to win.',
  defence:
    'You are defence counsel. Protect the accused position, test each element, identify reasonable doubt, and highlight disclosure or credibility gaps.',
  judge:
    'You are the judge. Stay neutral, control procedure, rule on the record, explain legal issues, and keep the jury focused on admitted evidence.',
  clerk:
    'You are the court clerk. Maintain a concise procedural record. Do not give legal advice or advocate.',
  evidence_clerk:
    'You are the evidence clerk. Mark exhibits, summarize what is in the record, and flag citation hygiene issues without advocating.',
  witness:
    'You are a witness. Answer only from your witness statement and admitted exhibits. If the record does not support the answer, say you do not know.',
  jury_orchestrator:
    'You coordinate juror reasoning. Jurors consider only admitted evidence, transcript turns, and the judge charge. Do not use private counsel strategy.',
}

const stageRules: Record<string, string> = {
  intake:
    'Normalize the matter into a courtroom record: parties, jurisdiction, allegations, live issues, and missing inputs.',
  evidence_room:
    'Summarize marked exhibits, note whether each appears admissible for simulation purposes, and list citation labels counsel should use.',
  charge_elements:
    'Identify the likely charges or issues, elements, burden, presumption of innocence, and what facts matter for each side.',
  crown_opening:
    'Give an opening statement from the Crown. Preview expected evidence without overclaiming proof.',
  defence_opening:
    'Give an opening statement from the defence. Preserve burden of proof and preview reasonable-doubt themes.',
  crown_direct:
    'Call the first Crown witness in simulation form. Ask focused examination-in-chief questions and provide record-anchored answers.',
  defence_cross:
    'Cross-examine the Crown witness. Test credibility, assumptions, contradictions, and missing corroboration.',
  motions:
    'Address likely objections or mid-trial motions, then rule neutrally with reasons tied to the record.',
  closings:
    'Generate closing submissions. Include both sides in the procedurally sensible order and separate facts from argument.',
  judge_charge:
    'Charge the jury: explain burden, presumption of innocence, elements, theories of each side, key evidence, and unanimity.',
  jury_private_votes:
    'Create a concise private juror note and initial vote pattern based only on admitted evidence and the judge charge.',
  jury_deliberation:
    'Simulate jury deliberation toward unanimity. Surface disagreements, evidence anchors, and whether unanimity is reached.',
  verdict:
    'Write the final decision-support verdict report with outcome, vote path, key evidence, unresolved issues, citation warnings, and disclaimer.',
}

export function buildMessages(context: PromptContext): Array<{ role: 'system' | 'user'; content: string }> {
  const role = roleLabel(context.stage.role)
  const record = formatRecord(context.previousEvents)
  const evidence = formatEvidence(context.evidence)

  return [
    {
      role: 'system',
      content: [
        'You are operating inside Judge & Jury, a courtroom simulation and legal decision-support app.',
        'This is not legal advice and not a binding court outcome.',
        roleRules[context.stage.role] ?? `You are ${role}.`,
        'Use only the provided court record and evidence. Cite exhibit IDs like E-001 when making factual claims.',
        'Do not reveal private strategy from one role to another. Keep reasoning concise and court-ready.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Stage: ${context.stage.label} (${context.stage.id})`,
        `Role: ${role}`,
        `Task: ${stageRules[context.stage.id]}`,
        '',
        'Matter:',
        `Title: ${context.matter.title}`,
        `Jurisdiction: ${context.matter.jurisdiction}`,
        context.matter.narrative,
        '',
        'Evidence:',
        evidence,
        '',
        'Court record so far:',
        record,
        '',
        'Return polished courtroom text. Include citations when relying on evidence. If proof is missing, say what is missing.',
      ].join('\n'),
    },
  ]
}

function formatEvidence(evidence: EvidenceItem[]): string {
  if (evidence.length === 0) {
    return 'No exhibits have been uploaded. Use the matter narrative only and flag evidentiary gaps.'
  }

  return evidence
    .map((item) => {
      const text = item.text || item.summary
      return [
        `${item.exhibitId} (${item.status}) ${item.name}`,
        item.summary,
        text.slice(0, 1_200),
      ].join('\n')
    })
    .join('\n\n')
}

function formatRecord(events: TrialEvent[]): string {
  const transcript = events
    .filter((event) => event.type === 'transcript.turn' || event.type === 'ruling.issued')
    .slice(-10)
    .map((event) => {
      return `${event.title} [${event.role ?? 'court'}]: ${event.content.slice(0, 1_200)}`
    })
    .join('\n\n')

  return transcript || 'No prior courtroom turns.'
}
