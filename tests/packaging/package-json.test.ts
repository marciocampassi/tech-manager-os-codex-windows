import { beforeAll, describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
const pkgPath = path.join(rootDir, 'package.json');

interface PackageJson {
  name: string;
  version: string;
  type?: string;
  bin?: Record<string, string>;
  files?: string[];
  engines?: Record<string, string>;
  license?: string;
  [key: string]: unknown;
}

function readPackageJson(): PackageJson {
  const raw = fs.readFileSync(pkgPath, 'utf8');
  return JSON.parse(raw) as PackageJson;
}

describe('package.json — npm distribution readiness (AC: 1)', () => {
  let pkg: PackageJson;

  beforeAll(() => {
    pkg = readPackageJson();
  });

  it('name is unscoped tech-manager-os (enables npx tech-manager-os init)', () => {
    expect(pkg.name).toBe('tech-manager-os');
  });

  it('version is a valid semver string', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('bin declares tmr pointing to dist/cli.js', () => {
    expect(pkg.bin).toBeDefined();
    // npm pkg fix normalises ./dist/cli.js → dist/cli.js (canonical form)
    expect(pkg.bin!['tmr']).toMatch(/^\.?\/?(dist\/cli\.js)$/);
  });

  it('files array includes only dist/', () => {
    expect(pkg.files).toBeDefined();
    expect(pkg.files).toContain('dist');
  });

  it('engines.node is set to >=18.0.0 or higher', () => {
    expect(pkg.engines).toBeDefined();
    expect(pkg.engines!['node']).toMatch(/^>=\d+\.\d+\.\d+/);
  });

  it('license is MIT', () => {
    expect(pkg.license).toBe('MIT');
  });

  it('type is module (ESM)', () => {
    expect(pkg.type).toBe('module');
  });
});
