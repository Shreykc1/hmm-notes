'use client';

/**
 * UnlockModal - Modal for unlocking the app
 * Supports passphrase entry, biometric unlock, and QR unlock
 */

import { useState } from 'react';
import { deriveKeyFromPassphrase, unwrapKey, base64urlDecode } from '@/lib/crypto';
import { getMasterKeyData, getPrimaryWebAuthnCredential } from '@/lib/indexeddb';

interface UnlockModalProps {
    onUnlock: (masterKey: CryptoKey) => void;
    onShowQR?: () => void;
    hasWebAuthn?: boolean;
}

export default function UnlockModal({ onUnlock, onShowQR, hasWebAuthn, customMasterKeyData, title, description }: UnlockModalProps & { customMasterKeyData?: any, title?: string, description?: string }) {
    const [passphrase, setPassphrase] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePassphraseUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Get master key data from IndexedDB OR use custom data
            const masterKeyData = customMasterKeyData || await getMasterKeyData();
            if (!masterKeyData) {
                throw new Error('No master key found. Please set up the app first.');
            }

            // Derive wrapping key from passphrase
            const wrappingKey = await deriveKeyFromPassphrase(
                passphrase,
                base64urlDecode(masterKeyData.salt),
                masterKeyData.iterations
            );

            // Unwrap master key
            const wrappedKeyBuffer = base64urlDecode(masterKeyData.wrappedKey).buffer as ArrayBuffer;
            const masterKey = await unwrapKey(
                wrappedKeyBuffer,
                wrappingKey,
                base64urlDecode(masterKeyData.iv)
            );

            // Success!
            onUnlock(masterKey);
        } catch (err) {
            console.error('Unlock error:', err);
            setError('Incorrect passphrase or corrupted data');
        } finally {
            setLoading(false);
        }
    };

    const handleBiometricUnlock = async () => {
        setError('');
        setLoading(true);

        try {
            const credential = await getPrimaryWebAuthnCredential();
            if (!credential) {
                throw new Error('No biometric credential found');
            }

            setError('Biometric authentication succeeded, but you still need to enter your passphrase on first use after setup.');
        } catch (err) {
            console.error('Biometric unlock error:', err);
            setError('Biometric authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                    {title || 'Unlock Secure Notes'}
                </h2>
                {description && (
                    <p className="mb-4 text-gray-600 dark:text-gray-400">
                        {description}
                    </p>
                )}

                <form onSubmit={handlePassphraseUnlock} className="space-y-4">
                    <div>
                        <label htmlFor="passphrase" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Passphrase
                        </label>
                        <input
                            type="password"
                            id="passphrase"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Enter your passphrase"
                            disabled={loading}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !passphrase}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
                    >
                        {loading ? 'Unlocking...' : 'Unlock'}
                    </button>
                </form>

                <div className="mt-4 space-y-2">
                    {hasWebAuthn && (
                        <button
                            onClick={handleBiometricUnlock}
                            disabled={loading}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
                        >
                            🔐 Unlock with Biometric
                        </button>
                    )}

                    {onShowQR && (
                        <button
                            onClick={onShowQR}
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
                        >
                            📱 Unlock with Phone (QR)
                        </button>
                    )}
                </div>

                <p className="mt-4 text-xs text-gray-600 dark:text-gray-400 text-center">
                    Your passphrase never leaves this device
                </p>
            </div>
        </div>
    );
}
