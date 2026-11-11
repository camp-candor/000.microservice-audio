import type {
  MotivationReactionUnitType,
  MruPauseEnvelope,
  SeriesLexiconDictionary,
  CadenceAuditRecord,
} from './dialogue.interface.js'

export interface CadenceEvaluationPayload {
  seriesSlug: string
  characterId: string
  requestedCadence: string
  bannedCadences?: string[]
}

export interface CadenceEvaluationResult {
  status: 'PERMITTED' | 'BANNED_CADENCE_BREACH'
  characterId: string
  evaluatedCadence: string
  matchedBannedPattern?: string
  error?: string
}

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
  cadenceResult?: CadenceEvaluationResult
  error?: string
}

export default interface DialogueBit {
  idx: string
  src?: string
  val?: number
  dat?: DialectNormalizationPayload | CadenceEvaluationPayload
  cadenceResult?: CadenceEvaluationResult
  result?: DialectNormalizationResult
  slv?: (result: { dlgBit: DialogueBit }) => void
}
