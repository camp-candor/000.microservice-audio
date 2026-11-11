import fs from 'node:fs'
import path from 'node:path'
import { DialogueModel } from '../dialogue.model.js'
import type DialogueBit from '../fce/dialogue.bit.js'
import type {
  DialectNormalizationPayload,
  DialectNormalizationResult,
} from '../fce/dialogue.bit.js'
import type {
  MotivationReactionUnitType,
  MruPauseEnvelope,
  SeriesLexiconDictionary,
} from '../fce/dialogue.interface.js'
import type State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (ste: State | undefined, src: string): Promise<void> => {
  if (ste && typeof ste.hunt === 'function') {
    await ste.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(() => {})
  }
}

/**
 * Calculates lead/tail padding and pause dilation multipliers from Dwight Swain MRU tags.
 */
export const calculateMruPauseEnvelope = (
  mruType?: MotivationReactionUnitType,
): MruPauseEnvelope => {
  switch (mruType) {
    case 'stimulus':
      // External event: brisk entry, natural decay
      return { leadSilenceMs: 80, tailSilenceMs: 120, interPhraseMultiplier: 1.0 }
    case 'reflex':
      // Visceral non-cognitive response: instantaneous attack, clipped hold
      return { leadSilenceMs: 30, tailSilenceMs: 60, interPhraseMultiplier: 0.8 }
    case 'instinctive_reaction':
      // Autonomic physical reaction: breathless gasp or hesitation
      return { leadSilenceMs: 150, tailSilenceMs: 180, interPhraseMultiplier: 1.25 }
    case 'rational_action':
      // Deliberate cognitive speech: thoughtful lead-in delay
      return { leadSilenceMs: 250, tailSilenceMs: 200, interPhraseMultiplier: 1.15 }
    default:
      return { leadSilenceMs: 100, tailSilenceMs: 100, interPhraseMultiplier: 1.0 }
  }
}

/**
 * Verifies that the requested prosodic delivery does not violate prohibited character cadences.
 */
export const assertAllowedCadence = (
  requestedCadence?: string,
  bannedCadences?: string[],
): void => {
  if (!requestedCadence || !bannedCadences || bannedCadences.length === 0) {
    return
  }

  const normalized = requestedCadence.trim().toUpperCase()
  for (const banned of bannedCadences) {
    if (normalized === banned.trim().toUpperCase()) {
      throw new Error(`BANNED_CADENCE_BREACH: [${normalized}] violates character somatic baseline.`)
    }
  }
}

/**
 * Formats phonetic representations for engine-specific acoustic runtimes.
 */
export const adaptPhonemeToEngine = (
  phoneme: string,
  lemma: string,
  targetEngine: string = 'styletts2',
): string => {
  switch (targetEngine) {
    case 'cosyvoice':
      // Wrap in structured SSML tags for flow-matching diffusion network
      return `<phoneme ph="${phoneme}">${lemma}</phoneme>`
    case 'piper':
      // Piper uses simplified lowercase/uppercase phonemic representations
      return phoneme.replace(/[^a-zA-Z0-9-]/g, '')
    case 'parler':
    case 'styletts2':
    default:
      // Syllable-stressed representation with hyphens and caps
      return phoneme
  }
}

/**
 * Executes the Four-Stage Pre-Inference Dialect Expansion and Phonetic Replacement pipeline.
 */
export const applyDialectLexicon = (
  text: string,
  lexicon: SeriesLexiconDictionary,
  targetEngine: string = 'styletts2',
): { normalizedText: string; phoneticCount: number; regexCount: number } => {
  let workingText = text
  let regexCount = 0
  let phoneticCount = 0

  // --------------------------------------------------------------------------
  // STAGE 1: PCRE Word-Bounded Regex Syntactic & Morphological Expansion
  // --------------------------------------------------------------------------
  if (Array.isArray(lexicon.regexReplacements)) {
    for (const rule of lexicon.regexReplacements) {
      try {
        const flags = rule.caseSensitive ? 'g' : 'gi'
        const regex = new RegExp(rule.pattern, flags)
        const matches = workingText.match(regex)
        if (matches) {
          workingText = workingText.replace(regex, rule.replacement)
          regexCount += matches.length
        }
      } catch {
        // Skip invalid regex pattern defensively without corrupting execution
      }
    }
  }

  // --------------------------------------------------------------------------
  // STAGE 2: Case-Insensitive Tokenization Preserving Prosodic Punctuation
  // --------------------------------------------------------------------------
  // Splits into words and prosodic tokens: (?, !, ., ,, --, --)
  const tokenRegex = /([a-zA-Z0-9'-]+|[?!.,--]+|\s+)/g
  const rawTokens = workingText.match(tokenRegex) || [workingText]

  // --------------------------------------------------------------------------
  // STAGE 3 & 4: Lexical Overrides & Engine-Specific Phoneme Adaptation
  // --------------------------------------------------------------------------
  const rules = lexicon.phoneticRules || {}
  const normalizedTokens = rawTokens.map((token) => {
    // Check if token is whitespace or prosodic punctuation
    if (/^[?!.,--\s]+$/.test(token)) {
      return token
    }

    const cleanLemma = token.toLowerCase().trim()
    if (Object.prototype.hasOwnProperty.call(rules, cleanLemma)) {
      phoneticCount++
      const targetPhoneme = rules[cleanLemma]
      return adaptPhonemeToEngine(targetPhoneme, token, targetEngine)
    }

    return token
  })

  return {
    normalizedText: normalizedTokens.join(''),
    phoneticCount,
    regexCount,
  }
}

/**
 * Loads voices/<seriesSlug>/lexicon.json directly from series-assets-audio.
 */
export const loadSeriesLexicon = (
  seriesSlug: string,
  customRoot?: string,
): SeriesLexiconDictionary => {
  const candidateRoots = [
    customRoot,
    path.resolve(process.cwd(), '../series-assets-audio/voices', seriesSlug),
    path.resolve(process.cwd(), '../../series-assets-audio/voices', seriesSlug),
    path.resolve(process.cwd(), 'node_modules/@camp_candor/series-assets-audio/voices', seriesSlug),
  ].filter(Boolean) as string[]

  for (const root of candidateRoots) {
    const lexPath = path.resolve(root, 'lexicon.json')
    if (fs.existsSync(lexPath)) {
      const raw = fs.readFileSync(lexPath, 'utf8')
      const parsed = JSON.parse(raw)
      return {
        schemaVersion: parsed.schema_version || parsed.schemaVersion || '2.0.0',
        seriesSlug: parsed.series_slug || parsed.seriesSlug || seriesSlug,
        phoneticAlphabet: parsed.phonetic_alphabet || parsed.phoneticAlphabet || 'CUSTOM_STRESS_EXPANSION',
        phoneticRules: parsed.phonetic_rules || parsed.phoneticRules || {},
        regexReplacements: (parsed.regex_replacements || parsed.regexReplacements || []).map((r: any) => ({
          pattern: r.pattern,
          replacement: r.replacement,
          description: r.description,
          caseSensitive: r.case_sensitive ?? r.caseSensitive ?? false,
        })),
        bannedPronunciations: parsed.banned_pronunciations || parsed.bannedPronunciations || {},
      }
    }
  }

  // Fallback neutral default dictionary
  return {
    schemaVersion: '2.0.0',
    seriesSlug,
    phoneticAlphabet: 'CUSTOM_STRESS_EXPANSION',
    phoneticRules: {},
    regexReplacements: [],
  }
}

export const initDialogue = (cpy: DialogueModel, bal: DialogueBit, _ste?: State): DialogueModel => {
  cpy.linesProcessed = 0
  cpy.cachedLexicons = {}
  if (bal.slv) bal.slv({ dlgBit: { idx: 'init-dialogue', val: 1 } })
  return cpy
}

export const updateDialogue = (cpy: DialogueModel, bal: DialogueBit, _ste?: State): DialogueModel => {
  if (bal.idx) cpy.dialogueBits[bal.idx] = bal
  if (bal.slv) bal.slv({ dlgBit: bal })
  return cpy
}

export const calculateMruPause = (cpy: DialogueModel, bal: DialogueBit, _ste?: State): DialogueModel => {
  const mruType = bal.dat?.mruType
  const envelope = calculateMruPauseEnvelope(mruType)

  if (bal.slv) {
    bal.slv({
      dlgBit: {
        idx: bal.idx,
        val: 1,
        result: {
          status: 'EXPANDED',
          seriesSlug: bal.dat?.seriesSlug || 'unknown',
          characterId: bal.dat?.characterId || 'unknown',
          originalText: bal.dat?.rawDialogueText || '',
          normalizedText: bal.dat?.rawDialogueText || '',
          phoneticReplacementsApplied: 0,
          regexExpansionsApplied: 0,
          pauseEnvelope: envelope,
          targetEngine: bal.dat?.targetEngine || 'styletts2',
        },
      },
    })
  }
  return cpy
}

export const assertCadenceFeasibility = (cpy: DialogueModel, bal: DialogueBit, _ste?: State): DialogueModel => {
  const payload = bal.dat
  try {
    assertAllowedCadence(payload?.requestedCadence, payload?.bannedCadences)
    if (bal.slv) bal.slv({ dlgBit: { idx: bal.idx, val: 1 } })
  } catch (err: any) {
    if (bal.slv) {
      bal.slv({
        dlgBit: {
          idx: bal.idx,
          val: 0,
          result: {
            status: 'BANNED_CADENCE_BREACH',
            seriesSlug: payload?.seriesSlug || 'unknown',
            characterId: payload?.characterId || 'unknown',
            originalText: payload?.rawDialogueText || '',
            normalizedText: '',
            phoneticReplacementsApplied: 0,
            regexExpansionsApplied: 0,
            pauseEnvelope: calculateMruPauseEnvelope(),
            targetEngine: payload?.targetEngine || 'styletts2',
            error: err.message,
          },
        },
      })
    }
  }
  return cpy
}

export const applyDialectG2p = async (
  cpy: DialogueModel,
  bal: DialogueBit,
  ste?: State,
): Promise<DialogueModel> => {
  const payload = bal.dat
  if (!payload || !payload.rawDialogueText) {
    bal.result = {
      status: 'BREACH',
      seriesSlug: payload?.seriesSlug || 'unknown',
      characterId: payload?.characterId || 'unknown',
      originalText: '',
      normalizedText: '',
      phoneticReplacementsApplied: 0,
      regexExpansionsApplied: 0,
      pauseEnvelope: calculateMruPauseEnvelope(),
      targetEngine: 'styletts2',
      error: 'MISSING_DIALOGUE_TEXT_PAYLOAD',
    }
    if (bal.slv) bal.slv({ dlgBit: bal })
    return cpy
  }

  // 1. Enforce compile-time banned cadence filter
  try {
    assertAllowedCadence(payload.requestedCadence, payload.bannedCadences)
  } catch (err: any) {
    bal.result = {
      status: 'BANNED_CADENCE_BREACH',
      seriesSlug: payload.seriesSlug,
      characterId: payload.characterId,
      originalText: payload.rawDialogueText,
      normalizedText: '',
      phoneticReplacementsApplied: 0,
      regexExpansionsApplied: 0,
      pauseEnvelope: calculateMruPauseEnvelope(payload.mruType),
      targetEngine: payload.targetEngine || 'styletts2',
      error: err.message,
    }
    await logConsole(ste, `:: [CADENCE:BREACH] ${err.message}`)
    if (bal.slv) bal.slv({ dlgBit: bal })
    return cpy
  }

  // 2. Resolve series lexicon
  const lexicon = payload.lexiconOverride || cpy.cachedLexicons[payload.seriesSlug] || loadSeriesLexicon(payload.seriesSlug)
  cpy.cachedLexicons[payload.seriesSlug] = lexicon

  // 3. Compute MRU pause envelope
  const pauseEnvelope = calculateMruPauseEnvelope(payload.mruType)

  // 4. Execute Four-Stage Pre-Inference Normalization
  const targetEngine = payload.targetEngine || 'styletts2'
  const { normalizedText, phoneticCount, regexCount } = applyDialectLexicon(
    payload.rawDialogueText,
    lexicon,
    targetEngine,
  )

  const isUnaltered = phoneticCount === 0 && regexCount === 0
  bal.result = {
    status: isUnaltered ? 'UNALTERED' : 'EXPANDED',
    seriesSlug: payload.seriesSlug,
    characterId: payload.characterId,
    originalText: payload.rawDialogueText,
    normalizedText,
    phoneticReplacementsApplied: phoneticCount,
    regexExpansionsApplied: regexCount,
    pauseEnvelope,
    targetEngine,
  }

  cpy.linesProcessed += 1

  await logConsole(
    ste,
    `>> [G2P:EXPAND] Processed line for [${payload.characterId}]: ${regexCount} regex, ${phoneticCount} phonetic overrides applied.`,
  )

  if (bal.slv) bal.slv({ dlgBit: bal })
  return cpy
}
