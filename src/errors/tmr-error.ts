/**
 * Base error class for all Tech Manager OS errors.
 * Architecture mandates a TmrError hierarchy:
 *   TmrError → ConfigurationError | FileSystemError | AIProviderError | ValidationError | RoutingError
 *
 * All subclasses must call Object.setPrototypeOf to ensure correct instanceof
 * checks across ESM module boundaries.
 */
export class TmrError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'TmrError';
    Object.setPrototypeOf(this, TmrError.prototype);
  }
}

/** Thrown when configuration is invalid or required settings are missing. */
export class ConfigurationError extends TmrError {
  constructor(message: string, code = 'TMR_E001') {
    super(message, code);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/** Thrown when file I/O operations fail. */
export class FileSystemError extends TmrError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly path: string,
    public readonly cause?: unknown,
    code = 'TMR_E002',
  ) {
    super(message, code);
    this.name = 'FileSystemError';
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/** Thrown when AI provider API calls fail. */
export class AIProviderError extends TmrError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
    code = 'TMR_E003',
  ) {
    super(message, code);
    this.name = 'AIProviderError';
    Object.setPrototypeOf(this, AIProviderError.prototype);
  }
}

/** Thrown when user input fails validation. */
export class ValidationError extends TmrError {
  constructor(message: string, code = 'TMR_E004') {
    super(message, code);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/** Thrown when file routing decisions fail. */
export class RoutingError extends TmrError {
  constructor(message: string, code = 'TMR_E005') {
    super(message, code);
    this.name = 'RoutingError';
    Object.setPrototypeOf(this, RoutingError.prototype);
  }
}

/** Thrown when a team member is not found by email. */
export class TeamMemberNotFoundError extends TmrError {
  constructor(email: string, code = 'TMR_E101') {
    super(`Team member not found: ${email}`, code);
    this.name = 'TeamMemberNotFoundError';
    Object.setPrototypeOf(this, TeamMemberNotFoundError.prototype);
  }
}

/** Thrown when a project is not found by name. */
export class ProjectNotFoundError extends TmrError {
  constructor(projectName: string, code = 'TMR_E102') {
    super(`Project not found: ${projectName}`, code);
    this.name = 'ProjectNotFoundError';
    Object.setPrototypeOf(this, ProjectNotFoundError.prototype);
  }
}

/** Thrown when no tmr vault is found for the current working directory. */
export class VaultNotFoundError extends TmrError {
  constructor(
    public readonly hint: string,
    code = 'TMR_E201',
  ) {
    super('No tmr vault found in this directory or any parent.', code);
    this.name = 'VaultNotFoundError';
    Object.setPrototypeOf(this, VaultNotFoundError.prototype);
  }
}

/** Thrown when an email address fails validation. */
export class InvalidEmailError extends TmrError {
  constructor(email: string, code = 'TMR_E103') {
    super(`Invalid email address: ${email}`, code);
    this.name = 'InvalidEmailError';
    Object.setPrototypeOf(this, InvalidEmailError.prototype);
  }
}

/** Thrown when AI confidence is below the routing threshold. */
export class ConfidenceThresholdError extends TmrError {
  constructor(confidence: number, threshold: number, code = 'TMR_E104') {
    super(
      `AI confidence ${confidence.toFixed(2)} is below threshold ${threshold.toFixed(2)}`,
      code,
    );
    this.name = 'ConfidenceThresholdError';
    Object.setPrototypeOf(this, ConfidenceThresholdError.prototype);
  }
}
