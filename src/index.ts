// SPDX-License-Identifier: Apache-2.0

export { createAuditProvider } from './providers/auditLog.provider';
export type { IAuditService, IAuditLogInput, IAuditLogDocument } from './utils/interfaces/audit';
export { EventPhase } from './utils/interfaces/audit';
export { computeLogHash, verifyLogHash, verifyAllHashes } from './utils/hash-utility';
