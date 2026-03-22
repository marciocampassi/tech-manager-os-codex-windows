import { createServer } from 'node:http';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { fileSystemService, FileSystemService } from './file-system.service.js';
import { logger } from '../utils/logger.js';

export interface IGoogleDriveService {
  authenticate(clientId: string, clientSecret: string): Promise<Record<string, unknown>>;
  createActionItemsDoc(
    email: string,
    teamFolderDriveId: string,
    templateContent: string,
  ): Promise<{ docId: string; url: string }>;
  shareDocument(docId: string, email: string, role: 'reader' | 'writer'): Promise<void>;
  createGdocPointerFile(
    localPath: string,
    docId: string,
    url: string,
    email: string,
  ): Promise<void>;
}

const OAUTH_REDIRECT_PORT = 3000;
const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_REDIRECT_PORT}/oauth2callback`;
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
];

export class GoogleDriveService implements IGoogleDriveService {
  private _oauth2Client: OAuth2Client | null = null;

  constructor(private readonly _fs: FileSystemService) {}

  /**
   * Runs the OAuth2 flow: opens browser → captures code via local HTTP server →
   * exchanges code for token. Stores the authenticated client internally for
   * subsequent API calls. Returns the token object for storage.
   * Never throws — logs and returns empty object on failure.
   */
  async authenticate(clientId: string, clientSecret: string): Promise<Record<string, unknown>> {
    try {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, OAUTH_REDIRECT_URI);

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: OAUTH_SCOPES,
      });

      process.stdout.write(`\nOpen this URL in your browser to authenticate:\n${authUrl}\n\n`);

      const code = await this._captureAuthCode();
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      this._oauth2Client = oauth2Client;
      return tokens as Record<string, unknown>;
    } catch (err) {
      logger.warn('Google OAuth authentication failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return {};
    }
  }

  /**
   * Creates or reuses a subfolder for the member, creates a Google Doc populated with
   * the action items template content, and shares it with the member.
   * Never throws — returns empty strings and logs on failure.
   */
  async createActionItemsDoc(
    email: string,
    teamFolderDriveId: string,
    templateContent: string,
  ): Promise<{ docId: string; url: string }> {
    try {
      const auth = this._getAuthClient();
      const drive = google.drive({ version: 'v3', auth });
      const docs = google.docs({ version: 'v1', auth });

      const subfolderId = await this._ensureSubfolder(drive, email, teamFolderDriveId);

      const docName = `action-items-${email}`;
      const createResponse = await drive.files.create({
        requestBody: {
          name: docName,
          mimeType: 'application/vnd.google-apps.document',
          parents: [subfolderId],
        },
        fields: 'id',
      });

      const docId = createResponse.data.id ?? '';
      if (!docId) throw new Error('Drive file creation returned no id');

      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: templateContent,
              },
            },
          ],
        },
      });

      const url = `https://docs.google.com/document/d/${docId}/edit`;
      return { docId, url };
    } catch (err) {
      logger.warn('Failed to create Google Doc for action items', {
        email,
        error: err instanceof Error ? err.message : String(err),
      });
      return { docId: '', url: '' };
    }
  }

  /**
   * Shares a Google Doc with the specified email and role.
   * Never throws — logs on failure.
   */
  async shareDocument(docId: string, email: string, role: 'reader' | 'writer'): Promise<void> {
    try {
      const auth = this._getAuthClient();
      const drive = google.drive({ version: 'v3', auth });

      await drive.permissions.create({
        fileId: docId,
        requestBody: {
          type: 'user',
          role,
          emailAddress: email,
        },
      });
    } catch (err) {
      logger.warn('Failed to share Google Doc', {
        docId,
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Writes a .gdoc pointer file that allows Google Drive for Desktop users
   * to open the GDoc directly from their local vault.
   * Never throws — logs on failure.
   */
  async createGdocPointerFile(
    localPath: string,
    docId: string,
    url: string,
    email: string,
  ): Promise<void> {
    try {
      const pointer = JSON.stringify({ url, doc_id: docId, email }, null, 2);
      await this._fs.writeFile(localPath, pointer);
    } catch (err) {
      logger.warn('Failed to create .gdoc pointer file', {
        localPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private _getAuthClient(): OAuth2Client {
    if (!this._oauth2Client) {
      throw new Error('No access, refresh token, API key or refresh handler callback is set.');
    }
    return this._oauth2Client;
  }

  private async _captureAuthCode(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let settled = false;

      const settle = (code: string | null, error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        server.close();
        if (code) {
          resolve(code);
        } else {
          reject(error ?? new Error('No auth code received'));
        }
      };

      const server = createServer((req, res) => {
        const url = new URL(req.url ?? '/', `http://localhost:${OAUTH_REDIRECT_PORT}`);
        const code = url.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication complete. You can close this tab.</h1>');
        settle(code);
      });

      server.listen(OAUTH_REDIRECT_PORT, () => {
        logger.debug(`OAuth callback server listening on port ${OAUTH_REDIRECT_PORT}`);
      });

      server.on('error', (err) =>
        settle(null, err instanceof Error ? err : new Error(String(err))),
      );

      const timeout = setTimeout(() => {
        settle(null, new Error('OAuth timeout — no callback received within 5 minutes'));
      }, 300_000);
    });
  }

  private async _ensureSubfolder(
    drive: ReturnType<typeof google.drive>,
    email: string,
    parentFolderId: string,
  ): Promise<string> {
    const searchResponse = await drive.files.list({
      q: `name='${email}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
      fields: 'files(id)',
    });

    const existing = searchResponse.data.files?.[0];
    if (existing?.id) return existing.id;

    const createResponse = await drive.files.create({
      requestBody: {
        name: email,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
    });

    const id = createResponse.data.id;
    if (!id) throw new Error(`Failed to create subfolder for ${email}`);
    return id;
  }
}

export const googleDriveService = new GoogleDriveService(fileSystemService);

export function generateSyncScript(teamFolderDriveId: string): string {
  return `function syncDocsToMarkdown() {
  const TEAM_FOLDER_ID = '${teamFolderDriveId}';

  const teamFolder = DriveApp.getFolderById(TEAM_FOLDER_ID);
  const userFolders = teamFolder.getFolders();

  while (userFolders.hasNext()) {
    const userFolder = userFolders.next();
    const userEmail = userFolder.getName();

    const docName = \`action-items-\${userEmail}\`;
    const mdName = \`action-items-\${userEmail}.md\`;

    const files = userFolder.getFilesByName(docName);
    let docFile = null;

    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType() === MimeType.GOOGLE_DOCS) {
        docFile = file;
        break;
      }
    }

    if (!docFile) continue;

    const doc = DocumentApp.openById(docFile.getId());
    const mdContent = doc.getBody().getText();

    const mdFiles = userFolder.getFilesByName(mdName);

    if (mdFiles.hasNext()) {
      mdFiles.next().setContent(mdContent);
    } else {
      userFolder.createFile(mdName, mdContent, MimeType.PLAIN_TEXT);
    }
  }
}

function onInstall() {
  ScriptApp.newTrigger('syncDocsToMarkdown')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
}
`;
}

export function generateSyncSetupGuide(): string {
  return `# Action Items Sync — Setup Guide

This guide helps you deploy the Google AppScript that syncs your team members'
Google Docs to their local \`.md\` action items files.

## How It Works

1. Each team member has a Google Doc (\`action-items-{email}\`) in Google Drive
2. The AppScript \`syncDocsToMarkdown()\` runs **daily at 7 AM** and copies
   the Google Doc content to the corresponding \`.md\` file in Google Drive
3. If your workspace folder is synced via **Google Drive for Desktop**,
   the updated \`.md\` appears automatically in your local Obsidian vault

## Architecture Note

> AppScript runs in Google's cloud — it **cannot write directly to your local filesystem**.
> For the sync to reach your local Obsidian vault, install
> [Google Drive for Desktop](https://www.google.com/drive/download/) and sync your
> workspace folder to Google Drive.

---

## Option A: Deploy with clasp (Recommended)

\`clasp\` is Google's official CLI for Apps Script. It automates all deployment steps.

### Install clasp (one-time)

\`\`\`bash
npm install -g @google/clasp
\`\`\`

### Deploy the sync script

\`\`\`bash
cd utils
clasp login                                                     # authenticate with Google
clasp create --title "TMR Action Items Sync" --type standalone  # create Apps Script project
clasp push                                                      # upload sync-action-items.gs
clasp run onInstall                                             # set up the daily trigger
\`\`\`

### Update the script after changes

\`\`\`bash
cd utils && clasp push
\`\`\`

---

## Option B: Deploy manually via the web editor

If you prefer not to use clasp:

1. Open [Google Apps Script](https://script.google.com)
2. Click **New project** (top left)
3. Delete the default \`myFunction\` code
4. Paste the entire contents of \`utils/sync-action-items.gs\`
5. Click **Save** (name the project "TMR Action Items Sync")
6. In the function dropdown (top bar), select \`onInstall\`
7. Click **Run** — this registers the daily trigger
8. Authorize the script when prompted (you may need to click "Advanced" → "Go to TMR...")

### Verify the trigger was created

1. In the Apps Script editor, click **Triggers** (alarm clock icon, left sidebar)
2. You should see \`syncDocsToMarkdown\` listed with "Day timer" frequency

---

## Troubleshooting

| Problem | Solution |
| :------ | :------- |
| "No folder found" | Verify \`TEAM_FOLDER_ID\` in \`sync-action-items.gs\` matches your Drive folder ID |
| Permission errors | In Apps Script editor: Run → Review permissions → Allow |
| Changes not appearing locally | Ensure Google Drive for Desktop is running and synced |
| \`clasp run onInstall\` fails | Open Apps Script editor, select \`onInstall\`, click Run manually |
| Duplicate triggers | In Apps Script → Triggers, delete extra entries for \`syncDocsToMarkdown\` |
`;
}

export function generateGdocPointerContent(docId: string, url: string, email: string): string {
  return JSON.stringify({ url, doc_id: docId, email }, null, 2);
}
