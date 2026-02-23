// SPDX-License-Identifier: Apache-2.0
import { OpenSearchService } from '../src/services/opensearch.service';
// Mock OpenSearch config to avoid env validation during service construction
jest.mock('../src/config/openSearch.config', () => ({
  openSearchConfig: () => ({
    node: 'http://localhost:9200',
    auth: { username: 'test-user', password: 'test-pass' },
    ssl: { rejectUnauthorized: false },
    indexPrefix: 'audit-logs-test',
  }),
}));

describe('OpenSearchService', () => {
  let logger: OpenSearchService;
  let mockIndex: jest.Mock;
  let mockExistsTemplate: jest.Mock;
  let mockPutTemplate: jest.Mock;

  beforeEach(async () => {
    (OpenSearchService as any).instance = undefined;
    logger = OpenSearchService.getInstance();

    mockIndex = jest.fn().mockResolvedValue({ body: { result: 'created' } });
    mockExistsTemplate = jest.fn().mockResolvedValue({ statusCode: 404 });
    mockPutTemplate = jest.fn().mockResolvedValue({ body: { acknowledged: true } });

    const mockClient = {
      index: mockIndex,
      indices: {
        existsTemplate: mockExistsTemplate,
        putTemplate: mockPutTemplate,
      },
    };

    (logger as any).client = mockClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init()', () => {
    it('should create schema if it does not exist', async () => {
      await logger.init('test-service');

      expect(mockExistsTemplate).toHaveBeenCalledWith({
        name: 'audit-logs-template',
      });
      expect(mockPutTemplate).toHaveBeenCalled();
    });

    it('should NOT create schema if it already exists', async () => {
      mockExistsTemplate.mockResolvedValueOnce({ statusCode: 200 });
      await logger.init('test-service');
      expect(mockExistsTemplate).toHaveBeenCalled();
      expect(mockPutTemplate).not.toHaveBeenCalled();
    });
  });

  describe('log()', () => {
    it('should create nested document structure with data object', async () => {
      await logger.init('TestService');

      await logger.log({
        correlationId: 'corr-abc-123',
        eventPhase: 'SUCCESS',
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceId: 'account-55',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User logged in',
        tenantId: 'tenant-1',
        outcome: { extra: 'data' },
        actionPerformed: { performed: 'action' },
      });

      expect(mockIndex).toHaveBeenCalledTimes(1);

      const callArgs = mockIndex.mock.calls[0][0];

      // Check root-level fields
      expect(callArgs.body.timestamp).toBeDefined();
      expect(callArgs.body.serviceName).toBe('TestService');
      expect(callArgs.body.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(callArgs.body.eventPhase).toBe('SUCCESS');
      expect(callArgs.body.correlationId).toBe('corr-abc-123');

      // Check data object
      expect(callArgs.body.data).toEqual({
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceId: 'account-55',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User logged in',
        tenantId: 'tenant-1',
        outcome: { extra: 'data' },
        actionPerformed: { performed: 'action' },
      });

      // Verify schemaVersion is NOT present
      expect(callArgs.body.schemaVersion).toBeUndefined();
    });

    it('should compute deterministic hash for same data', async () => {
      await logger.init('TestService');

      const testInput = {
        correlationId: 'corr-abc-123',
        eventPhase: 'INTENT' as const,
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User login attempt',
        tenantId: 'tenant-1',
      };

      // Log twice with same data
      await logger.log(testInput);
      await logger.log(testInput);

      expect(mockIndex).toHaveBeenCalledTimes(2);

      const hash1 = mockIndex.mock.calls[0][0].body.hash;
      const hash2 = mockIndex.mock.calls[1][0].body.hash;

      // Hashes should be the same for identical data
      expect(hash1).toBe(hash2);
    });

    it('should support INTENT → SUCCESS lifecycle with correlationId', async () => {
      await logger.init('TestService');

      const correlationId = 'corr-lifecycle-123';

      // Log INTENT
      await logger.log({
        correlationId,
        eventPhase: 'INTENT',
        eventType: 'CREATE_USER',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'User',
        sourceIp: '127.0.0.1',
        description: 'Creating new user',
        tenantId: 'tenant-1',
      });

      // Log SUCCESS
      await logger.log({
        correlationId,
        eventPhase: 'SUCCESS',
        eventType: 'CREATE_USER',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'User',
        sourceIp: '127.0.0.1',
        description: 'User created successfully',
        tenantId: 'tenant-1',
        outcome: { userId: 'new-user-456' },
      });

      expect(mockIndex).toHaveBeenCalledTimes(2);

      const intentLog = mockIndex.mock.calls[0][0].body;
      const successLog = mockIndex.mock.calls[1][0].body;

      // Both should have the same correlationId at root level
      expect(intentLog.correlationId).toBe(correlationId);
      expect(successLog.correlationId).toBe(correlationId);

      // Verify phases at root level
      expect(intentLog.eventPhase).toBe('INTENT');
      expect(successLog.eventPhase).toBe('SUCCESS');
    });

    it('should support INTENT → FAILED lifecycle with errors in outcome', async () => {
      await logger.init('TestService');

      const correlationId = 'corr-failure-123';

      // Log INTENT
      await logger.log({
        correlationId,
        eventPhase: 'INTENT',
        eventType: 'DELETE_USER',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'User',
        resourceId: 'user-456',
        sourceIp: '127.0.0.1',
        description: 'Attempting to delete user',
        tenantId: 'tenant-1',
      });

      // Log FAILED (errors go in outcome)
      await logger.log({
        correlationId,
        eventPhase: 'FAILED',
        eventType: 'DELETE_USER',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'User',
        resourceId: 'user-456',
        sourceIp: '127.0.0.1',
        description: 'User deletion failed',
        tenantId: 'tenant-1',
        outcome: {
          errorCode: 'DB_001',
          errorMessage: 'Database constraint violation',
        },
      });

      expect(mockIndex).toHaveBeenCalledTimes(2);

      const intentLog = mockIndex.mock.calls[0][0].body;
      const failedLog = mockIndex.mock.calls[1][0].body;

      // Both should have the same correlationId
      expect(intentLog.correlationId).toBe(correlationId);
      expect(failedLog.correlationId).toBe(correlationId);

      // Verify phases
      expect(intentLog.eventPhase).toBe('INTENT');
      expect(failedLog.eventPhase).toBe('FAILED');

      // Failed should have error details in outcome
      expect(failedLog.data.outcome.errorCode).toBe('DB_001');
      expect(failedLog.data.outcome.errorMessage).toBe('Database constraint violation');
    });

    it('should throw error if OpenSearch fails', async () => {
      await logger.init('TestService');
      mockIndex.mockRejectedValueOnce(new Error('Connection Refused'));

      await expect(
        logger.log({
          correlationId: 'corr-error-123',
          eventPhase: 'INTENT',
          eventType: 'LOGIN',
          actorId: '1',
          actorRole: 'Admin',
          actorName: 'Test User',
          resourceType: 'TestResource',
          resourceId: 'res-1',
          sourceIp: '127.0.0.1',
          description: 'test',
          tenantId: 'tenant-1',
        }),
      ).rejects.toThrow('Audit Log Failed: Transaction Aborted.');
    });
  });
});
