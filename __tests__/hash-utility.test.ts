// SPDX-License-Identifier: Apache-2.0
import { computeLogHash, verifyLogHash, verifyHashChain } from '../src/utils/hash-utility';
import type { AuditLogData, AuditLogDocument } from '../src/utils/interfaces/audit';

describe('Hash Utility', () => {
  describe('computeLogHash()', () => {
    it('should compute a valid SHA-256 hash (64 hex characters)', () => {
      const data: AuditLogData = {
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User login attempt',
        tenantId: 'tenant-1',
      };

      const hash = computeLogHash(data);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
    });

    it('should compute deterministic hashes (same input = same hash)', () => {
      const data: AuditLogData = {
        eventType: 'CREATE_USER',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'User',
        sourceIp: '192.168.1.1',
        description: 'User created',
        tenantId: 'tenant-1',
      };

      const hash1 = computeLogHash(data);
      const hash2 = computeLogHash(data);

      expect(hash1).toBe(hash2);
    });

    it('should compute different hashes for different data', () => {
      const data1: AuditLogData = {
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User login',
        tenantId: 'tenant-1',
      };

      const data2: AuditLogData = {
        ...data1,
        actorId: 'user-456', // Different actor
      };

      const hash1 = computeLogHash(data1);
      const hash2 = computeLogHash(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle optional fields (outcome, actionPerformed)', () => {
      const data: AuditLogData = {
        eventType: 'CREATE_USER',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'User',
        sourceIp: '127.0.0.1',
        description: 'User created',
        tenantId: 'tenant-1',
        outcome: { userId: 'new-user-456' },
        actionPerformed: { action: 'create', target: 'user' },
      };

      const hash = computeLogHash(data);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle resourceId field', () => {
      const data: AuditLogData = {
        eventType: 'DELETE_USER',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'User',
        resourceId: 'user-456',
        sourceIp: '127.0.0.1',
        description: 'User deleted',
        tenantId: 'tenant-1',
      };

      const hash = computeLogHash(data);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifyLogHash()', () => {
    it('should return true for valid hash', () => {
      const data: AuditLogData = {
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User login',
        tenantId: 'tenant-1',
      };

      const hash = computeLogHash(data);
      const logDocument: AuditLogDocument = {
        timestamp: '2026-02-20T10:00:00.000Z',
        serviceName: 'TestService',
        hash,
        eventPhase: 'INTENT',
        correlationId: 'corr-123',
        data,
      };

      const isValid = verifyLogHash(logDocument);

      expect(isValid).toBe(true);
    });

    it('should return false for tampered data', () => {
      const data: AuditLogData = {
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User login',
        tenantId: 'tenant-1',
      };

      const hash = computeLogHash(data);

      // Create document with tampered data
      const tamperedData = { ...data, actorId: 'user-456' };
      const logDocument: AuditLogDocument = {
        timestamp: '2026-02-20T10:00:00.000Z',
        serviceName: 'TestService',
        hash, // Original hash
        eventPhase: 'INTENT',
        correlationId: 'corr-123',
        data: tamperedData, // Tampered data
      };

      const isValid = verifyLogHash(logDocument);

      expect(isValid).toBe(false);
    });

    it('should return false for tampered hash', () => {
      const data: AuditLogData = {
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User login',
        tenantId: 'tenant-1',
      };

      const logDocument: AuditLogDocument = {
        timestamp: '2026-02-20T10:00:00.000Z',
        serviceName: 'TestService',
        hash: 'fakehash123', // Wrong hash
        eventPhase: 'INTENT',
        correlationId: 'corr-123',
        data,
      };

      const isValid = verifyLogHash(logDocument);

      expect(isValid).toBe(false);
    });
  });

  describe('verifyHashChain()', () => {
    it('should return true for empty chain', () => {
      const isValid = verifyHashChain([]);
      expect(isValid).toBe(true);
    });

    it('should return true for single valid log', () => {
      const data: AuditLogData = {
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User login',
        tenantId: 'tenant-1',
      };

      const hash = computeLogHash(data);
      const logDoc: AuditLogDocument = {
        timestamp: '2026-02-20T10:00:00.000Z',
        serviceName: 'TestService',
        hash,
        eventPhase: 'INTENT',
        correlationId: 'corr-123',
        data,
      };

      const isValid = verifyHashChain([logDoc]);
      expect(isValid).toBe(true);
    });

    it('should return true for multiple valid logs', () => {
      const data1: AuditLogData = {
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User login',
        tenantId: 'tenant-1',
      };

      const hash1 = computeLogHash(data1);
      const logDoc1: AuditLogDocument = {
        timestamp: '2026-02-20T10:00:00.000Z',
        serviceName: 'TestService',
        hash: hash1,
        eventPhase: 'INTENT',
        correlationId: 'corr-123',
        data: data1,
      };

      const data2: AuditLogData = {
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User logged in',
        tenantId: 'tenant-1',
      };

      const hash2 = computeLogHash(data2);
      const logDoc2: AuditLogDocument = {
        timestamp: '2026-02-20T10:00:05.000Z',
        serviceName: 'TestService',
        hash: hash2,
        eventPhase: 'SUCCESS',
        correlationId: 'corr-123',
        data: data2,
      };

      const isValid = verifyHashChain([logDoc1, logDoc2]);
      expect(isValid).toBe(true);
    });

    it('should return false if any log in chain is tampered', () => {
      const data1: AuditLogData = {
        eventType: 'LOGIN',
        actorId: 'user-123',
        actorRole: 'Admin',
        actorName: 'John Doe',
        resourceType: 'UserAccount',
        sourceIp: '127.0.0.1',
        description: 'User login',
        tenantId: 'tenant-1',
      };

      const hash1 = computeLogHash(data1);
      const tamperedData1 = { ...data1, actorId: 'user-456' };

      const logDoc1: AuditLogDocument = {
        timestamp: '2026-02-20T10:00:00.000Z',
        serviceName: 'TestService',
        hash: hash1, // Original hash
        eventPhase: 'INTENT',
        correlationId: 'corr-123',
        data: tamperedData1, // Tampered data
      };

      const isValid = verifyHashChain([logDoc1]);
      expect(isValid).toBe(false);
    });
  });
});
