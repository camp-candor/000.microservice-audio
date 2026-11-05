import type { TSchema, Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

export interface ValidationErrorDetail {
    readonly path: string
    readonly message: string
    readonly value: unknown
    readonly type: string
}

export interface ValidationSuccess<T> {
    readonly success: true
    readonly data: T
}

export interface ValidationFailure {
    readonly success: false
    readonly statusCode: 400
    readonly errorEnvelope: {
        readonly type: 'https://tools.ietf.org/html/rfc7807'
        readonly title: 'Structural Firewall Validation Failure'
        readonly status: 400
        readonly detail: string
        readonly invalidProperties: readonly ValidationErrorDetail[]
    }
}

export type ValidationOutcome<T> = ValidationSuccess<T> | ValidationFailure

/**
 * Validates untrusted input payload against an edge TypeBox schema.
 * Operates purely via interpreted AST traversal (Value.Check) safe for CF Worker isolates.
 */
export function validateAgainstFirewall<T extends TSchema>(
    schema: T,
    payload: unknown,
): ValidationOutcome<Static<T>> {
    if (
        typeof payload !== 'object' ||
        payload === null ||
        Array.isArray(payload)
    ) {
        return {
            success: false,
            statusCode: 400,
            errorEnvelope: {
                type: 'https://tools.ietf.org/html/rfc7807',
                title: 'Structural Firewall Validation Failure',
                status: 400,
                detail: 'Inbound payload must be a non-null, non-array JSON Object.',
                invalidProperties: [
                    {
                        path: '/',
                        message: 'Expected type: object',
                        value: payload,
                        type: 'TYPE_ERROR',
                    },
                ],
            },
        }
    }

    const isValid = Value.Check(schema, payload)

    if (isValid) {
        return {
            success: true,
            data: payload as Static<T>,
        }
    }

    const errors = [...Value.Errors(schema, payload)]
    const invalidProperties: ValidationErrorDetail[] = errors.map((err) => ({
        path: err.path || '/',
        message: err.message,
        value: err.value,
        type: String(err.type),
    }))

    return {
        success: false,
        statusCode: 400,
        errorEnvelope: {
            type: 'https://tools.ietf.org/html/rfc7807',
            title: 'Structural Firewall Validation Failure',
            status: 400,
            detail: `Payload breached structural invariants. Identified ${invalidProperties.length} violation(s).`,
            invalidProperties,
        },
    }
}
