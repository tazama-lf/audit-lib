// SPDX-License-Identifier: Apache-2.0
import { validateEnvVar, generateIndexName } from '../src/utils/helper';

describe('Helper Utils', () => {
  describe('validateEnvVar()', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should return string value for valid string env var', () => {
      process.env.TEST_VAR = 'test-value';
      const result = validateEnvVar('TEST_VAR', 'string');
      expect(result).toBe('test-value');
    });

    it('should return number value for valid number env var', () => {
      process.env.TEST_PORT = '3000';
      const result = validateEnvVar('TEST_PORT', 'number');
      expect(result).toBe(3000);
    });

    it('should return true for boolean env var set to "true"', () => {
      process.env.TEST_BOOL = 'true';
      const result = validateEnvVar('TEST_BOOL', 'boolean');
      expect(result).toBe(true);
    });

    it('should return false for boolean env var set to "false"', () => {
      process.env.TEST_BOOL = 'false';
      const result = validateEnvVar('TEST_BOOL', 'boolean');
      expect(result).toBe(false);
    });

    it('should return empty string for optional string var that is not set', () => {
      delete process.env.OPTIONAL_VAR;
      const result = validateEnvVar('OPTIONAL_VAR', 'string', true);
      expect(result).toBe('');
    });

    it('should throw error for required env var that is not defined', () => {
      delete process.env.REQUIRED_VAR;
      expect(() => validateEnvVar('REQUIRED_VAR', 'string')).toThrow('Environment variable REQUIRED_VAR is not defined.');
    });

    it('should throw error for env var with only whitespaces when required', () => {
      process.env.WHITESPACE_VAR = '   ';
      expect(() => validateEnvVar('WHITESPACE_VAR', 'string')).toThrow('Environment variable WHITESPACE_VAR is not defined.');
    });

    it('should throw error for optional env var with only whitespaces', () => {
      process.env.OPTIONAL_WHITESPACE = '   ';
      expect(() => validateEnvVar('OPTIONAL_WHITESPACE', 'string', true)).toThrow(
        'Environment variable OPTIONAL_WHITESPACE is optional but set to a string with whitespaces only.',
      );
    });

    it('should throw error for invalid number env var', () => {
      process.env.INVALID_NUMBER = 'not-a-number';
      expect(() => validateEnvVar('INVALID_NUMBER', 'number')).toThrow('Environment variable INVALID_NUMBER is not a valid number.');
    });

    it('should throw error for invalid boolean env var', () => {
      process.env.INVALID_BOOL = 'invalid';
      expect(() => validateEnvVar('INVALID_BOOL', 'boolean')).toThrow('Environment variable INVALID_BOOL is not a valid boolean.');
    });
  });

  describe('generateIndexName()', () => {
    it('should generate index name with correct format', () => {
      const result = generateIndexName('audit-logs');
      const year = new Date().getUTCFullYear();
      const month = String(new Date().getUTCMonth() + 1).padStart(2, '0');
      expect(result).toBe(`audit-logs-${year}.${month}`);
    });

    it('should pad single digit months with zero', () => {
      const mockDate = new Date('2026-01-15T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const result = generateIndexName('test-index');
      expect(result).toBe('test-index-2026.01');

      jest.restoreAllMocks();
    });
  });
});
