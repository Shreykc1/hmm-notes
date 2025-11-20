'use client';

/**
 * Setup Page - Initial app setup with passphrase and optional biometric registration
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    generateMasterKey,
    deriveKeyFromPassphrase,
    wrapKey,
    generateRandomBytes,
    base64urlEncode,
} from '@/lib/crypto';
import { registerCredential } from '@/lib/webauthn';
import { saveMasterKeyData, saveWebAuthnCredential } from '@/lib/indexeddb';
import PassphraseStrength from '@/components/PassphraseStrength';

export default function Setup() {
    const router = useRouter();
    const [passphrase, setPassphrase] = useState('');
    const [confirmPassphrase, setConfirmPassphrase] = useState('');
    const [enableBiometric, setEnableBiometric] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (passphrase.length < 12) {
            setError('Passphrase must be at least 12 characters');
            return;
        }

        if (passphrase !== confirmPassphrase) {
            setError('Passphrases do not match');
            return;
        }

        setLoading(true);

        try {
            // 1. Generate master key
            const masterKey = await generateMasterKey();

            // 2. Derive wrapping key from passphrase
            const salt = generateRandomBytes(16);
            const iterations = 200000;
            const wrappingKey = await deriveKeyFromPassphrase(
                passphrase,
                salt,
                iterations
            );

            // 3. Wrap master key
            const { wrappedKey, iv } = await wrapKey(masterKey, wrappingKey);

            // 4. Save to IndexedDB
            await saveMasterKeyData({
                wrappedKey: base64urlEncode(new Uint8Array(wrappedKey)),
                salt: base64urlEncode(salt),
                iv: base64urlEncode(iv),
                iterations,
            });

            // 5. Optional: Register WebAuthn credential
            if (enableBiometric) {
                try {
                    const credential = await registerCredential('user@secure-notes');
                    await saveWebAuthnCredential({
                        id: credential.credentialId,
                        publicKey: credential.publicKey,
                        counter: credential.counter,
                        createdAt: Date.now(),
                    });
                } catch (biometricError) {
                    console.error('Biometric registration failed:', biometricError);
                    // Continue anyway - biometric is optional
                }
            }

            // 6. Redirect to main app
            router.push('/');
        } catch (err) {
            console.error('Setup error:', err);
            setError('Setup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        🔒 Secure Notes
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Set up your encrypted notes
                    </p>
                </div>

                <form onSubmit={handleSetup} className="space-y-4">
                    <div>
                        <label
                            htmlFor="passphrase"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                            Master Passphrase
                        </label>
                        <input
                            type="password"
                            id="passphrase"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Enter a strong passphrase"
                            disabled={loading}
                            autoFocus
                        />
                        <PassphraseStrength passphrase={passphrase} />
                    </div>

                    <div>
                        <label
                            htmlFor="confirmPassphrase"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                            Confirm Passphrase
                        </label>
                        <input
                            type="password"
                            id="confirmPassphrase"
                            value={confirmPassphrase}
                            onChange={(e) => setConfirmPassphrase(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Enter passphrase again"
                            disabled={loading}
                        />
                    </div>

                    <div className="flex items-start">
                        <input
                            type="checkbox"
                            id="enableBiometric"
                            checked={enableBiometric}
                            onChange={(e) => setEnableBiometric(e.target.checked)}
                            className="mt-1 mr-2"
                            disabled={loading}
                        />
                        <label
                            htmlFor="enableBiometric"
                            className="text-sm text-gray-700 dark:text-gray-300"
                        >
                            Enable biometric unlock (Touch ID, Face ID, Windows Hello)
                            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Convenience feature only - always remember your passphrase
                            </span>
                        </label>
                    </div>

                    {error && (
                        <div className="text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !passphrase || !confirmPassphrase}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors"
                    >
                        {loading ? 'Setting up...' : 'Create Account (Local)'}
                    </button>
                </form>

                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                        <strong>⚠️ Important:</strong> Your passphrase cannot be recovered.
                        Make sure to remember it or store it securely. All encryption happens
                        locally - no data is sent to any server.
                    </p>
                </div>
            </div>
        </div>
    );
}
