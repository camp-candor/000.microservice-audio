import fs from 'node:fs'
import path from 'node:path'
import { DialogueModel } from '../dialogue.model.js'
import type DialogueBit from '../fce/dialogue.bit.js'
import type {
    DialectNormalizationPayload,
    CadenceEvaluationPayload,
    CadenceEvaluationResult,
} from '../fce/dialogue.bit.js'
import type {
    MotivationReactionUnitType,
    MruPauseEnvelope,
    SeriesLexiconDictionary,
    CadenceAuditRecord,
} from '../fce/dialogue.interface.js'
import type State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (
    ste: State | undefined,
    src: string,
): Promise<void> => {
    // Library-owned console actions must be hunted on the master LIBRARY bus;
    // hunting them on the package bus never settles (no library slv attached).
    if (global.LIBRARY && typeof global.LIBRARY.hunt === 'function') {
        await global.LIBRARY.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(
            () => {},
        )
        return
    }
    if (ste && typeof ste.hunt === 'function') {
        await ste.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(() => {})
    }
}

/**
 * Normalizes cadence tokens into upper-case standardized comparison representations.
 */
export const normalizeCadenceToken = (cadence: string): string => {
    return cadence
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_')
}

/**
 * Evaluates whether a requested prosodic cadence is strictly prohibited by character recipes.
 */
export const assertAllowedCadence = (
    requestedCadence?: string,
    bannedCadences?: string[],
): CadenceEvaluationResult => {
    if (!requestedCadence || !requestedCadence.trim()) {
        return {
            status: 'PERMITTED',
            characterId: 'unknown',
            evaluatedCadence: 'DEFAULT',
        }
    }

    const normalizedRequest = normalizeCadenceToken(requestedCadence)

    if (!bannedCadences || bannedCadences.length === 0) {
        return {
            status: 'PERMITTED',
            characterId: 'unknown',
            evaluatedCadence: normalizedRequest,
        }
    }

    for (const banned of bannedCadences) {
        const normalizedBanned = normalizeCadenceToken(banned)
        if (normalizedRequest === normalizedBanned) {
            throw new Error(
                `BANNED_CADENCE_BREACH: [${normalizedRequest}] matches prohibited cadence pattern [${normalizedBanned}].`,
            )
        }
    }

    return {
        status: 'PERMITTED',
        characterId: 'unknown',
        evaluatedCadence: normalizedRequest,
    }
}

/**
 * Safe evaluator for cadence feasibility that emits structured result without throwing.
 */
export const evaluateCadenceFeasibility = (
    characterId: string,
    requestedCadence: string,
    bannedCadences?: string[],
): CadenceEvaluationResult => {
    try {
        const res = assertAllowedCadence(requestedCadence, bannedCadences)
        return {
            status: 'PERMITTED',
            characterId,
            evaluatedCadence: res.evaluatedCadence,
        }
    } catch (err: any) {
        const normalizedRequest = normalizeCadenceToken(requestedCadence)
        return {
            status: 'BANNED_CADENCE_BREACH',
            characterId,
            evaluatedCadence: normalizedRequest,
            matchedBannedPattern: normalizedRequest,
            error: err instanceof Error ? err.message : String(err),
        }
    }
}

export const calculateMruPauseEnvelope = (
    mruType?: MotivationReactionUnitType,
): MruPauseEnvelope => {
    switch (mruType) {
        case 'stimulus':
            return {
                leadSilenceMs: 80,
                tailSilenceMs: 120,
                interPhraseMultiplier: 1.0,
            }
        case 'reflex':
            return {
                leadSilenceMs: 30,
                tailSilenceMs: 60,
                interPhraseMultiplier: 0.8,
            }
        case 'instinctive_reaction':
            return {
                leadSilenceMs: 150,
                tailSilenceMs: 180,
                interPhraseMultiplier: 1.25,
            }
        case 'rational_action':
            return {
                leadSilenceMs: 250,
                tailSilenceMs: 200,
                interPhraseMultiplier: 1.15,
            }
        default:
            return {
                leadSilenceMs: 100,
                tailSilenceMs: 100,
                interPhraseMultiplier: 1.0,
            }
    }
}

export const adaptPhonemeToEngine = (
    phoneme: string,
    lemma: string,
    targetEngine: string = 'styletts2',
): string => {
    switch (targetEngine) {
        case 'cosyvoice':
            return `<phoneme ph="${phoneme}">${lemma}</phoneme>`
        case 'piper':
            return phoneme.replace(/[^a-zA-Z0-9-]/g, '')
        case 'parler':
        case 'styletts2':
        default:
            return phoneme
    }
}

export const applyDialectLexicon = (
    text: string,
    lexicon: SeriesLexiconDictionary,
    targetEngine: string = 'styletts2',
): { normalizedText: string; phoneticCount: number; regexCount: number } => {
    let workingText = text
    let regexCount = 0
    let phoneticCount = 0

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
                // Defensive regex parsing
            }
        }
    }

    const tokenRegex = /([a-zA-Z0-9'-]+|[?!.,--]+|\s+)/g
    const rawTokens = workingText.match(tokenRegex) || [workingText]
    const rules = lexicon.phoneticRules || {}

    const normalizedTokens = rawTokens.map((token) => {
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

export const loadSeriesLexicon = (
    seriesSlug: string,
    customRoot?: string,
): SeriesLexiconDictionary => {
    const candidateRoots = [
        customRoot,
        path.resolve(
            process.cwd(),
            '../series-assets-audio/voices',
            seriesSlug,
        ),
        path.resolve(
            process.cwd(),
            '../../series-assets-audio/voices',
            seriesSlug,
        ),
        path.resolve(
            process.cwd(),
            'node_modules/@camp_candor/series-assets-audio/voices',
            seriesSlug,
        ),
    ].filter(Boolean) as string[]

    for (const root of candidateRoots) {
        const lexPath = path.resolve(root, 'lexicon.json')
        if (fs.existsSync(lexPath)) {
            const raw = fs.readFileSync(lexPath, 'utf8')
            const parsed = JSON.parse(raw)
            return {
                schemaVersion:
                    parsed.schema_version || parsed.schemaVersion || '2.0.0',
                seriesSlug:
                    parsed.series_slug || parsed.seriesSlug || seriesSlug,
                phoneticAlphabet:
                    parsed.phonetic_alphabet ||
                    parsed.phoneticAlphabet ||
                    'CUSTOM_STRESS_EXPANSION',
                phoneticRules:
                    parsed.phonetic_rules || parsed.phoneticRules || {},
                regexReplacements: (
                    parsed.regex_replacements ||
                    parsed.regexReplacements ||
                    []
                ).map((r: any) => ({
                    pattern: r.pattern,
                    replacement: r.replacement,
                    description: r.description,
                    caseSensitive: r.case_sensitive ?? r.caseSensitive ?? false,
                })),
                bannedPronunciations:
                    parsed.banned_pronunciations ||
                    parsed.bannedPronunciations ||
                    {},
            }
        }
    }

    return {
        schemaVersion: '2.0.0',
        seriesSlug,
        phoneticAlphabet: 'CUSTOM_STRESS_EXPANSION',
        phoneticRules: {},
        regexReplacements: [],
    }
}

export const initDialogue = (
    cpy: DialogueModel,
    bal: DialogueBit,
    _ste?: State,
): DialogueModel => {
    cpy.linesProcessed = 0
    cpy.cadenceAuditsCompleted = 0
    cpy.prohibitedBreachesDetected = 0
    cpy.cadenceAuditLog = []
    cpy.cachedLexicons = {}
    if (bal.slv) bal.slv({ dlgBit: { idx: 'init-dialogue', val: 1 } })
    return cpy
}

export const updateDialogue = (
    cpy: DialogueModel,
    bal: DialogueBit,
    _ste?: State,
): DialogueModel => {
    if (bal.idx) cpy.dialogueBits[bal.idx] = bal
    if (bal.slv) bal.slv({ dlgBit: bal })
    return cpy
}

export const auditProhibitedCadence = async (
    cpy: DialogueModel,
    bal: DialogueBit,
    ste?: State,
): Promise<DialogueModel> => {
    const payload = bal.dat as CadenceEvaluationPayload | undefined
    if (!payload || !payload.characterId || !payload.requestedCadence) {
        bal.cadenceResult = {
            status: 'BANNED_CADENCE_BREACH',
            characterId: payload?.characterId || 'unknown',
            evaluatedCadence: 'UNKNOWN',
            error: 'MISSING_CADENCE_AUDIT_PAYLOAD',
        }
        if (bal.slv) bal.slv({ dlgBit: bal })
        return cpy
    }

    const result = evaluateCadenceFeasibility(
        payload.characterId,
        payload.requestedCadence,
        payload.bannedCadences,
    )

    const record: CadenceAuditRecord = {
        characterId: payload.characterId,
        evaluatedCadence: result.evaluatedCadence,
        isPermitted: result.status === 'PERMITTED',
        matchedBannedPattern: result.matchedBannedPattern,
        timestampMs: Date.now(),
    }

    cpy.cadenceAuditLog.push(record)
    cpy.cadenceAuditsCompleted += 1
    bal.cadenceResult = result

    if (result.status === 'BANNED_CADENCE_BREACH') {
        cpy.prohibitedBreachesDetected += 1
        await logConsole(
            ste,
            `:: [FIREWALL:BREACH] Prohibited cadence [${result.evaluatedCadence}] intercepted for character [${payload.characterId}].`,
        )
    } else {
        await logConsole(
            ste,
            `>> [FIREWALL:OK] Requested cadence [${result.evaluatedCadence}] permitted for character [${payload.characterId}].`,
        )
    }

    if (bal.slv) bal.slv({ dlgBit: bal })
    return cpy
}

export const calculateMruPause = (
    cpy: DialogueModel,
    bal: DialogueBit,
    _ste?: State,
): DialogueModel => {
    const payload = bal.dat as DialectNormalizationPayload | undefined
    const mruType = payload?.mruType
    const envelope = calculateMruPauseEnvelope(mruType)

    if (bal.slv) {
        bal.slv({
            dlgBit: {
                idx: bal.idx,
                val: 1,
                result: {
                    status: 'EXPANDED',
                    seriesSlug: payload?.seriesSlug || 'unknown',
                    characterId: payload?.characterId || 'unknown',
                    originalText: payload?.rawDialogueText || '',
                    normalizedText: payload?.rawDialogueText || '',
                    phoneticReplacementsApplied: 0,
                    regexExpansionsApplied: 0,
                    pauseEnvelope: envelope,
                    targetEngine: payload?.targetEngine || 'styletts2',
                },
            },
        })
    }
    return cpy
}

export const assertCadenceFeasibility = (
    cpy: DialogueModel,
    bal: DialogueBit,
    _ste?: State,
): DialogueModel => {
    const payload = bal.dat as
        CadenceEvaluationPayload | DialectNormalizationPayload | undefined
    const charId = payload?.characterId || 'unknown'
    const cadence = payload?.requestedCadence || ''
    const banned = payload?.bannedCadences

    try {
        assertAllowedCadence(cadence, banned)
        bal.cadenceResult = {
            status: 'PERMITTED',
            characterId: charId,
            evaluatedCadence: normalizeCadenceToken(cadence),
        }
        if (bal.slv) bal.slv({ dlgBit: { idx: bal.idx, val: 1 } })
    } catch (err: any) {
        bal.cadenceResult = {
            status: 'BANNED_CADENCE_BREACH',
            characterId: charId,
            evaluatedCadence: normalizeCadenceToken(cadence),
            matchedBannedPattern: normalizeCadenceToken(cadence),
            error: err instanceof Error ? err.message : String(err),
        }
        if (bal.slv) {
            bal.slv({
                dlgBit: {
                    idx: bal.idx,
                    val: 0,
                    cadenceResult: bal.cadenceResult,
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
    const payload = bal.dat as DialectNormalizationPayload | undefined
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

    // Pre-synthesis cadence firewall gate
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
        await logConsole(ste, `:: [FIREWALL:BREACH] ${err.message}`)
        if (bal.slv) bal.slv({ dlgBit: bal })
        return cpy
    }

    const lexicon =
        payload.lexiconOverride ||
        cpy.cachedLexicons[payload.seriesSlug] ||
        loadSeriesLexicon(payload.seriesSlug)
    cpy.cachedLexicons[payload.seriesSlug] = lexicon

    const pauseEnvelope = calculateMruPauseEnvelope(payload.mruType)
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
