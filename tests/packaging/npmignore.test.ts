import { beforeAll, describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
const npmignorePath = path.join(rootDir, '.npmignore');

const REQUIRED_EXCLUSIONS = [
  'src/',
  'tests/',
  'coverage/',
  'docs/',
  '.bmad-core/',
  '.cursor/',
  '.github/',
  '.husky/',
  'skills/',
  'tsconfig',
];

describe('.npmignore — excludes dev/source files from npm publish (AC: 4)', () => {
  let lines: string[];

  beforeAll(() => {
    const content = fs.readFileSync(npmignorePath, 'utf8');
    lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
  });

  it('.npmignore file exists at repo root', () => {
    expect(fs.existsSync(npmignorePath)).toBe(true);
  });

  for (const exclusion of REQUIRED_EXCLUSIONS) {
    it(`excludes ${exclusion}`, () => {
      const covered = lines.some((l) => l === exclusion || l.startsWith(exclusion));
      expect(covered).toBe(true);
    });
  }
});
