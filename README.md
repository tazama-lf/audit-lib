# audit-lib
A shared (common) internal Tazama TypeScript library for audit functionality

## Quick Start Guide

### 1. Installation

Add the library to your service's dependencies.

```bash
npm install @tazama-lf/audit-lib
```

### 2. Environment Configuration

Configure the audit provider in your service's `.env` file. The library will read the `AUDIT_PROVIDER` variable to determine which backend to use.

**For OpenSearch:**
```env
AUDIT_PROVIDER=opensearch

# Add OpenSearch connection details
OPENSEARCH_NODE=http://localhost:9200
...
```

**For PostgreSQL:**
```env
AUDIT_PROVIDER=postgres

# Add PostgreSQL connection details
DB_HOST=localhost
DB_PORT=5432
...
```
If `AUDIT_PROVIDER` is not set, it will default to `opensearch`.

### 3. Providing the Logger

In your main application module (e.g., `app.module.ts`), import `createAuditProvider` and add it to the `providers` array, passing your unique service name.

```typescript
import { Module } from '@nestjs/common';
import { createAuditProvider } from '@tazama-lf/audit-lib';

@Module({
  providers: [
    createAuditProvider('your-service-name'),
    // ... other providers
  ],
})
export class AppModule {}
```

### 4. Usage

Inject the logger into any service using the token `'AUDIT_LOGGER'` and the `IAuditService` type.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { IAuditService, AuditLogData } from '@tazama-lf/audit-lib';

@Injectable()
export class MyService {
  constructor(
    @Inject('AUDIT_LOGGER') private readonly auditLogger: IAuditService,
  ) {}

  async doSomething() {
    const logData: AuditLogData = {
      eventType: 'USER_ACTION',
      status: 'success',
      description: 'User performed an action.',
      // ... other details
    };

    await this.auditLogger.log(logData);
  }
}
```
