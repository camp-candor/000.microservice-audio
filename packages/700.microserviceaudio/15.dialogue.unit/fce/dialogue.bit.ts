import type {
  MotivationReactionUnitType,
  MruPauseEnvelope,
  SeriesLexiconDictionary,
} from './dialogue.interface.js'

export interface DialectNormalizationPayload {
  seriesSlug: string
  characterId: string
  rawDialogueText: string
  mruType?: MotivationReactionUnitType
  requestedCadence?: string
  targetEngine?: 'styletts2' | 'parler' | 'piper' | 'cosyvoice' | 'kokoro'
  bannedCadences?: string[]
  lexiconOverride?: SeriesLexiconDictionary
}

export interface DialectNormalizationResult {
  status: 'EXPANDED' | 'UNALTERED' | 'BANNED_CADENCE_BREACH' | 'BREACH'
  seriesSlug: string
  characterId: string
  originalText: string
  normalizedText: string
  phoneticReplacementsApplied: number
  regexExpansionsApplied: number
  pauseEnvelope: MruPauseEnvelope
  targetEngine: string
  error?: string
}

export default interface DialogueBit {
  idx: string
  src?: string
  val?: number
  dat?: DialectNormalizationPayload
  result?: DialectNormalizationResult
  slv?: (result: { dlgBit: DialogueBit }) => void
}
