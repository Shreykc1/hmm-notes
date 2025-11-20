'use client';

/**
 * QR Scan Page (Phone side)
 * Scans QR code from PC and authenticates with WebAuthn
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { authenticateCredential, serializeAssertion } from '@/lib/webauthn';
import { base64urlDecode } from '@/lib/crypto';


function ScanContent() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'ready' | 'authenticating' | 'success' | 'error'>('ready');
    const [error, setError] = useState('');
    const sessionId = searchParams.get('session') ?? '';
    const challenge = searchParams.get('challenge') ?? '';

    useEffect(() => {
        if (!sessionId || !challenge) {
            setError('Invalid QR code. Missing session or challenge.');
            setStatus('error');
        }
    }, [sessionId, challenge]);

    const handleAuthenticate = async () => {
        if (!sessionId || !challenge) return;

        setStatus('authenticating');
        setError('');

        try {
            // Decode challenge
            const challengeBytes = base64urlDecode(challenge);

            // Authenticate with WebAuthn
            const assertion = await authenticateCredential(challengeBytes);


            // Send assertion to relay server
            const response = await fetch(`/api/session/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assertion: JSON.stringify(assertion),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to send assertion');
            }

            setStatus('success');
        } catch (err) {
            console.error('Authentication error:', err);
            setError(err instanceof Error ? err.message : 'Authentication failed');
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
                    🔓 Unlock Your PC
                </h2>

                {status === 'ready' && (
                    <div className="text-center">
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Authenticate with your biometric (Face ID, Touch ID, or fingerprint)
                            to unlock your PC
                        </p>
                        <button
                            onClick={handleAuthenticate}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors"
                        >
                            🔐 Authenticate
                        </button>
                    </div>
                )}

                {status === 'authenticating' && (
                    <div className="text-center">
                        <div className="animate-spin text-6xl mb-4">🔄</div>
                        <p className="text-gray-600 dark:text-gray-400">
                            Authenticating with biometric...
                        </p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <p className="text-xl font-semibold text-green-600 dark:text-green-400 mb-2">
                            Authentication Successful!
                        </p>
                        <p className="text-gray-600 dark:text-gray-400">
                            Your PC should now unlock. You can close this window.
                        </p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center">
                        <div className="text-6xl mb-4">❌</div>
                        <p className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
                            Authentication Failed
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                        <button
                            onClick={() => {
                                setStatus('ready');
                                setError('');
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                        <strong>🔒 Secure:</strong> This authentication is verified locally.
                        Your biometric data never leaves your device.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function Scan() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <ScanContent />
        </Suspense>
    );
}
