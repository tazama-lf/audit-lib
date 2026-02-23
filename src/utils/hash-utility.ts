// SPDX-License-Identifier: Apache-2.0
import crypto from 'node:crypto';
import type { AuditLogData, AuditLogDocument } from './interfaces/audit';

const EMPTY_ARRAY_LENGTH = 0;

/**
 * Recursively converts a value to a canonical string representation.
 * Ensures consistent ordering of object keys at all nesting levels.
 *
 * @param value - The value to canonicalize
 * @returns Canonical string representation
 */
function canonicalize(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    // Escape special characters to prevent delimiter injection
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort();
    const pairs = sortedKeys.map((key) => {
      const objValue = (value as Record<string, unknown>)[key];
      return `${JSON.stringify(key)}:${canonicalize(objValue)}`;
    });
    return `{${pairs.join(',')}}`;
  }
  // Handle any remaining edge cases (functions, symbols, etc.) by using JSON stringify
  return JSON.stringify(value);
}

/**
 * Computes a SHA-256 hash of the audit log data object for integrity verification.
 * The hash is computed using a recursive canonical form that ensures consistent
 * ordering of keys at all nesting levels and prevents delimiter injection attacks.
 *
 * @param data - The audit log data object to hash
 * @returns SHA-256 hash as a 64-character hex string
 */
export function computeLogHash(data: AuditLogData): string {
  // Convert to canonical form using recursive key sorting
  const canonicalString = canonicalize(data);

  // Compute SHA-256 hash
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Verifies the integrity of an audit log by recomputing its hash.
 *
 * @param logDocument - The complete audit log document to verify
 * @returns true if the hash matches, false if tampered
 */
export function verifyLogHash(logDocument: AuditLogDocument): boolean {
  const recomputedHash = computeLogHash(logDocument.data);
  return recomputedHash === logDocument.hash;
}

/**
 * Validates multiple logs by verifying each one's hash.
 * This function can be used to detect tampering across multiple logs.
 *
 * @param logs - Array of audit log documents
 * @returns true if all logs are valid, false if any is tampered
 */
export function verifyHashChain(logs: AuditLogDocument[]): boolean {
  if (logs.length === EMPTY_ARRAY_LENGTH) {
    return true;
  }

  // Verify each log
  for (const log of logs) {
    if (!verifyLogHash(log)) {
      return false;
    }
  }

  return true;
}
