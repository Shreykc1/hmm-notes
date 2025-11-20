import {
    generateMasterKey,
    deriveKeyFromPassphrase,
    wrapKey,
    unwrapKey,
    encryptText,
    decryptText,
    base64urlEncode,
    base64urlDecode,
    generateRandomBytes,
    validatePassphraseStrength,
} from '../crypto';

// Mock Web Crypto API
const mockCrypto = global.crypto as any;

describe('Crypto Library', () => {
    describe('base64url encoding/decoding', () => {
        it('should encode and decode correctly', () => {
            const original = new Uint8Array([1, 2, 3, 4, 5]);
            const encoded = base64urlEncode(original);
            const decoded = base64urlDecode(encoded);

            expect(decoded).toEqual(original);
        });

        it('should handle empty arrays', () => {
            const original = new Uint8Array([]);
            const encoded = base64urlEncode(original);
            const decoded = base64urlDecode(encoded);

            expect(decoded).toEqual(original);
        });
    });

    describe('generateRandomBytes', () => {
        it('should generate bytes of correct length', () => {
            const bytes = generateRandomBytes(16);
            expect(bytes).toHaveLength(16);
            expect(bytes).toBeInstanceOf(Uint8Array);
        });

        it('should generate different values each time', () => {
            const bytes1 = generateRandomBytes(16);
            const bytes2 = generateRandomBytes(16);
            expect(bytes1).not.toEqual(bytes2);
        });
    });

    describe('generateMasterKey', () => {
        beforeEach(() => {
            mockCrypto.subtle.generateKey = jest.fn().mockResolvedValue({
                type: 'secret',
                algorithm: { name: 'AES-GCM', length: 256 },
            });
        });

        it('should generate AES-GCM key', async () => {
            const key = await generateMasterKey();

            expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
            expect(key).toBeDefined();
        });
    });

    describe('deriveKeyFromPassphrase', () => {
        const mockDerivedKey = {
            type: 'secret',
            algorithm: { name: 'AES-GCM' },
        };

        beforeEach(() => {
            mockCrypto.subtle.importKey = jest.fn().mockResolvedValue({
                type: 'secret',
                algorithm: { name: 'PBKDF2' },
            });
            mockCrypto.subtle.deriveKey = jest.fn().mockResolvedValue(mockDerivedKey);
        });

        it('should derive key with correct parameters', async () => {
            const salt = generateRandomBytes(16);
            const key = await deriveKeyFromPassphrase('test-passphrase', salt, 200000);

            expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'PBKDF2',
                    salt,
                    iterations: 200000,
                    hash: 'SHA-256',
                }),
                expect.anything(),
                { name: 'AES-GCM', length: 256 },
                true,
                ['wrapKey', 'unwrapKey']
            );
            expect(key).toBe(mockDerivedKey);
        });
    });

    describe('wrapKey and unwrapKey', () => {
        const mockMasterKey = { type: 'secret' } as CryptoKey;
        const mockWrappingKey = { type: 'secret' } as CryptoKey;
        const mockWrappedBytes = new ArrayBuffer(40);

        beforeEach(() => {
            mockCrypto.subtle.wrapKey = jest.fn().mockResolvedValue(mockWrappedBytes);
            mockCrypto.subtle.unwrapKey = jest.fn().mockResolvedValue(mockMasterKey);
        });

        it('should wrap key with random IV', async () => {
            const result = await wrapKey(mockMasterKey, mockWrappingKey);

            expect(result.wrappedKey).toBe(mockWrappedBytes);
            expect(result.iv).toHaveLength(12);
            expect(mockCrypto.subtle.wrapKey).toHaveBeenCalled();
        });

        it('should unwrap key with provided IV', async () => {
            const iv = generateRandomBytes(12);
            const key = await unwrapKey(mockWrappedBytes, mockWrappingKey, iv);

            expect(key).toBe(mockMasterKey);
            expect(mockCrypto.subtle.unwrapKey).toHaveBeenCalledWith(
                'raw',
                mockWrappedBytes,
                mockWrappingKey,
                expect.objectContaining({
                    name: 'AES-GCM',
                    iv,
                }),
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
        });
    });

    describe('encryptText and decryptText', () => {
        const mockKey = { type: 'secret' } as CryptoKey;
        const mockCiphertext = new ArrayBuffer(32);

        beforeEach(() => {
            mockCrypto.subtle.encrypt = jest.fn().mockResolvedValue(mockCiphertext);
            mockCrypto.subtle.decrypt = jest.fn().mockResolvedValue(
                new TextEncoder().encode('test plaintext').buffer
            );
        });

        it('should encrypt text with random IV', async () => {
            const result = await encryptText('test plaintext', mockKey);

            expect(result.ciphertext).toBeDefined();
            expect(result.iv).toBeDefined();
            expect(mockCrypto.subtle.encrypt).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'AES-GCM',
                }),
                mockKey,
                expect.any(Uint8Array)
            );
        });

        it('should decrypt text correctly', async () => {
            const iv = base64urlEncode(generateRandomBytes(12));
            const ciphertext = base64urlEncode(new Uint8Array(mockCiphertext));

            const plaintext = await decryptText(ciphertext, iv, mockKey);

            expect(plaintext).toBe('test plaintext');
            expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
        });
    });

    describe('validatePassphraseStrength', () => {
        it('should rate strong passphrase highly', () => {
            const result = validatePassphraseStrength('MyS3cur3P@ssw0rd!123');
            expect(result.score).toBeGreaterThanOrEqual(3);
        });

        it('should rate weak passphrase poorly', () => {
            const result = validatePassphraseStrength('password');
            expect(result.score).toBeLessThan(2);
            expect(result.feedback.length).toBeGreaterThan(0);
        });

        it('should require minimum length', () => {
            const result = validatePassphraseStrength('short');
            expect(result.feedback).toContain('Use at least 12 characters');
        });

        it('should detect common passwords', () => {
            const result = validatePassphraseStrength('password123');
            expect(result.feedback).toContain('Avoid common passwords');
        });
    });
});
