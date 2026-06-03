import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

const { resolveSelfEmail } = await import('../../src/utils/self-email.js');

describe('resolveSelfEmail', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-self-email-test-'));
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('returns null when my-career/ directory does not exist', async () => {
    const result = await resolveSelfEmail(workspace);
    expect(result).toBeNull();
  });

  it('returns null when my-career/ directory is empty', async () => {
    fs.mkdirSync(path.join(workspace, 'my-career'));
    const result = await resolveSelfEmail(workspace);
    expect(result).toBeNull();
  });

  it('returns null when profile has no email field in frontmatter', async () => {
    const careerDir = path.join(workspace, 'my-career');
    fs.mkdirSync(careerDir);
    fs.writeFileSync(path.join(careerDir, 'me.md'), '---\nname: No Email Here\n---\n');
    const result = await resolveSelfEmail(workspace);
    expect(result).toBeNull();
  });

  it('returns the email from the first .md file found', async () => {
    const careerDir = path.join(workspace, 'my-career');
    fs.mkdirSync(careerDir);
    fs.writeFileSync(path.join(careerDir, 'me@co.com.md'), '---\nemail: me@co.com\n---\n');
    const result = await resolveSelfEmail(workspace);
    expect(result).toBe('me@co.com');
  });

  it('normalizes email to lowercase', async () => {
    const careerDir = path.join(workspace, 'my-career');
    fs.mkdirSync(careerDir);
    fs.writeFileSync(path.join(careerDir, 'Me@Co.Com.md'), '---\nemail: Me@Co.Com\n---\n');
    const result = await resolveSelfEmail(workspace);
    expect(result).toBe('me@co.com');
  });

  it('ignores non-.md files in my-career/', async () => {
    const careerDir = path.join(workspace, 'my-career');
    fs.mkdirSync(careerDir);
    fs.writeFileSync(path.join(careerDir, 'notes.txt'), 'email: not-a-profile@co.com');
    const result = await resolveSelfEmail(workspace);
    expect(result).toBeNull();
  });

  it('returns null when email field is a whitespace-only string', async () => {
    const careerDir = path.join(workspace, 'my-career');
    fs.mkdirSync(careerDir);
    fs.writeFileSync(path.join(careerDir, 'me.md'), '---\nemail: "   "\n---\n');
    const result = await resolveSelfEmail(workspace);
    expect(result).toBeNull();
  });

  it('uses the alphabetically first file when multiple .md files exist', async () => {
    const careerDir = path.join(workspace, 'my-career');
    fs.mkdirSync(careerDir);
    fs.writeFileSync(path.join(careerDir, 'b-profile.md'), '---\nemail: b@co.com\n---\n');
    fs.writeFileSync(path.join(careerDir, 'a-profile.md'), '---\nemail: a@co.com\n---\n');
    const result = await resolveSelfEmail(workspace);
    expect(result).toBe('a@co.com');
  });

  it('returns null when my-career/ path is a file rather than a directory', async () => {
    fs.writeFileSync(path.join(workspace, 'my-career'), 'not a directory');
    const result = await resolveSelfEmail(workspace);
    expect(result).toBeNull();
  });
});
