// SPDX-License-Identifier: Apache-2.0
import crypto from 'node:crypto';
import type { AuditLogData, AuditLogDocument } from './interfaces/audit';

const EMPTY_ARRAY_LENGTH = 0;

/**
 * Computes a SHA-256 hash of the audit log data object for integrity verification.
 * The hash is computed only on the data object in canonical form.
 *
 * @param data - The audit log data object to hash
 * @returns SHA-256 hash as a 64-character hex string
 */
export function computeLogHash(data: AuditLogData): string {
  // Create canonical string representation by sorting keys
  const sortedKeys = Object.keys(data).sort();

  // Build canonical string
  const canonicalString = sortedKeys
    .filter((key) => data[key as keyof AuditLogData] !== undefined)
    .map((key) => {
      const value = data[key as keyof AuditLogData];
      // Stringify objects for consistent hashing
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${key}:${stringValue}`;
    })
    .join('|');

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
