/**
 * Shared editor-only helpers for semantic confirmation history.
 *
 * This module is intentionally not imported by the production crop bridges.
 * Confirmation history is a safety net for the workbench; the generated
 * runtime records continue to contain only the currently applied transform.
 */

/** Maximum number of immutable confirmation snapshots kept for one slot. */
export const CONFIRMATION_HISTORY_LIMIT = 20 as const

/** Version of the editor-only history shape (independent from production schemas). */
export const CONFIRMATION_HISTORY_SCHEMA_VERSION = 1 as const

let idSequence = 0

/** Create a stable-enough client-side id without requiring crypto support. */
export const createConfirmationId = (prefix = 'confirmation'): string => {
  idSequence = (idSequence + 1) % 100000
  return `${prefix}-${Date.now().toString(36)}-${idSequence.toString(36)}`
}

/** Keep only meaningful non-empty strings when reading untrusted JSON. */
export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

/** Trim oldest entries while preserving chronological (oldest → newest) order. */
export const trimConfirmationHistory = <T>(entries: readonly T[]): T[] =>
  entries.slice(-CONFIRMATION_HISTORY_LIMIT)
