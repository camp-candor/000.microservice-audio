import type DialogueBit from './dialogue.bit.js'

export type MotivationReactionUnitType =
    'stimulus' | 'reflex' | 'instinctive_reaction' | 'rational_action'

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

export interface CadenceAuditRecord {
    characterId: string
    evaluatedCadence: string
    isPermitted: boolean
    matchedBannedPattern?: string
    timestampMs: number
}

export default interface Dialogue {
    idx: string
    activeSeriesSlug: string
    cachedLexicons: Record<string, SeriesLexiconDictionary>
    linesProcessed: number
    cadenceAuditsCompleted: number
    prohibitedBreachesDetected: number
    cadenceAuditLog: CadenceAuditRecord[]
    dialogueBits: Record<string, DialogueBit>
}
