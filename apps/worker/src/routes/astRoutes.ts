import { Hono } from 'hono'
import type { Env } from '../types/env.js'
import {
    IngressSceneASTSchema,
    IngressDialogueLineSchema,
} from '../schemas/dialogueAst.schema.js'
import { validateAgainstFirewall } from '../lib/structuralValidator.js'

export const astRoutes = new Hono<{ Bindings: Env }>()

astRoutes.post('/validate', async (c) => {
    let rawBody: unknown
    try {
        rawBody = await c.req.json()
    } catch {
        return c.json(
            {
                type: 'https://tools.ietf.org/html/rfc7807',
                title: 'Structural Firewall Validation Failure',
                status: 400,
                detail: 'Malformed JSON payload.',
                invalidProperties: [
                    {
                        path: '/',
                        message: 'Invalid JSON syntax in request body.',
                        value: null,
                        type: 'SYNTAX_ERROR',
                    },
                ],
            },
            400,
        )
    }

    const result = validateAgainstFirewall(IngressSceneASTSchema, rawBody)
    if (!result.success) {
        return c.json(result.errorEnvelope, result.statusCode)
    }

    const sceneAst = result.data

    return c.json({
        status: 'INGRESS_SCHEMA_VALIDATED',
        sceneId: sceneAst.sceneId,
        totalLines: sceneAst.dialogueLines.length,
        state_snapshot_hash: sceneAst.state_snapshot_hash,
        validatedAtMs: Date.now(),
    })
})

astRoutes.post('/validate-line', async (c) => {
    let rawBody: unknown
    try {
        rawBody = await c.req.json()
    } catch {
        return c.json(
            {
                type: 'https://tools.ietf.org/html/rfc7807',
                title: 'Structural Firewall Validation Failure',
                status: 400,
                detail: 'Malformed JSON payload.',
                invalidProperties: [],
            },
            400,
        )
    }

    const result = validateAgainstFirewall(IngressDialogueLineSchema, rawBody)
    if (!result.success) {
        return c.json(result.errorEnvelope, result.statusCode)
    }

    return c.json({
        status: 'DIALOGUE_LINE_VALIDATED',
        line: result.data,
    })
})
