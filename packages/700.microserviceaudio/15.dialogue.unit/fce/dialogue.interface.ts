import type DialogueBit from './dialogue.bit.js'

export type MotivationReactionUnitType =
  | 'stimulus'
  | 'reflex'
  | 'instinctive_reaction'
  | 'rational_action'

export interface RegexReplacementRule {
  pattern: string
  replacement: string
  description?: string
  caseSensitive?: boolean
}

export interface SeriesLexiconDictionary {
  schemaVersion: string
  seriesSlug: string
  phoneticAlphabet: string
  phoneticRules: Record<string, string>
  regexReplacements: RegexReplacementRule[]
  bannedPronunciations?: Record<string, string[]>
}

export interface MruPauseEnvelope {
  leadSilenceMs: number
  tailSilenceMs: number
  interPhraseMultiplier: number
}

export default interface Dialogue {
  idx: string
  activeSeriesSlug: string
  cachedLexicons: Record<string, SeriesLexiconDictionary>
  linesProcessed: number
  dialogueBits: Record<string, DialogueBit>
}
