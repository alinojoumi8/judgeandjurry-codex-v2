import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

import type { EvidenceItem } from '../shared/types.js'

export async function extractEvidenceText(
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<{ type: EvidenceItem['type']; text: string; summary: string }> {
  const type = detectEvidenceType(filename, mimeType)
  let text = ''

  if (type === 'pdf') {
    try {
      const result = await pdfParse(buffer)
      text = result.text
    } catch {
      text = ''
    }
  } else if (type === 'docx') {
    try {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } catch {
      text = ''
    }
  } else if (type === 'text') {
    text = buffer.toString('utf8')
  }

  const normalized = normalizeText(text)
  const summary = normalized
    ? normalized.slice(0, 360)
    : 'Text extraction unavailable. Keep the original file available for manual review.'
  return { type, text: normalized, summary }
}

function detectEvidenceType(filename: string, mimeType: string): EvidenceItem['type'] {
  const lower = filename.toLowerCase()
  if (mimeType.includes('pdf') || lower.endsWith('.pdf')) return 'pdf'
  if (
    mimeType.includes('wordprocessingml') ||
    mimeType.includes('msword') ||
    lower.endsWith('.docx')
  ) {
    return 'docx'
  }
  if (mimeType.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.md')) return 'text'
  if (mimeType.startsWith('image/')) return 'image'
  return 'other'
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
