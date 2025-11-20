/**
 * Relay server session operations
 * SECURITY: Store and retrieve WebAuthn assertions with TTL
 */

import type { NextApiRequest, NextApiResponse } from 'next';

interface Session {
    challenge: string;
    assertion: string | null;
    createdAt: number;
    expiresAt: number;
}

// Shared session store (same as session.ts)
// In production, this would be a shared Redis instance
declare global {
    var sessionStore: Map<string, Session> | undefined;
}

const sessions = global.sessionStore || new Map<string, Session>();
if (!global.sessionStore) {
    global.sessionStore = sessions;
}

/**
 * GET /api/session/[id]
 * Poll for assertion (PC checks if phone has authenticated)
 *
 * POST /api/session/[id]
 * Store assertion (phone posts after WebAuthn authentication)
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid session ID' });
    }

    // GET: Poll for assertion
    if (req.method === 'GET') {
        const session = sessions.get(id);

        if (!session) {
            return res.status(404).json({ error: 'Session not found or expired' });
        }

        const now = Date.now();
        if (now > session.expiresAt) {
            sessions.delete(id);
            return res.status(404).json({ error: 'Session expired' });
        }

        return res.status(200).json({
            assertion: session.assertion,
            expiresAt: session.expiresAt,
            challenge: session.challenge,
        });
    }

    // POST: Store assertion
    if (req.method === 'POST') {
        const session = sessions.get(id);

        if (!session) {
            return res.status(404).json({ error: 'Session not found or expired' });
        }

        const now = Date.now();
        if (now > session.expiresAt) {
            sessions.delete(id);
            return res.status(404).json({ error: 'Session expired' });
        }

        const { assertion } = req.body;

        if (!assertion || typeof assertion !== 'string') {
            return res.status(400).json({ error: 'Invalid assertion' });
        }

        // Store assertion (can only store once)
        if (session.assertion) {
            return res.status(409).json({ error: 'Assertion already stored' });
        }

        session.assertion = assertion;
        sessions.set(id, session);

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
