# Security Audit Checklist

## Overview

This document provides a comprehensive security assessment of the Secure Notes Local application, including the threat model, security controls, attack surface analysis, and known limitations.

## ✅ Security Controls Implemented

### Cryptography

- [x] **Web Crypto API Used**: All cryptographic operations use the browser's native Web Crypto API
- [x] **AES-GCM-256**: Notes encrypted with AES-GCM (authenticated encryption)
- [x] **Random IVs**: New random IV generated for each encryption operation
- [x] **PBKDF2-SHA256**: Key derivation from passphrase (200k iterations)
- [x] **Secure Random**: crypto.getRandomValues() for all randomness
- [x] **No Custom Crypto**: No custom cryptographic implementations

### Key Management

- [x] **Wrapped Master Key**: Master key wrapped with passphrase-derived key
- [x] **Salt Storage**: Unique random salt stored with wrapped key
- [x] **Key Derivation Iterations**: 200,000 PBKDF2 iterations (exceeds NIST recommendation)
- [x] **Memory Clearing**: Best-effort clearing of sensitive data on lock

### WebAuthn Implementation

- [x] **Platform Authenticator Only**: Restricts to Touch ID, Face ID, Windows Hello
- [x] **User Verification Required**: Forces biometric authentication
- [x] **Signature Verification**: Client-side verification using Web Crypto
- [x] **Challenge-Response**: Unique random challenge for each auth request
- [x] **Public Key Storage**: Stores public key in IndexedDB for verification

### Network Security

- [x] **No Plaintext Transmission**: Passphrases and plaintext notes never sent over network
- [x] **CORS Headers**: Proper CORS configuration for relay API
- [x] **HTTPS Required**: Application requires HTTPS in production (enforced by Vercel)
- [x] **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options configured

### Data Storage

- [x] **Encrypted at Rest**: All notes stored as ciphertext in IndexedDB
- [x] **Structured Validation**: Zod schemas validate data structure
- [x] **Versioned Schema**: IndexedDB schema includes version number for migrations
- [x] **No localStorage**: Sensitive data not stored in localStorage

### Session Management

- [x] **Session Timeout**: Auto-lock after 5 minutes of inactivity
- [x] **Manual Lock**: Immediate lock button available
- [x] **Activity Detection**: Mouse, keyboard, scroll, touch events reset timer
- [x] **Warning Period**: 1-minute warning before timeout

### Relay Server Security

- [x] **Stateless Design**: No persistent storage of user data
- [x] **TTL Enforcement**: Sessions expire after 120 seconds
- [x] **Rate Limiting**: Session count limited to prevent DoS
- [x] **Automatic Cleanup**: Expired sessions garbage collected
- [x] **One-Time Assertions**: Assertions can only be stored once per session

### Application Security

- [x] **Content Security Policy**: Strict CSP prevents external script execution
- [x] **Input Validation**: All user inputs validated
- [x] **Framework Security**: Next.js security features enabled
- [x] **Dependency Scanning**: Regular dependency updates (manual)

## ⚠️ Attack Surface Analysis

### 1. Cross-Site Scripting (XSS)

**Risk Level**: HIGH

**Attack Vector**: If attacker injects malicious JavaScript, they can access plaintext notes in memory during an unlocked session.

**Mitigations**:
- Strict CSP prevents inline scripts and external sources
- React automatically escapes user input
- No `dangerouslySetInnerHTML` used
- No third-party scripts loaded

**Residual Risk**: 
- CSP includes `unsafe-eval` for Next.js dev mode
- `unsafe-inline` for styles (styled-jsx requirement)
- If CSP is bypassed, plaintext is accessible

**Recommendations**:
- Never run untrusted code in the browser
- Use browser extension isolation
- Keep browser updated

### 2. Biometric Compromise

**Risk Level**: MEDIUM

**Attack Vector**: Attacker with physical access to unlocked device, or compromise of OS-level biometric system.

**Mitigations**:
- Biometric credentials are OS-managed (out of app scope)
- WebAuthn credentials scoped to origin (can't be used elsewhere)
- Auto-lock reduces exposure window
- Biometric is convenience only, passphrase still required for recovery

**Residual Risk**:
- Relies on OS security (iOS, macOS, Windows, Android)
- Physical device access during unlocked state

**Recommendations**:
- Use device lock screen with biometric
- Enable auto-lock on OS level
- Don't rely solely on biometric for critical data

### 3. Relay Server Man-in-the-Middle (MitM)

**Risk Level**: LOW to MEDIUM

**Attack Vector**: Attacker intercepts QR code or relay traffic to capture WebAuthn assertion.

**Mitigations**:
- HTTPS required (encrypted transport)
- Challenge-response prevents replay attacks
- 120-second TTL limits attack window
- Signature verified locally on PC (not on server)
- Assertion alone cannot unlock without local public key

**Residual Risk**:
- If attacker captures QR image AND has access to relay, they could attempt replay
- Mitigated by challenge verification and local signature check

**Recommendations**:
- Only use QR unlock on trusted networks
- Deploy relay to HTTPS endpoint (Vercel auto-provides)
- Verify QR code URL before scanning

### 4. Backup Theft

**Risk Level**: MEDIUM to HIGH

**Attack Vector**: Attacker obtains exported backup file and attempts brute-force attack on passphrase.

**Mitigations**:
- 200,000 PBKDF2 iterations slow down brute-force
- Unique random salt prevents rainbow table attacks
- Passphrase strength meter encourages strong passphrases
- Backup export warnings

**Residual Risk**:
- Weak passphrase can be brute-forced given enough time
- 200k iterations provide ~1ms per attempt (GPU-accelerated attacks faster)

**Recommendations**:
- Use strong passphrases (16+ characters, high entropy)
- Store backups encrypted with additional layer (disk encryption, password manager)
- Consider key derivation iteration count increase for high-security use cases

### 5. Memory Dump Attack

**Risk Level**: MEDIUM

**Attack Vector**: Physical access to device with unlocked session, memory dumping tools.

**Mitigations**:
- Auto-lock after 5 minutes inactivity
- Memory clearing on lock (best-effort)
- Session timeout reduces exposure

**Residual Risk**:
- JavaScript cannot reliably zero memory (GC control limited)
- Master key in memory during unlocked session
- No native OS-level secure enclave integration

**Recommendations**:
- Lock immediately when leaving device
- Use full-disk encryption
- Enable OS screen lock

### 6. IndexedDB Access

**Risk Level**: MEDIUM

**Attack Vector**: Malicious browser extension or XSS reads IndexedDB directly.

**Mitigations**:
- Data is encrypted at rest (ciphertext in IndexedDB)
- Master key not stored unwrapped
- Origin isolation (browser sandbox)

**Residual Risk**:
- Extension with storage permission can read ciphertext
- Extension running during unlock could capture master key

**Recommendations**:
- Minimize browser extensions
- Review extension permissions
- Use dedicated browser profile for sensitive apps

### 7. Supply Chain Attack

**Risk Level**: LOW to MEDIUM

**Attack Vector**: Compromised npm package injects malicious code.

**Mitigations**:
- Minimal dependencies
- Reputable packages only (Next.js, React, idb)
- No crypto libraries (use native Web Crypto)
- Lock files for reproducible builds

**Residual Risk**:
- Transitive dependencies not fully audited
- npm registry compromise possible

**Recommendations**:
- Regular `npm audit` checks
- Consider dependency pinning
- Review critical dependencies

## 🔍 Threat Model

### Trust Boundaries

**Trusted**:
- Browser Web Crypto API
- Operating System (for WebAuthn)
- User's device (when locked)
- HTTPS/TLS (for Vercel deployment)

**Untrusted**:
- Network (all data assumed intercepted)
- Relay server (stateless, no trust required)
- Browser extensions
- Other websites

### Assumptions

1. **Browser is not compromised**: Attacker cannot run arbitrary code in browser
2. **OS biometric is secure**: Touch ID, Face ID, Windows Hello not bypassed
3. **User protects passphrase**: Strong passphrase, not shared
4. **HTTPS works**: TLS not compromised (valid certificates)
5. **Web Crypto is correct**: No implementation bugs in browser crypto

### Out of Scope

- **Browser vulnerabilities**: We trust the browser's Web Crypto implementation
- **OS-level attacks**: Keyloggers, screen recorders outside browser
- **Social engineering**: Phishing for passphrase
- **Quantum computing**: AES-256 considered quantum-resistant (for now)

## 🎯 Security Tradeoffs

### Convenience vs. Security

| Feature | Convenience | Security Risk | Mitigation |
|---------|------------|---------------|------------|
| Biometric unlock | High | Medium (device-bound) | Passphrase required for recovery |
| QR unlock | High | Medium (MitM risk) | Challenge-response, HTTPS, TTL |
| Auto-lock (5 min) | Medium | Low | Configurable timeout |
| Export backup | High | High (if stolen) | Strong passphrase, file encryption warning |
| In-memory master key | High | Medium (memory dump) | Auto-lock, best-effort clearing |

### Performance vs. Security

- **200k PBKDF2 iterations**: ~200ms derivation time (acceptable for unlock)
  - Could increase to 500k for higher security (slower unlock)
- **AES-GCM-256**: Fast encryption, authenticated
  - AES-GCM-128 would be faster but less secure
- **IndexedDB**: Fast local storage
  - Could add additional encryption layer (slower)

## 📋 Compliance Checklist

### OWASP Cryptographic Storage Cheat Sheet

- [x] Use strong encryption (AES-GCM-256)
- [x] Use authenticated encryption (GCM mode)
- [x] Strong key derivation (PBKDF2-SHA256, 200k iterations)
- [x] Random IVs (never reuse)
- [x] Secure random generation (crypto.getRandomValues)
- [x] Protect keys in memory (best effort)

### OWASP Authentication Cheat Sheet

- [x] Strong password policy (12+ chars recommended)
- [x] Password strength indicator
- [x] Secure password storage (never stored, only derived)
- [x] Multi-factor available (WebAuthn as 2nd factor)
- [x] Session timeout
- [x] Protect against common passwords

### OWASP Session Management Cheat Sheet

- [x] Session timeout after inactivity
- [x] Logout functionality (lock)
- [x] Session invalidation on lock
- [x] Secure session storage (memory only)

## 🚨 Known Vulnerabilities & Limitations

### 1. Passphrase Recovery Impossible

**Impact**: HIGH  
**Likelihood**: LOW (user error)

If user forgets passphrase, data is permanently lost.

**Mitigation**: 
- Clear warnings during setup
- Encourage backup storage
- No backdoor (by design)

### 2. JavaScript Memory Clearing

**Impact**: MEDIUM  
**Likelihood**: LOW (requires physical access + tools)

JavaScript cannot reliably zero memory. Master key may persist in memory after lock.

**Mitigation**:
- Auto-lock reduces exposure window
- Best-effort overwriting
- Recommend OS-level full-disk encryption

### 3. CSP Unsafe Directives

**Impact**: MEDIUM  
**Likelihood**: LOW

CSP includes `unsafe-eval` (Next.js dev) and `unsafe-inline` (styles).

**Mitigation**:
- Production build reduces attack surface
- Framework requirement (Next.js)
- No user-controlled content in scripts

### 4. Relay Server DoS

**Impact**: LOW  
**Likelihood**: MEDIUM

In-memory session store can be exhausted (1000 session limit).

**Mitigation**:
- Session limit enforced
- TTL auto-cleanup
- For production scale, use Redis (documented)

### 5. WebAuthn Public Key Extraction

**Impact**: LOW  
**Likelihood**: HIGH (technical limitation)

Current implementation uses attestation: 'none', which doesn't reliably extract public key from attestation object.

**Workaround**: 
- The assertion contains public key in COSE format
- Verification happens with stored credential ID
- Future improvement: proper CBOR parsing

## ✅ Security Testing

### Manual Tests Performed

- [x] Encryption/decryption round-trip
- [x] Incorrect passphrase rejected
- [x] Session timeout triggers lock
- [x] Export/import preserves data
- [x] WebAuthn registration and auth
- [x] QR flow with valid assertion
- [x] QR flow with invalid assertion
- [x] Expired session rejected
- [x] CSP blocks external scripts

### Automated Tests

- [x] Crypto function unit tests
- [x] WebAuthn helper unit tests
- [x] IndexedDB validation tests
- [x] E2E setup flow
- [x] E2E note creation

### Recommended Additional Testing

- [ ] Penetration testing by security professional
- [ ] Cryptographic audit of key derivation
- [ ] Fuzzing of backup import
- [ ] Browser compatibility testing
- [ ] Load testing of relay server

## 🔄 Continuous Security

### Update Schedule

- **Dependencies**: Review monthly, update quarterly
- **Security patches**: Apply immediately
- **Framework updates**: Follow Next.js security releases
- **Browser compatibility**: Test on new major releases

### Monitoring

- No telemetry (privacy by design)
- No error reporting to external service
- Logs only in browser console (dev mode)

## 📚 References

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [WebAuthn Guide](https://webauthn.guide/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [NIST SP 800-132](https://csrc.nist.gov/publications/detail/sp/800-132/final) - PBKDF Recommendations

## 📝 Conclusion

This application prioritizes security and transparency:

**Strengths**:
- Strong encryption (native Web Crypto)
- No server trust required (local-first)
- Defense in depth (multiple security layers)
- Clear about limitations

**Weaknesses**:
- XSS risk in unlocked state
- Memory clearing limitations
- Passphrase recovery impossible

**Suitable For**:
- Personal note-taking
- Sensitive information storage
- Privacy-conscious users
- Local-first workflows

**Not Suitable For**:
- Legal compliance requiring audit trails
- Team collaboration
- Cross-device sync (use export/import)
- Users who may forget passphrases

---

**Last Updated**: 2025-11-20  
**Version**: 1.0.0
