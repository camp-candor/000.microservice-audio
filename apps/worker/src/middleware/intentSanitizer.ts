import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/env.js'

const FORBIDDEN_COMMAND_KEYS = [
    'rawSql',
    'executeProcess',
    'overrideFencing',
    'bypassContinuity',
    'grantPrivilege',
    'dropDatabase',
    'execCommand',
    'evalScript',
]

const PURE_ASCII_REGEX = /^[\x20-\x7E\r\n\t]*$/

const scanPayloadForForbiddenKeys = (obj: any): string | null => {
    if (obj === null || typeof obj !== 'object') {
        return null
    }

    if (Array.isArray(obj)) {
        for (const item of obj) {
            const breach = scanPayloadForForbiddenKeys(item)
            if (breach) return breach
        }
        return null
    }

    for (const key of Object.keys(obj)) {
        if (FORBIDDEN_COMMAND_KEYS.includes(key)) {
            return key
        }
        const val = obj[key]
        if (typeof val === 'string' && !PURE_ASCII_REGEX.test(val)) {
            return `NON_ASCII_CHARACTER_DETECTED_IN_${key}`
        }
        const nestedBreach = scanPayloadForForbiddenKeys(val)
        if (nestedBreach) return nestedBreach
    }

    return null
}

export const intentSanitizer: MiddlewareHandler<{ Bindings: Env }> = async (
    c,
    next,
) => {
    if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
        const contentType = c.req.header('Content-Type') || ''
        if (contentType.includes('application/json')) {
            let body: any
            try {
                body = await c.req.raw.clone().json()
            } catch {
                return c.json(
                    {
                        error: {
                            code: 'MALFORMED_JSON_PAYLOAD',
                            message: 'Request body contains invalid JSON.',
                        },
                    },
                    400,
                )
            }

            const breach = scanPayloadForForbiddenKeys(body)
            if (breach) {
                return c.json(
                    {
                        error: {
                            code: 'FORBIDDEN_COMMAND_INJECTION',
                            message: `Imperative command injection rejected: [${breach}]. Direct state mutations are forbidden.`,
                        },
                    },
                    403,
                )
            }
        }
    }

    await next()
}
