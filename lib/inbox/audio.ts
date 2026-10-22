/** Voice notes in the inbox. Pure (the page reads it; lib/ai/transcribe.ts writes the transcription). */
export const TRANSCRIBED_PREFIX = '🎤 Nota de voz (transcrita):'

/** A voice note from the contact that has no text yet (never transcribed, or the transcription failed). */
export function needsTranscriptionLabel(m: { direction: string; mediaUrl?: string | null; mediaType?: string | null; body: string }) {
  return m.direction === 'INBOUND' && Boolean(m.mediaUrl) && (m.mediaType ?? '').toLowerCase().startsWith('audio') && !m.body.startsWith(TRANSCRIBED_PREFIX)
}
