// SPDX-License-Identifier: Apache-2.0
import type { IAuditService, AuditLogInput, AuditLogResult } from '../utils/interfaces/audit';
import { Client } from '@opensearch-project/opensearch';
import { openSearchConfig } from '../config/openSearch.config';
import { computeLogHash } from '../utils/hash-utility';

export class OpenSearchService implements IAuditService {
  private readonly client: Client;
  private static instance: OpenSearchService | undefined;
  private isInitialized = false;

  private serviceName = 'unknown-service';

  private constructor() {
    const config = openSearchConfig();
    this.client = new Client({
      node: config.node,
      auth: config.auth,
      ssl: config.ssl,
    });
  }

  public static getInstance(): OpenSearchService {
    OpenSearchService.instance ??= new OpenSearchService();
    return OpenSearchService.instance;
  }

  private async ensureSchema(): Promise<void> {
    const templateName = 'audit-logs-template';
    const config = openSearchConfig();
    const templateBody = {
      index_patterns: [`${config.indexPrefix}-*`],
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

    const HTTP_NOT_FOUND = 404;
    const exists = await this.client.indices.existsTemplate({ name: templateName });
    if (exists.statusCode === HTTP_NOT_FOUND) {
      await this.client.indices.putTemplate({
        name: templateName,
        body: templateBody,
      });
    }
  }

  // 2. Init sets the name once
  public async init(serviceName: string): Promise<void> {
    if (this.isInitialized) {
      if (this.serviceName !== serviceName) {
        throw new Error(`OpenSearchService already initialized with "${this.serviceName}".`);
      }
      return;
    }

    this.serviceName = serviceName;
    await this.ensureSchema();
    this.isInitialized = true;
  }

  public async log(input: AuditLogInput): Promise<AuditLogResult> {
    const date = new Date();
    // Monthly Index: audit-logs-YYYY.MM
    const MONTH_OFFSET = 1;
    const PAD_WIDTH = 2;
    const PAD_CHAR = '0';
    const month = date.getUTCMonth() + MONTH_OFFSET;
    const monthStr = String(month).padStart(PAD_WIDTH, PAD_CHAR);
    const config = openSearchConfig();
    const indexName = `${config.indexPrefix}-${date.getUTCFullYear()}.${monthStr}`;

    const { correlationId, eventPhase, ...dataFields } = input;

    const data = {
      eventType: dataFields.eventType,
      actorId: dataFields.actorId,
      actorRole: dataFields.actorRole,
      actorName: dataFields.actorName,
      resourceType: dataFields.resourceType,
      resourceId: dataFields.resourceId,
      sourceIp: dataFields.sourceIp,
      description: dataFields.description,
      status: dataFields.status,
      tenantId: dataFields.tenantId,
      durationMs: dataFields.durationMs,
      outcome: dataFields.outcome,
      actionPerformed: dataFields.actionPerformed,
    };

    // Compute hash on data object only
    const hash = computeLogHash(data);

    // Create final document with nested structure
    const document = {
      timestamp: date.toISOString(),
      serviceName: this.serviceName,
      hash,
      eventPhase,
      correlationId,
      data,
    };

    try {
      await this.client.index({
        index: indexName,
        body: document,
        refresh: 'wait_for',
      });

      return {
        success: true,
        message: 'Audit log created successfully',
      };
    } catch (error: unknown) {
      throw new Error('Audit Log Failed: Transaction Aborted.', { cause: error });
    }
  }
}
