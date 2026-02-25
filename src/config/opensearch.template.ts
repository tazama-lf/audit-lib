// SPDX-License-Identifier: Apache-2.0

/**
 * OpenSearch index template configuration for audit logs.
 * Defines mappings, settings, and index patterns.
 */
export function createAuditLogTemplate(indexPrefix: string): Record<string, unknown> {
  return {
    index_patterns: [`${indexPrefix}-*`],
    template: {
      mappings: {
        properties: {
          timestamp: {
            type: 'date',
            format: 'strict_date_optional_time||epoch_millis',
          },
          serviceName: { type: 'keyword' },
          hash: { type: 'keyword', index: true },
          eventPhase: { type: 'keyword', index: true },
          correlationId: { type: 'keyword', index: true },

          // Nested data object with all business fields
          data: {
            type: 'object',
            properties: {
              eventType: { type: 'keyword' },
              actorId: { type: 'keyword' },
              actorRole: { type: 'keyword' },
              actorName: { type: 'text' },
              resourceType: { type: 'keyword' },
              resourceId: { type: 'keyword' },
              sourceIp: { type: 'ip' },
              description: { type: 'text' },
              tenantId: { type: 'keyword' },
              // Fully dynamic nested objects
              outcome: { type: 'object', enabled: true, dynamic: true },
              actionPerformed: { type: 'object', enabled: true, dynamic: true },
            },
          },
        },
      },
      settings: {
        number_of_shards: 3,
        number_of_replicas: 1,
        refresh_interval: '5s',
        index: {
          codec: 'best_compression',
          sort: {
            field: ['timestamp', 'correlationId'],
            order: ['desc', 'asc'],
          },
        },
      },
    },
  };
}
