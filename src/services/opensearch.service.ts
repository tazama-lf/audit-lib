// SPDX-License-Identifier: Apache-2.0
import type { IAuditService, AuditLogData } from '../utils/interfaces/audit';
import { Client } from '@opensearch-project/opensearch';
import { openSearchConfig } from '../config/openSearch.config';

export class OpenSearchService implements IAuditService {
  private readonly client: Client;
  private static instance: OpenSearchService;
  private isInitialized = false;

  // 1. Store the service name here
  private serviceName!: string;

  private constructor() {
    const config = openSearchConfig();
    this.client = new Client({
      node: config.node,
      auth: config.auth,
      ssl: config.ssl,
    });
  }

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
            actorId: { type: 'text' },
            actorRole: { type: 'text' },
            actorName: { type: 'text' },
            eventType: { type: 'text' },
            description: { type: 'text' },
            status: { type: 'keyword' },
            resourceId: { type: 'text' },
            resourceType: { type: 'text' },
            sourceIp: { type: 'ip' },
            outcome: { type: 'object', enabled: true },
            actionPerformed: { type: 'object', enabled: true },
            tenantId: { type: 'text' },
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
      if (this.serviceName !== serviceName) {
        throw new Error(`OpenSearchService already initialized with "${this.serviceName}".`);
      }
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
      ...data,
      timestamp: date.toISOString(),
      serviceName: this.serviceName,
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
