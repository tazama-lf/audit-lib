// SPDX-License-Identifier: Apache-2.0
import type { IAuditService, AuditLogData } from '../utils/interfaces/audit';
import { Client } from '@opensearch-project/opensearch';
import { openSearchConfig } from '../config/openSearch.config';

export class OpenSearchService implements IAuditService {
  private readonly client: Client;
  private static instance: OpenSearchService;
  private isInitialized = false;

  // 1. Store the service name here
  private serviceName = 'unknown-service';

  private constructor() {
    const config = openSearchConfig();
    this.client = new Client({
      node: config.node,
      auth: config.auth,
      ssl: config.ssl,
    });
  }

  // Singleton Pattern
  public static getInstance(): OpenSearchService {
    OpenSearchService.instance ||= new OpenSearchService();
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
            timestamp: { type: 'date' },
            serviceName: { type: 'keyword' },
            actorId: { type: 'keyword' },
            actorRole: { type: 'keyword' },
            actorName: { type: 'text' },
            actorEmail: { type: 'keyword' },
            eventType: { type: 'keyword' },
            description: { type: 'text' },
            status: { type: 'keyword' },
            resourceId: { type: 'keyword' },
            resourceType: { type: 'keyword' },
            sourceIp: { type: 'ip' },
            outcome: { type: 'object', enabled: true },
            actionPerformed: { type: 'object', enabled: true },
            tenantId: { type: 'keyword' },
          },
        },
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
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
      return;
    }

    this.serviceName = serviceName;
    await this.ensureSchema();
    this.isInitialized = true;
  }

  public async log(data: AuditLogData): Promise<void> {
    const date = new Date();
    // Monthly Index: audit-logs-YYYY.MM
    const MONTH_OFFSET = 1;
    const PAD_WIDTH = 2;
    const PAD_CHAR = '0';
    const month = date.getUTCMonth() + MONTH_OFFSET;
    const monthStr = String(month).padStart(PAD_WIDTH, PAD_CHAR);
    const config = openSearchConfig();
    const indexName = `${config.indexPrefix}-${date.getUTCFullYear()}.${monthStr}`;

    const doc = {
      timestamp: date.toISOString(),
      serviceName: this.serviceName,
      actorId: data.actorId,
      actorRole: data.actorRole,
      actorName: data.actorName,
      actorEmail: data.actorEmail,
      resourceId: data.resourceId,
      resourceType: data.resourceType,
      sourceIp: data.sourceIp,
      description: data.description,
      eventType: data.eventType,
      status: data.status,
      actionPerformed: data.actionPerformed,
      outcome: data.outcome,
      tenantId: data.tenantId,
    };

    try {
      await this.client.index({
        index: indexName,
        body: doc,
        refresh: 'wait_for',
      });
    } catch (error: unknown) {
        throw new Error('Audit Log Failed: Transaction Aborted.', { cause: error });
    }
  }
}
