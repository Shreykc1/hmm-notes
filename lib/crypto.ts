/**
 * Cryptography utilities using Web Crypto API
 * All encryption is done client-side. No keys or plaintext are ever sent to a server.
 */

/**
 * Generate a random AES-GCM 256-bit master key
 * SECURITY: Uses crypto.getRandomValues for cryptographically secure randomness
 */
export async function generateMasterKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256,
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );
}

/**
 * Derive a key from a passphrase using PBKDF2-SHA256
 * SECURITY: Uses 200,000 iterations to slow down brute-force attacks
 * @param passphrase - User's passphrase
 * @param salt - Random salt (use generateRandomBytes(16) for new salts)
 * @param iterations - Number of PBKDF2 iterations (default: 200000)
 */
export async function deriveKeyFromPassphrase(
    passphrase: string,
    salt: Uint8Array,
    iterations: number = 200000
): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passphraseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations: iterations,
            hash: 'SHA-256',
        },
        passphraseKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['wrapKey', 'unwrapKey']
    );
}

/**
 * Wrap (encrypt) the master key with a wrapping key
 * SECURITY: Uses AES-KW algorithm for key wrapping
 * @param masterKey - The master key to wrap
 * @param wrappingKey - The key used to wrap (derived from passphrase)
 * @returns Wrapped key bytes and IV
 */
export async function wrapKey(
    masterKey: CryptoKey,
    wrappingKey: CryptoKey
): Promise<{ wrappedKey: ArrayBuffer; iv: Uint8Array }> {
    const iv = generateRandomBytes(12); // 96-bit IV for AES-GCM

    const wrappedKey = await crypto.subtle.wrapKey(
        'raw',
        masterKey,
        wrappingKey,
        {
            name: 'AES-GCM',
            iv: iv as BufferSource,
        }
    );

    return { wrappedKey, iv };
}

/**
 * Unwrap (decrypt) the master key with a wrapping key
 * SECURITY: Requires the correct passphrase-derived key to unwrap
 * @param wrappedKey - The wrapped key bytes
 * @param wrappingKey - The key used to unwrap (derived from passphrase)
 * @param iv - The IV used during wrapping
 */
export async function unwrapKey(
    wrappedKey: ArrayBuffer,
    wrappingKey: CryptoKey,
    iv: Uint8Array
): Promise<CryptoKey> {
    return await crypto.subtle.unwrapKey(
        'raw',
        wrappedKey,
        wrappingKey,
        {
            name: 'AES-GCM',
            iv: iv as BufferSource,
        },
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt text using AES-GCM with the master key
 * SECURITY: Generates a new random IV for each encryption
 * @param plaintext - Text to encrypt
 * @param masterKey - The master encryption key
 * @returns Ciphertext and IV (both as base64url strings)
 */
export async function encryptText(
    plaintext: string,
    masterKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
    const encoder = new TextEncoder();
    const iv = generateRandomBytes(12); // 96-bit IV for AES-GCM

    const ciphertextBuffer = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv as BufferSource,
        },
        masterKey,
        encoder.encode(plaintext)
    );

    return {
        ciphertext: base64urlEncode(new Uint8Array(ciphertextBuffer)),
        iv: base64urlEncode(iv),
    };
}

/**
 * Decrypt text using AES-GCM with the master key
 * SECURITY: Will throw if tampered or wrong key
 * @param ciphertext - Encrypted text (base64url)
 * @param iv - Initialization vector (base64url)
 * @param masterKey - The master decryption key
 * @returns Decrypted plaintext
 */
export async function decryptText(
    ciphertext: string,
    iv: string,
    masterKey: CryptoKey
): Promise<string> {
    const decoder = new TextDecoder();

    const plaintextBuffer = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: base64urlDecode(iv) as BufferSource,
        },
        masterKey,
        base64urlDecode(ciphertext) as BufferSource
    );

    return decoder.decode(plaintextBuffer);
}

/**
 * Generate cryptographically secure random bytes
 * SECURITY: Uses crypto.getRandomValues
 */
export function generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

/**
 * Encode bytes to base64url (URL-safe base64 without padding)
 */
export function base64urlEncode(bytes: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode base64url to bytes
 */
export function base64urlDecode(str: string): Uint8Array {
    // Add padding back
    const padding = '='.repeat((4 - (str.length % 4)) % 4);
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Clear sensitive data from memory
 * Note: This is best-effort; JavaScript doesn't guarantee memory clearing
 */
export function clearSensitiveData(data: any): void {
    if (typeof data === 'string') {
        // Can't actually clear strings in JS, but we can try
        data = '';
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        const view = new Uint8Array(
            data instanceof ArrayBuffer ? data : data.buffer
        );
        crypto.getRandomValues(view); // Overwrite with random data
    }
}

/**
 * Export master key to raw bytes (for storage)
 * WARNING: Only use this for wrapping the key
 */
export async function exportMasterKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.exportKey('raw', key);
}

/**
 * Import master key from raw bytes
 * Used after unwrapping
 */
export async function importMasterKey(
    keyBytes: ArrayBuffer
): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Validate passphrase strength
 * Returns a score from 0-4 and feedback
 */
export function validatePassphraseStrength(passphrase: string): {
    score: number;
    feedback: string[];
} {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (passphrase.length >= 12) score++;
    else feedback.push('Use at least 12 characters');

    if (passphrase.length >= 16) score++;

    // Character diversity
    if (/[a-z]/.test(passphrase) && /[A-Z]/.test(passphrase)) score++;
    else feedback.push('Use both uppercase and lowercase letters');

    if (/\d/.test(passphrase)) score++;
    else feedback.push('Include numbers');

    if (/[^a-zA-Z0-9]/.test(passphrase)) score++;
    else feedback.push('Include special characters');

    // Common passwords (basic check)
    const commonPasswords = [
        'password',
        '123456',
        'qwerty',
        'admin',
        'letmein',
    ];
    if (
        commonPasswords.some((common) =>
            passphrase.toLowerCase().includes(common)
        )
    ) {
        score = Math.max(0, score - 2);
        feedback.push('Avoid common passwords');
    }

    return {
        score: Math.min(4, score),
        feedback,
    };
}
