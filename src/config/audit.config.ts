import { validateEnvVar } from '../utils/helper';

export const auditConfig = (): { service: string } => {
  const auditService = validateEnvVar('AUDIT_PROVIDER', 'string', true).toString();
  return {
    service: auditService || 'opensearch',
  };
};
