export enum EventPhase {
  INTENT = 'INTENT',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface IAuditLogResult {
  success: boolean;
  message: string;
}

export interface IAuditService {
  init: (serviceName: string) => Promise<void>;
  log: (data: IAuditLogInput) => Promise<IAuditLogResult>;
}

export interface IAuditLogInput {
  correlationId: string; // Client-generated UUID for request tracking
  eventPhase: EventPhase;
  eventType: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  resourceType: string;
  resourceId?: string;
  sourceIp: string;
  description: string;
  tenantId: string;
  outcome?: Record<string, unknown>;
  actionPerformed?: Record<string, unknown>;
}
export interface IAuditLogData {
  eventType: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  resourceType: string;
  resourceId?: string;
  sourceIp: string;
  description: string;
  tenantId: string;
  outcome?: Record<string, unknown>;
  actionPerformed?: Record<string, unknown>;
}

// Complete document structure stored in OpenSearch
export interface IAuditLogDocument {
  timestamp: string; // ISO 8601 timestamp (auto-generated)
  serviceName: string; // Service identifier (set during init)
  hash: string;
  eventPhase: EventPhase;
  correlationId: string;
  data: IAuditLogData;
}

export interface IHashAuditData {
  correlationId: string;
  eventPhase: EventPhase;
  data: IAuditLogData;
}
