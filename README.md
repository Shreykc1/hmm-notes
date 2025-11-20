# 🔒 Secure Notes Local

A **local-first**, **client-side encrypted** notes application with biometric authentication and cross-device QR unlock. Built with Next.js, TypeScript, and the Web Crypto API.

## ✨ Features

- **🔐 Client-Side Encryption**: All notes encrypted using AES-GCM-256 with Web Crypto API
- **🔑 Wrapped Master Key**: PBKDF2-SHA256 (200k iterations) for passphrase-based key derivation
- **👆 Biometric Unlock**: Touch ID, Face ID, Windows Hello support via WebAuthn
- **📱 Cross-Device QR Unlock**: Unlock your PC by scanning a QR code with your phone
- **💾 Local Storage**: All data stored in IndexedDB - no server required
- **📦 Export/Import**: Backup and restore your encrypted notes
- **⏱️ Auto-Lock**: Automatic session timeout after 5 minutes of inactivity
- **🛡️ Security-First**: Strict CSP, no external scripts, XSS protection

## 🏗️ Architecture

### Encryption Flow

```
User Passphrase
    ↓
PBKDF2-SHA256 (200k iterations) + Random Salt
    ↓
Wrapping Key (AES-GCM-256)
    ↓
Wraps → Random Master Key (AES-GCM-256)
    ↓
Master Key encrypts/decrypts → Notes
```

### Storage Schema

**IndexedDB Stores:**
- `notes`: Encrypted note content (ciphertext + IV)
- `masterKey`: Wrapped master key + salt + IV + iterations
- `webauthn`: WebAuthn credentials (public key + metadata)

### QR Unlock Flow

```
PC (shows QR)                    Relay Server              Phone (scans QR)
    |                                  |                           |
    |--Create Session (sessionId)--→  |                           |
    |                                  |                           |
    |                                  |  ←--Scan QR (sessionId)---|
    |                                  |                           |
    |                                  |  ←--WebAuthn Auth---------|
    |                                  |  (assertion + signature)  |
    |                                  |                           |
    |--Poll for assertion----------→  |                           |
    |←-Assertion + challenge--------  |                           |
    |                                  |                           |
Verify Signature Locally                                          |
(using stored public key)
    ↓
Unlock
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm

### Installation

1. **Clone the repository**
   ```bash
   cd secure-notes-local
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

### First-Time Setup

1. Navigate to `http://localhost:3000`
2. You'll be redirected to the setup page
3. Enter a strong passphrase (12+ characters recommended)
4. Optionally enable biometric unlock
5. Click "Create Account (Local)"
6. Start creating encrypted notes!

## 🔐 Security Model

### What's Encrypted

- ✅ All note content (encrypted with AES-GCM before storage)
- ✅ Master key (wrapped with passphrase-derived key)
- ❌ Metadata (note IDs, timestamps) - not encrypted

### Key Management

**Primary Approach: Wrapped Master Key**
- Generates a random AES-GCM-256 master key on setup
- Wraps master key with passphrase-derived key (PBKDF2-SHA256, 200k iterations)
- Stores only the wrapped key, salt, and IV in IndexedDB
- **Pros**: Can change passphrase without re-encrypting all notes
- **Cons**: Slightly more complex implementation

**Alternative: Direct Derivation** (not implemented, documented for reference)
- Derive master key directly from passphrase using PBKDF2
- **Pros**: Simpler implementation
- **Cons**: Changing passphrase requires re-encrypting all notes

### WebAuthn as Convenience Unlock

⚠️ **Important**: Biometric unlock is a **convenience feature**, NOT a replacement for passphrases:

- WebAuthn credentials are **device-bound** (don't sync across devices)
- If you lose your device, you **need your passphrase** to restore from backup
- The passphrase is still required for initial setup and backup restoration

### What Never Leaves Your Device

- ❌ Passphrases
- ❌ Master keys (unwrapped)
- ❌ Plaintext note content
- ❌ Private keys

### What the Relay Server Stores (Temporarily)

- ✅ Session IDs (TTL: 120 seconds)
- ✅ WebAuthn assertions (challenge-response, signed)
- ❌ Never stores plaintext notes or passphrases

## 📱 QR Unlock Usage

### On PC:
1. Click "🔒 Lock" to lock the app
2. Click "📱 Unlock with Phone (QR)"
3. A QR code appears with a 120-second countdown

### On Phone:
1. Open the same app on your phone
2. Use your camera to scan the QR code
3. Authenticate with Face ID/Touch ID/Fingerprint
4. PC unlocks automatically

**Requirements:**
- Both devices must access the same relay server (localhost for dev, deployed URL for production)
- Phone must have a WebAuthn credential registered
- HTTPS required in production

## 📦 Export & Import

### Export Backup
1. Click "📥 Export" in the header
2. Downloads a `.json` file containing:
   - Wrapped master key
   - All encrypted notes (ciphertext + IV)
   - Export timestamp

### Import Backup
1. Click "📤 Import" in the header
2. Select the `.json` backup file
3. Notes are imported (still encrypted)
4. Enter your passphrase to decrypt

⚠️ **Backup Security**: The backup file is encrypted, but protect it like you would protect your passphrase.

## 🧪 Testing

### Unit Tests
```bash
npm test
```

Tests cover:
- Crypto functions (with mocked Web Crypto API)
- WebAuthn helpers
- IndexedDB operations

### E2E Tests  
```bash
npm run test:e2e
```

Playwright tests for:
- Setup flow
- Note creation/editing
- Lock/unlock
- Export/import

### Manual QR Flow Testing

**Option 1: ngrok (Local Dev)**
```bash
# Terminal 1: Run dev server
npm run dev

# Terminal 2: Expose with ngrok
ngrok http 3000

# Use the ngrok HTTPS URL on both devices
```

**Option 2: Vercel Preview (Recommended)**
```bash
# Deploy to Vercel preview
vercel

# Access preview URL from both PC and phone
```

## 🚀 Deployment

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel auto-detects Next.js
   - Click "Deploy"

3. **Access Your App**
   - Visit the deployed URL (e.g., `https://secure-notes.vercel.app`)
   - QR unlock works automatically with serverless API routes

### Environment Variables

No environment variables required! The in-memory relay works for both local and production.

**Optional (for production scale):**
- `UPSTASH_REDIS_URL`: For persistent session storage (not implemented in this version)

## 📁 Project Structure

```
secure-notes-local/
├── app/
│   ├── page.tsx              # Main dashboard
│   ├── setup/page.tsx        # Initial setup
│   ├── auth/
│   │   ├── qr/page.tsx       # QR code display (PC)
│   │   └── scan/page.tsx     # QR scan (Phone)
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   ├── UnlockModal.tsx       # Unlock UI
│   ├── NoteEditor.tsx        # Note editing
│   ├── QRCode.tsx            # QR display
│   ├── PassphraseStrength.tsx
│   └── SessionTimer.tsx      # Auto-lock timer
├── lib/
│   ├── crypto.ts             # Web Crypto utilities
│   ├── webauthn.ts           # WebAuthn helpers
│   └── indexeddb.ts          # Storage layer
├── pages/api/
│   ├── session.ts            # Create session
│   └── session/[id].ts       # Store/retrieve assertions
├── tests/
│   └── e2e/                  # Playwright tests
├── package.json
├── next.config.ts            # Security headers
├── jest.config.ts
├── playwright.config.ts
├── README.md                 # This file
└── audit.md                  # Security checklist
```

## 🔧 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:e2e` - Run E2E tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## ⚠️ Security Considerations

### XSS Risk
If an attacker injects JavaScript into an unlocked session, they can read plaintext notes.

**Mitigations:**
- Strict Content Security Policy (CSP)
- No third-party scripts
- Input sanitization
- Auto-lock after inactivity

### Passphrase Loss
**There is no password recovery.** If you lose your passphrase, your notes are permanently inaccessible.

**Best Practices:**
- Use a password manager to store your passphrase
- Create regular encrypted backups
- Test backup restoration periodically

### Device Loss
- Biometric credentials are device-bound
- Use your passphrase to restore from backup on a new device
- Register new biometric credentials on the new device

### Relay Server
- The relay is stateless and ephemeral (120s TTL)
- Uses challenge-response to prevent replay attacks
- Verifies WebAuthn signatures locally (client-side)
- Never stores plaintext data

## 📚 Dependencies

### Core
- **Next.js 16**: React framework
- **React 19**: UI library
- **TypeScript**: Type safety

### Crypto & Auth
- **Web Crypto API**: Native browser cryptography
- **WebAuthn API**: Native browser biometric auth

### Storage & Utilities
- **idb**: IndexedDB wrapper
- **uuid**: Session ID generation
- **qrcode.react**: QR code generation
- **zod**: Runtime validation

### Testing
- **Jest**: Unit testing
- **Playwright**: E2E testing
- **Testing Library**: React testing utilities

## 📄 License

MIT

## 🙏 Acknowledgments

Built with security-first principles:
- Uses native Web Crypto API (no custom crypto)
- Follows OWASP best practices
- Implements defense in depth
- Transparent about limitations

## 🆘 Troubleshooting

### WebAuthn not working
- **Chrome/Edge**: Requires HTTPS (or localhost)
- **Firefox**: Check `about:config` → `security.webauthn.enable`
- **Safari**: Requires macOS with Touch ID or iOS with Face ID

### Notes not decrypting
- Verify correct passphrase
- Check browser console for errors
- Try exporting and reimporting backup

### QR unlock timeout
- Ensure both devices use the same server URL
- Check network connectivity
- Try increasing timeout in API routes

## 📞 Support

For issues, questions, or contributions, please refer to the repository's issue tracker.

---

**Remember**: Your security is only as strong as your passphrase. Choose wisely! 🔐
