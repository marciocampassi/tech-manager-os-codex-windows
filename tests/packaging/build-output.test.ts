import { describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
const distCli = path.join(rootDir, 'dist', 'cli.js');

const DEV_ONLY_PACKAGES = [
  'jest',
  'ts-jest',
  'ts-node',
  'eslint',
  'prettier',
  'husky',
  '@typescript-eslint',
];

describe('dist/ build output — clean distribution artifact (AC: 2)', () => {
  it('dist/cli.js exists after build', () => {
    expect(fs.existsSync(distCli)).toBe(true);
  });

  it('dist/cli.js starts with Node.js shebang (AC: 3)', () => {
    const firstLine = fs.readFileSync(distCli, 'utf8').split('\n')[0];
    expect(firstLine.trim()).toBe('#!/usr/bin/env node');
  });

  it('dist/cli.js does not contain dev-only package references', () => {
    const content = fs.readFileSync(distCli, 'utf8');
    for (const devPkg of DEV_ONLY_PACKAGES) {
      expect(content).not.toContain(`require("${devPkg}")`);
      expect(content).not.toContain(`from "${devPkg}"`);
    }
  });
});
