'use client';

/**
 * QR Code Display Page (PC side)
 * Shows QR code for phone to scan and authenticate
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { generateRandomBytes, base64urlEncode } from '@/lib/crypto';
import { verifyAssertion, getPrimaryWebAuthnCredential } from '@/lib/webauthn';
import type { SerializedCredential } from '@/lib/webauthn';
import QRCode from '@/components/QRCode';

export default function QRUnlock() {
    const router = useRouter();
    const [sessionId] = useState(() => uuidv4());
    const [challenge] = useState(() => base64urlEncode(generateRandomBytes(32)));
    const [status, setStatus] = useState<'waiting' | 'success' | 'error' | 'timeout'>('waiting');
    const [qrUrl, setQrUrl] = useState('');
    const [countdown, setCountdown] = useState(120);

    useEffect(() => {
        // Create QR URL
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/auth/scan?session=${sessionId}&challenge=${challenge}`;
        setQrUrl(url);

        // Create session on server
        createSession();

        // Start polling
        const pollInterval = setInterval(pollSession, 2000);

        // Countdown timer
        const countdownInterval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    setStatus('timeout');
                    clearInterval(pollInterval);
                    clearInterval(countdownInterval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(pollInterval);
            clearInterval(countdownInterval);
        };
    }, []);

    const createSession = async () => {
        try {
            const response = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, challenge }),
            });

            if (!response.ok) {
                throw new Error('Failed to create session');
            }
        } catch (error) {
            console.error('Session creation error:', error);
            setStatus('error');
        }
    };

    const pollSession = async () => {
        try {
            const response = await fetch(`/api/session/${sessionId}`);

            if (!response.ok) {
                return; // Session not found or expired
            }

            const data = await response.json();

            if (data.assertion) {
                // Verify assertion
                const credential = await getPrimaryWebAuthnCredential();
                if (!credential) {
                    setStatus('error');
                    return;
                }

                const assertion: SerializedCredential = JSON.parse(data.assertion);
                const isValid = await verifyAssertion(
                    assertion,
                    credential.publicKey,
                    base64urlDecode(challenge)
                );

                if (isValid) {
                    setStatus('success');
                    setTimeout(() => {
                        router.push('/');
                    }, 2000);
                } else {
                    setStatus('error');
                }
            }
        } catch (error) {
            console.error('Poll error:', error);
        }
    };

    const base64urlDecode = (str: string): Uint8Array => {
        const padding = '='.repeat((4 - (str.length % 4)) % 4);
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
                    📱 Scan with Your Phone
                </h2>

                {status === 'waiting' && (
                    <>
                        <div className="mb-4">
                            <QRCode value={qrUrl} size={256} />
                        </div>

                        <div className="text-center">
                            <p className="text-gray-600 dark:text-gray-400 mb-2">
                                Open Secure Notes on your phone and scan this QR code
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-500">
                                Waiting for authentication... ({countdown}s)
                            </p>
                        </div>

                        <button
                            onClick={() => router.push('/')}
                            className="mt-6 w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                    </>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <p className="text-xl font-semibold text-green-600 dark:text-green-400 mb-2">
                            Authentication Successful!
                        </p>
                        <p className="text-gray-600 dark:text-gray-400">
                            Redirecting to your notes...
                        </p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center">
                        <div className="text-6xl mb-4">❌</div>
                        <p className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
                            Authentication Failed
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Verification failed or no credential found
                        </p>
                        <button
                            onClick={() => router.push('/')}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        >
                            Back to Home
                        </button>
                    </div>
                )}

                {status === 'timeout' && (
                    <div className="text-center">
                        <div className="text-6xl mb-4">⏱️</div>
                        <p className="text-xl font-semibold text-orange-600 dark:text-orange-400 mb-2">
                            Session Expired
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            The QR code has expired. Please try again.
                        </p>
                        <button
                            onClick={() => router.push('/')}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        >
                            Back to Home
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
