import { describe, it, expect } from '@jest/globals';
import {
  TmrError,
  ConfigurationError,
  FileSystemError,
  AIProviderError,
  ValidationError,
  RoutingError,
  TeamMemberNotFoundError,
  ProjectNotFoundError,
  InvalidEmailError,
  ConfidenceThresholdError,
} from '../../src/errors/tmr-error.js';

describe('TmrError hierarchy', () => {
  describe('TmrError', () => {
    it('sets message and code', () => {
      const err = new TmrError('base error', 'TMR_E000');
      expect(err.message).toBe('base error');
      expect(err.code).toBe('TMR_E000');
      expect(err.name).toBe('TmrError');
      expect(err).toBeInstanceOf(Error);
    });

    it('works without a code', () => {
      const err = new TmrError('no code');
      expect(err.code).toBeUndefined();
    });
  });

  describe('ConfigurationError', () => {
    it('defaults to code TMR_E001', () => {
      const err = new ConfigurationError('bad config');
      expect(err.code).toBe('TMR_E001');
      expect(err.name).toBe('ConfigurationError');
      expect(err).toBeInstanceOf(TmrError);
    });

    it('accepts a custom code', () => {
      const err = new ConfigurationError('bad config', 'TMR_E999');
      expect(err.code).toBe('TMR_E999');
    });
  });

  describe('FileSystemError', () => {
    it('exposes operation and path', () => {
      const err = new FileSystemError('read failed', 'read', '/tmp/file.md');
      expect(err.code).toBe('TMR_E002');
      expect(err.operation).toBe('read');
      expect(err.path).toBe('/tmp/file.md');
      expect(err.name).toBe('FileSystemError');
    });
  });

  describe('AIProviderError', () => {
    it('exposes provider and optional cause', () => {
      const cause = new Error('network');
      const err = new AIProviderError('call failed', 'openai', cause);
      expect(err.code).toBe('TMR_E003');
      expect(err.provider).toBe('openai');
      expect(err.cause).toBe(cause);
      expect(err.name).toBe('AIProviderError');
    });
  });

  describe('ValidationError', () => {
    it('defaults to code TMR_E004', () => {
      const err = new ValidationError('invalid input');
      expect(err.code).toBe('TMR_E004');
      expect(err.name).toBe('ValidationError');
      expect(err).toBeInstanceOf(TmrError);
    });
  });

  describe('RoutingError', () => {
    it('defaults to code TMR_E005', () => {
      const err = new RoutingError('routing failed');
      expect(err.code).toBe('TMR_E005');
      expect(err.name).toBe('RoutingError');
      expect(err).toBeInstanceOf(TmrError);
    });
  });

  describe('TeamMemberNotFoundError', () => {
    it('builds message from email and defaults to TMR_E101', () => {
      const err = new TeamMemberNotFoundError('alice@example.com');
      expect(err.message).toBe('Team member not found: alice@example.com');
      expect(err.code).toBe('TMR_E101');
      expect(err.name).toBe('TeamMemberNotFoundError');
    });
  });

  describe('ProjectNotFoundError', () => {
    it('builds message from project name and defaults to TMR_E102', () => {
      const err = new ProjectNotFoundError('Alpha');
      expect(err.message).toBe('Project not found: Alpha');
      expect(err.code).toBe('TMR_E102');
      expect(err.name).toBe('ProjectNotFoundError');
    });
  });

  describe('InvalidEmailError', () => {
    it('builds message from email and defaults to TMR_E103', () => {
      const err = new InvalidEmailError('not-an-email');
      expect(err.message).toBe('Invalid email address: not-an-email');
      expect(err.code).toBe('TMR_E103');
      expect(err.name).toBe('InvalidEmailError');
    });
  });

  describe('ConfidenceThresholdError', () => {
    it('formats confidence and threshold in the message, defaults to TMR_E104', () => {
      const err = new ConfidenceThresholdError(0.6, 0.75);
      expect(err.message).toBe('AI confidence 0.60 is below threshold 0.75');
      expect(err.code).toBe('TMR_E104');
      expect(err.name).toBe('ConfidenceThresholdError');
    });
  });
});
