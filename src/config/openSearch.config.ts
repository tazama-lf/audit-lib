import { validateEnvVar } from '../utils/helper';
import type { IOpenSearchConfig } from '../utils/interfaces/opensearch';

/**
 * Validates and retrieves the OpenSearch configuration from environment variables.
 *
 * @returns {OpenSearchConfig} - The validated OpenSearch configuration.
 * @throws {Error} - Throws an error if required environment variables are not defined or invalid.
 *
 * @example
 * const openSearchConfig = openSearchConfig();
 */
export const openSearchConfig = (): IOpenSearchConfig => {
  const node = validateEnvVar('OPENSEARCH_NODE', 'string').toString();
  const username = validateEnvVar('OPENSEARCH_USERNAME', 'string', true).toString();
  const password = validateEnvVar('OPENSEARCH_PASSWORD', 'string', true).toString();
  const rejectUnauthorized = validateEnvVar('OPENSEARCH_SSL_REJECT_UNAUTHORIZED', 'boolean', true);
  const rawRefresh = validateEnvVar('OPENSEARCH_REFRESH', 'string', true)?.toString() ?? 'false';
  const refresh = (['wait_for', 'true', 'false'] as const).includes(rawRefresh as 'wait_for' | 'true' | 'false')
    ? (rawRefresh as 'wait_for' | 'true' | 'false')
    : 'false';
  return {
    node,
    auth:
      username && password
        ? {
            username,
            password,
          }
        : undefined,
    ssl: {
      rejectUnauthorized: Boolean(rejectUnauthorized),
    },
    indexPrefix: 'audit-logs',
    refresh,
  };
};
