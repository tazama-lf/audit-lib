import type { IAuditService } from '../utils/interfaces/audit';
import { auditConfig } from '../config/audit.config';
import { AuditService } from '../services/audit.service';

/**
 * Creates the AuditLogger provider with a specific Service Name.
 * Use this in your AppModule imports.
 */
export const createAuditProvider = (
  serviceName: string,
): {
  provide: string;
  useFactory: () => Promise<IAuditService>;
} => ({
  provide: 'AUDIT_LOGGER',
  useFactory: async (): Promise<IAuditService> => {
    const { service } = auditConfig();
    const logger = AuditService.getInstance(service);

    // Initialize it once with the name passed from Module
    await logger.init(serviceName);

    return logger;
  },
});
