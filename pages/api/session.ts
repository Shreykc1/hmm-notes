/**
 * Relay server session management
 * SECURITY: Stateless relay for WebAuthn assertions with TTL
 * Never stores plaintext notes or passphrases
 */

import type { NextApiRequest, NextApiResponse } from 'next';

interface Session {
    challenge: string;
    assertion: string | null;
    createdAt: number;
    expiresAt: number;
}

// In-memory session store (for local dev)
// SECURITY: Sessions expire after 120 seconds
// For production, consider using Upstash Redis or similar
const sessions = new Map<string, Session>();

const SESSION_TTL = 120 * 1000; // 120 seconds
const MAX_SESSIONS = 1000; // Prevent memory exhaustion

// Cleanup expired sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now > session.expiresAt) {
            sessions.delete(sessionId);
        }
    }
}, 60 * 1000); // Every minute

/**
 * POST /api/session
 * Create a new session for QR unlock flow
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // CORS headers for cross-origin requests (phone scanning QR from PC)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, challenge } = req.body;

        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ error: 'Invalid sessionId' });
        }

        if (!challenge || typeof challenge !== 'string') {
            return res.status(400).json({ error: 'Invalid challenge' });
        }

        // Check session limit
        if (sessions.size >= MAX_SESSIONS) {
            return res.status(503).json({ error: 'Server busy, try again' });
        }

        // Create session
        const now = Date.now();
        const session: Session = {
            challenge,
            assertion: null,
            createdAt: now,
            expiresAt: now + SESSION_TTL,
        };

        sessions.set(sessionId, session);

        return res.status(200).json({
            success: true,
            expiresIn: SESSION_TTL / 1000, // seconds
        });
    } catch (error) {
        console.error('Session creation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
