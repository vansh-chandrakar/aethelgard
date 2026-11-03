# Aethelgard — The Chrono-Journal

Local-first journaling web app built with plain HTML, CSS, and JavaScript.

## Run locally
Run from a local web server (not by opening `index.html` directly):
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`. Google OAuth requires the app to run on an authorized HTTPS origin or an authorized localhost origin.

## Current features
- Local journal entries in IndexedDB, autosave, search, tags, word count
- Rich-text and Markdown modes sharing a common saved representation
- 20 themes, timeline, tag-based connections, manually initiated reflection prompts
- JSON backup/restore
- Google Identity Services OAuth token flow and Google Drive folder/vault creation
- Client-side AES-256-GCM encryption; PBKDF2-SHA-256 key derivation
- Encrypted vault merge by entry ID and most recent `updatedAt` timestamp
- Basic PWA manifest and offline app shell

## Google setup required
1. Create a project in Google Cloud Console.
2. Enable the Google Drive API.
3. Configure the OAuth consent screen and add test users while the app is in testing.
4. Create an OAuth 2.0 Client ID of type **Web application**.
5. Add your development origin (for example `http://localhost:8000`) and eventual deployed origin to **Authorized JavaScript origins**. Do not add a client secret to this frontend.
6. Paste the Client ID into `config.js` as `GOOGLE_CLIENT_ID`.

The app requests `drive.file` rather than broad access to the user's entire Drive. The Aethelgard folder and vault file are created by this app.

## Vault behavior and security notes
- Google OAuth access tokens are held in memory only. The user must authorize again in a new browser session or when the short-lived token expires.
- The vault passphrase is separate from the Google password and is never stored or uploaded. Use the same passphrase on every device. If it is lost, the encrypted data cannot be decrypted.
- The encrypted file is uploaded only after encryption in the browser.
- The current sync is user-initiated; it merges entries by ID and uses the newest `updatedAt` value for a same-ID conflict. It is not yet a fully automatic real-time sync engine.
- This is an early prototype, not a security-audited product. Do not store highly sensitive information until the implementation has been reviewed and tested.
- Current encryption settings are PBKDF2-SHA-256 with 310,000 iterations and AES-256-GCM.

## Still to build
- More robust OAuth/session UX and automatic token renewal interaction
- Sync queue, conflict review/history, and reliable cross-device change detection
- Guest-to-Google migration UX
- Optional PIN/biometric app lock (separate from vault encryption)
- PDF and ZIP exports, attachments, richer graph visualization
- Production security review, accessibility and browser testing
