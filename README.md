# @tazama-lf/audit-lib

A TypeScript library for tamper-evident audit logging with SHA-256 hashing, correlation tracking, and pluggable storage providers.

## Features

- **Pluggable Providers**: Extensible architecture for multiple storage backends
- **Tamper Detection**: SHA-256 hashing for data integrity verification
- **Correlation Tracking**: Link INTENT → SUCCESS/FAILED events with correlation IDs
- **Nested Structure**: Clean separation of metadata and business data
- **TypeScript Support**: Full type definitions included

## Supported Providers

- **OpenSearch** (default) - Monthly indices with optimized mappings
- **Future**: Elasticsearch, MongoDB, PostgreSQL, CloudWatch, Azure Monitor, etc.

## Installation

```bash
npm install @tazama-lf/audit-lib
```

## Configuration

```env
# Provider selection (defaults to opensearch)
AUDIT_PROVIDER=opensearch

# OpenSearch configuration
OPENSEARCH_NODE=https://opensearch.example.com:9200
OPENSEARCH_USERNAME=your-username
OPENSEARCH_PASSWORD=your-password
OPENSEARCH_INDEX_PREFIX=audit-logs
OPENSEARCH_SSL_REJECT_UNAUTHORIZED=true
OPENSEARCH_REFRESH=false  # Options: 'false' (default), 'true', 'wait_for'
```

## Usage

### 1. Register Provider

```typescript
import { Module } from '@nestjs/common';
import { createAuditProvider } from '@tazama-lf/audit-lib';

@Module({
  providers: [createAuditProvider('your-service-name')],
})
export class AppModule {}
```

### 2. Use in Service

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { IAuditService, IAuditLogInput, EventPhase } from '@tazama-lf/audit-lib';
import { randomUUID } from 'node:crypto';

@Injectable()
export class UserService {
  constructor(@Inject('AUDIT_LOGGER') private readonly auditLogger: IAuditService) {}

  async performAction() {
    const correlationId = randomUUID();

    // Log INTENT
    await this.auditLogger.log({
      correlationId,
      eventPhase: EventPhase.INTENT,
      eventType: 'CREATE_USER',
      actorId: 'admin-123',
      actorRole: 'Admin',
      actorName: 'Admin User',
      resourceType: 'User',
      sourceIp: '192.168.1.100',
      description: 'Creating new user',
      tenantId: 'tenant-1',
    });

    try {
      const result = await this.createUser();

      // Log SUCCESS
      await this.auditLogger.log({
        correlationId,
        eventPhase: EventPhase.SUCCESS,
        eventType: 'CREATE_USER',
        actorId: 'admin-123',
        actorRole: 'Admin',
        actorName: 'Admin User',
        resourceType: 'User',
        resourceId: result.userId,
        sourceIp: '192.168.1.100',
        description: 'User created successfully',
        tenantId: 'tenant-1',
        outcome: { userId: result.userId },
      });
    } catch (error) {
      // Log FAILED
      await this.auditLogger.log({
        correlationId,
        eventPhase: EventPhase.FAILED,
        eventType: 'CREATE_USER',
        actorId: 'admin-123',
        actorRole: 'Admin',
        actorName: 'Admin User',
        resourceType: 'User',
        sourceIp: '192.168.1.100',
        description: 'User creation failed',
        tenantId: 'tenant-1',
        outcome: { errorCode: 'DB_001', errorMessage: error.message },
      });
    }
  }
}
```

## Document Structure

```typescript
{
  // Root-level metadata
  "timestamp": "2026-02-20T10:30:00.000Z",
  "serviceName": "user-service",
  "hash": "a1b2c3...",
  "eventPhase": "SUCCESS",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",

  // Nested business data
  "data": {
    "eventType": "USER_LOGIN",
    "actorId": "user-123",
    "actorRole": "Admin",
    "actorName": "John Doe",
    "resourceType": "UserAccount",
    "resourceId": "account-456",
    "sourceIp": "192.168.1.100",
    "description": "User logged in successfully",
    "tenantId": "tenant-1",
    "outcome": { "sessionId": "sess-789" },
    "actionPerformed": { "method": "password", "mfaUsed": true }
  }
}
```

## API Reference

### Event Phase Enum

```typescript
enum EventPhase {
  INTENT = 'INTENT',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}
```

### Interfaces

```typescript
interface IAuditService {
  init: (serviceName: string) => Promise<void>;
  log: (data: AuditLogInput) => Promise<AuditLogResult>;
}

interface AuditLogInput {
  correlationId: string;
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
```

## Event Phases

- **INTENT**: Operation about to be performed
- **SUCCESS**: Operation completed successfully
- **FAILED**: Operation failed (errors in `outcome`)

**Pattern**: Always log INTENT before operation, then SUCCESS or FAILED after.

## OpenSearch Details

### Index Structure

- **Pattern**: `{indexPrefix}-YYYY.MM` (monthly rotation)
- **Example**: `audit-logs-2026.02`
- **Mappings**: Root fields include `timestamp` (date) and other metadata fields (`serviceName`, `hash`, `eventPhase`, `correlationId`) as keywords; nested `data` object with specific types
- **Settings**: 3 shards, 1 replica, 5s refresh interval, best compression

## Development

```bash
npm install      # Install dependencies
npm run lint     # Run ESLint + Prettier
npm test         # Run tests (97.73% coverage)
npm run build    # Build library
```

## License

Apache-2.0