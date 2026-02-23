export interface AuditLogResult {
  success: boolean;
  message: string;
}

export interface IAuditService {
  init: (serviceName: string) => Promise<void>;
  log: (data: AuditLogInput) => Promise<AuditLogResult>;
}

export interface AuditLogInput {
  correlationId: string; // Client-generated UUID for request tracking
  eventPhase: 'INTENT' | 'SUCCESS' | 'FAILED';
  eventType: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  resourceType: string;
  resourceId?: string;
  sourceIp: string;
  description: string;
  status?: string;
  tenantId: string;
  durationMs?: number;
  outcome?: Record<string, unknown>;
  actionPerformed?: Record<string, unknown>;
}
export interface AuditLogData {
  eventType: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  resourceType: string;
  resourceId?: string;
  sourceIp: string;
  description: string;
  status?: string;
  tenantId: string;
  durationMs?: number;
  outcome?: Record<string, unknown>;
  actionPerformed?: Record<string, unknown>;
}

// Complete document structure stored in OpenSearch
export interface AuditLogDocument {
  timestamp: string; // ISO 8601 timestamp (auto-generated)
  serviceName: string; // Service identifier (set during init)
  hash: string;
  eventPhase: 'INTENT' | 'SUCCESS' | 'FAILED';
  correlationId: string;
  data: AuditLogData;
}
