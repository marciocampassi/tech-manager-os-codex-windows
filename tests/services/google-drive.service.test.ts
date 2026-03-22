import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ── Mock googleapis before dynamic import ─────────────────────────────────────

const mockDriveFilesList = jest
  .fn<() => Promise<{ data: { files?: { id?: string }[] } }>>()
  .mockResolvedValue({ data: { files: [] } });
const mockDriveFilesCreate = jest
  .fn<() => Promise<{ data: { id?: string } }>>()
  .mockResolvedValue({ data: { id: 'doc-id-123' } });
const mockDrivePermissionsCreate = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockDocsBatchUpdate = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

jest.unstable_mockModule('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest
          .fn<() => string>()
          .mockReturnValue('https://accounts.google.com/auth?mock'),
        getToken: jest
          .fn<() => Promise<{ tokens: { access_token: string } }>>()
          .mockResolvedValue({ tokens: { access_token: 'mock-token' } }),
      })),
    },
    drive: jest.fn().mockReturnValue({
      files: {
        list: mockDriveFilesList,
        create: mockDriveFilesCreate,
      },
      permissions: {
        create: mockDrivePermissionsCreate,
      },
    }),
    docs: jest.fn().mockReturnValue({
      documents: {
        batchUpdate: mockDocsBatchUpdate,
      },
    }),
  },
}));

const mockWriteFile = jest
  .fn<(path: string, content: string) => Promise<void>>()
  .mockResolvedValue(undefined);
const mockExists = jest.fn<(path: string) => Promise<boolean>>().mockResolvedValue(false);

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: {
    writeFile: mockWriteFile,
    exists: mockExists,
  },
  FileSystemService: jest.fn(),
}));

const {
  GoogleDriveService,
  generateSyncScript,
  generateSyncSetupGuide,
  generateGdocPointerContent,
} = await import('../../src/services/google-drive.service.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GoogleDriveService', () => {
  let svc: InstanceType<typeof GoogleDriveService>;
  const FAKE_FS = { writeFile: mockWriteFile, exists: mockExists } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new GoogleDriveService(FAKE_FS);
    // Seed _oauth2Client so API methods don't throw "not authenticated".
    // The actual value doesn't matter — all googleapis calls are mocked.
    (svc as unknown as { _oauth2Client: object })._oauth2Client = {};
    mockDriveFilesCreate.mockResolvedValue({ data: { id: 'doc-id-123' } });
    mockDriveFilesList.mockResolvedValue({ data: { files: [] } });
  });

  describe('createActionItemsDoc', () => {
    it('returns docId and url on success', async () => {
      const result = await svc.createActionItemsDoc('dev@co.com', 'folder-123', 'template');
      expect(result.docId).toBe('doc-id-123');
      expect(result.url).toContain('doc-id-123');
    });

    it('calls drive.files.create with correct name and mimeType', async () => {
      await svc.createActionItemsDoc('dev@co.com', 'folder-123', 'template');
      expect(mockDriveFilesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            name: 'action-items-dev@co.com',
            mimeType: 'application/vnd.google-apps.document',
          }),
        }),
      );
    });

    it('gracefully returns empty strings on failure (never throws)', async () => {
      mockDriveFilesCreate.mockRejectedValueOnce(new Error('quota exceeded'));
      const result = await svc.createActionItemsDoc('fail@co.com', 'folder-123', 'template');
      expect(result.docId).toBe('');
      expect(result.url).toBe('');
    });
  });

  describe('shareDocument', () => {
    it('calls drive.permissions.create with correct email and role', async () => {
      await svc.shareDocument('doc-id-123', 'dev@co.com', 'writer');
      expect(mockDrivePermissionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'doc-id-123',
          requestBody: expect.objectContaining({
            type: 'user',
            role: 'writer',
            emailAddress: 'dev@co.com',
          }),
        }),
      );
    });

    it('never throws on failure — graceful degradation', async () => {
      mockDrivePermissionsCreate.mockRejectedValueOnce(new Error('permission denied'));
      await expect(svc.shareDocument('doc-123', 'x@co.com', 'reader')).resolves.toBeUndefined();
    });
  });

  describe('createGdocPointerFile', () => {
    it('writes correct JSON to the local path', async () => {
      await svc.createGdocPointerFile(
        '/path/action-items.gdoc',
        'doc-123',
        'https://docs.google.com/d/doc-123',
        'dev@co.com',
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/path/action-items.gdoc',
        expect.stringContaining('doc-123'),
      );
    });

    it('writes JSON containing url, doc_id, and email fields', async () => {
      await svc.createGdocPointerFile('/path/file.gdoc', 'id-abc', 'https://url', 'a@b.com');
      const written = (mockWriteFile.mock.calls[0] as [string, string])[1];
      const parsed = JSON.parse(written) as Record<string, string>;
      expect(parsed['url']).toBe('https://url');
      expect(parsed['doc_id']).toBe('id-abc');
      expect(parsed['email']).toBe('a@b.com');
    });

    it('never throws on failure — graceful degradation', async () => {
      mockWriteFile.mockRejectedValueOnce(new Error('disk full'));
      await expect(
        svc.createGdocPointerFile('/path/file.gdoc', 'id', 'url', 'a@b.com'),
      ).resolves.toBeUndefined();
    });
  });
});

describe('generateSyncScript', () => {
  it('substitutes the team folder ID in the output', () => {
    const result = generateSyncScript('my-folder-id-123');
    expect(result).toContain("const TEAM_FOLDER_ID = 'my-folder-id-123'");
  });

  it('includes syncDocsToMarkdown and onInstall functions', () => {
    const result = generateSyncScript('folder-id');
    expect(result).toContain('function syncDocsToMarkdown()');
    expect(result).toContain('function onInstall()');
  });

  it('sets up daily trigger at hour 7', () => {
    const result = generateSyncScript('folder-id');
    expect(result).toContain('.atHour(7)');
    expect(result).toContain('.everyDays(1)');
  });
});

describe('generateSyncSetupGuide', () => {
  it('includes both Option A and Option B', () => {
    const result = generateSyncSetupGuide();
    expect(result).toContain('Option A: Deploy with clasp');
    expect(result).toContain('Option B: Deploy manually via the web editor');
  });

  it('includes the architecture note about AppScript cloud execution', () => {
    const result = generateSyncSetupGuide();
    expect(result).toContain("AppScript runs in Google's cloud");
    expect(result).toContain('Google Drive for Desktop');
  });

  it('includes clasp commands', () => {
    const result = generateSyncSetupGuide();
    expect(result).toContain('clasp login');
    expect(result).toContain('clasp push');
  });
});

describe('generateGdocPointerContent', () => {
  it('produces valid JSON with url, doc_id, email fields', () => {
    const result = generateGdocPointerContent(
      'doc-123',
      'https://docs.google.com/d/doc-123',
      'dev@co.com',
    );
    const parsed = JSON.parse(result) as Record<string, string>;
    expect(parsed['url']).toBe('https://docs.google.com/d/doc-123');
    expect(parsed['doc_id']).toBe('doc-123');
    expect(parsed['email']).toBe('dev@co.com');
  });
});
