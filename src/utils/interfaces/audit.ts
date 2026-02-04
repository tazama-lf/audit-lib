export interface IAuditService {
  init: (serviceName: string) => Promise<void>;
  log: (data: AuditLogData) => Promise<void>;
}

export interface AuditLogData {
  actorId: string;
  actorRole: string;
  actorName: string;
  resourceId?: string;
  resourceType: string;
  sourceIp: string;
  description: string;
  eventType: string;
  status: 'success' | 'failure' | 'info';
  tenantId: string;
  outcome?: Record<string, unknown>;
  actionPerformed?: Record<string, unknown>;
}
