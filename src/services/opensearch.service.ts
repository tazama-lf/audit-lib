// SPDX-License-Identifier: Apache-2.0
import type { IAuditService, IAuditLogInput, IAuditLogResult } from '../utils/interfaces/audit';
import { Client } from '@opensearch-project/opensearch';
import { openSearchConfig } from '../config/openSearch.config';
import { computeLogHash } from '../utils/hash-utility';
import { generateIndexName } from '../utils/helper';
import { createAuditLogTemplate } from '../config/opensearch.template';

export class OpenSearchService implements IAuditService {
  private readonly client: Client;
  private static instance: OpenSearchService | undefined;
  private isInitialized = false;

  private serviceName = 'unknown-service';
  private readonly indexPrefix: string;
  private readonly refresh: 'wait_for' | 'false' | 'true';

  private constructor() {
    const config = openSearchConfig();
    this.client = new Client({
      node: config.node,
      auth: config.auth,
      ssl: config.ssl,
    });
    this.indexPrefix = config.indexPrefix;
    this.refresh = config.refresh ?? 'false';
  }

  public static getInstance(): OpenSearchService {
    OpenSearchService.instance ??= new OpenSearchService();
    return OpenSearchService.instance;
  }

  private async ensureSchema(): Promise<void> {
    const templateName = 'audit-logs-template';
    const templateBody = createAuditLogTemplate(this.indexPrefix);

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

  public async log(input: IAuditLogInput): Promise<IAuditLogResult> {
    const date = new Date();
    const indexName = generateIndexName(this.indexPrefix);
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
      tenantId: dataFields.tenantId,
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
        refresh: this.refresh,
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
