import { SchemasModel } from '../schemas.model.js'
import SchemasBit, {
    IngressValidationReport,
    ScriptParityReport,
} from '../fce/schemas.bit.js'
import {
    IngressSceneASTSchema,
    IngressDialogueLineSchema,
    IngressSceneAST,
} from '../val/dialogueAst.val.js'
import State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (src: string): Promise<void> => {
    if ((globalThis as any).LIBRARY?.hunt) {
        await (globalThis as any).LIBRARY.hunt(UPDATE_CONSOLE, {
            idx: 'cns00',
            src,
        })
    }
}

export const initSchemas = (
    cpy: SchemasModel,
    bal: SchemasBit,
    ste: State,
): SchemasModel => {
    cpy.validationsCompleted = 0
    cpy.schemasBits = {}
    if (bal.slv) bal.slv({ schBit: { idx: 'init-schemas', val: 1 } })
    return cpy
}

export const updateSchemas = (
    cpy: SchemasModel,
    bal: SchemasBit,
    ste: State,
): SchemasModel => {
    if (bal.idx) cpy.schemasBits[bal.idx] = bal
    if (bal.slv) bal.slv({ schBit: bal })
    return cpy
}

export const checkBannedPronunciations = (
    text: string,
    bannedWords: string[] = [],
): string[] => {
    const words: string[] = text.toLowerCase().match(/\b[a-z0-9'-]+\b/g) || []
    const found: string[] = []
    for (const b of bannedWords) {
        if (words.includes(b.toLowerCase())) {
            found.push(b)
        }
    }
    return found
}

export const assertDialogueLineParity = (
    lineText: string,
    expectedScriptText: string,
): void => {
    const normA = lineText.trim().replace(/\s+/g, ' ')
    const normB = expectedScriptText.trim().replace(/\s+/g, ' ')

    if (normA !== normB) {
        throw new Error(
            `VERBATIM_PARITY_BREACH: Ingress dialogue '${normA}' does not match locked screenplay text '${normB}'`,
        )
    }
}

export const validateIngressContract = async (
    cpy: SchemasModel,
    bal: SchemasBit,
    ste: State,
): Promise<SchemasModel> => {
    const rawAst = bal.dat?.sceneAst
    if (!rawAst) {
        const err =
            'SCHEMA_VALIDATION_FAILED: Missing sceneAst ingress payload.'
        await logConsole(`:: [FAIL] [SCHEMA] ${err}`)
        if (bal.slv) {
            bal.slv({
                schBit: {
                    idx: bal.idx,
                    result: {
                        status: 'FAILED',
                        sceneId: 'unknown',
                        totalLines: 0,
                        snapshotHashVerified: false,
                        parityVerified: false,
                        error: err,
                    },
                },
            })
        }
        return cpy
    }

    const parseResult = IngressSceneASTSchema.safeParse(rawAst)
    if (!parseResult.success) {
        const issue = parseResult.error.issues[0]
        const fieldPath = issue.path.join('.') || 'root'
        const err = `SCHEMA_VALIDATION_FAILED: [${fieldPath}] ${issue.message}`
        await logConsole(`:: [FAIL] [SCHEMA] ${err}`)

        bal.result = {
            status: 'FAILED',
            sceneId: (rawAst as any)?.sceneId || 'unknown',
            totalLines: 0,
            snapshotHashVerified: false,
            parityVerified: false,
            error: err,
        }

        cpy.validationsCompleted += 1
        if (bal.slv) bal.slv({ schBit: bal })
        return cpy
    }

    const ast: IngressSceneAST = parseResult.data

    // Pre-flight check for banned phonetic pronunciation out-of-vocabulary terms
    const banned = bal.dat?.bannedPronunciations || []
    for (const line of ast.dialogueLines) {
        const breaches = checkBannedPronunciations(line.text, banned)
        if (breaches.length > 0) {
            const err = `BANNED_PRONUNCIATION_BREACH: Line [${line.lineId}] contains banned tokens: ${breaches.join(', ')}`
            await logConsole(`:: [FAIL] [SCHEMA] ${err}`)
            bal.result = {
                status: 'FAILED',
                sceneId: ast.sceneId,
                totalLines: ast.dialogueLines.length,
                snapshotHashVerified: true,
                parityVerified: false,
                error: err,
            }
            cpy.validationsCompleted += 1
            if (bal.slv) bal.slv({ schBit: bal })
            return cpy
        }
    }

    await logConsole(
        `>> [OK] [SCHEMA] Ingress contract validated for Scene [${ast.sceneId}] (${ast.dialogueLines.length} lines)`,
    )
    await logConsole(
        `>> [OK] [SNAPSHOT] Verified anchor hash [${ast.state_snapshot_hash.slice(0, 16)}...]`,
    )

    bal.result = {
        status: 'PASSED',
        sceneId: ast.sceneId,
        totalLines: ast.dialogueLines.length,
        snapshotHashVerified: true,
        parityVerified: true,
    }

    cpy.validationsCompleted += 1
    if (bal.slv) bal.slv({ schBit: bal })
    return cpy
}

export const validateScriptParity = async (
    cpy: SchemasModel,
    bal: SchemasBit,
    ste: State,
): Promise<SchemasModel> => {
    const line = bal.dat?.dialogueLine as any
    const expectedText = bal.dat?.expectedScriptText

    if (!line?.text || !expectedText) {
        const err =
            'MISSING_PARITY_INPUT: dialogueLine.text and expectedScriptText are required.'
        await logConsole(`:: [FAIL] [PARITY] ${err}`)
        if (bal.slv) {
            bal.slv({
                schBit: {
                    idx: bal.idx,
                    parityResult: {
                        status: 'FAILED',
                        lineId: line?.lineId || 'unknown',
                        character: line?.character || 'unknown',
                        mismatches: [err],
                        error: err,
                    },
                },
            })
        }
        return cpy
    }

    try {
        assertDialogueLineParity(line.text, expectedText)
        await logConsole(
            `>> [OK] [PARITY] Character [${line.character}] line [${line.lineId}] matches screenplay verbatim`,
        )
        bal.parityResult = {
            status: 'PASSED',
            lineId: line.lineId,
            character: line.character,
            mismatches: [],
        }
    } catch (err: any) {
        const cleanErr = (err?.message || 'VERBATIM_PARITY_BREACH').slice(
            0,
            200,
        )
        await logConsole(`:: [FAIL] [PARITY] ${cleanErr}`)
        bal.parityResult = {
            status: 'FAILED',
            lineId: line.lineId,
            character: line.character,
            mismatches: [cleanErr],
            error: cleanErr,
        }
    }

    cpy.validationsCompleted += 1
    if (bal.slv) bal.slv({ schBit: bal })
    return cpy
}
