'use client';

/**
 * SessionTimer - Handles inactivity detection and auto-lock
 */

import { useEffect, useRef } from 'react';

interface SessionTimerProps {
    timeout: number; // milliseconds
    onTimeout: () => void;
    enabled: boolean;
}

export default function SessionTimer({ timeout, onTimeout, enabled }: SessionTimerProps) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const warningRef = useRef<NodeJS.Timeout | null>(null);

    const resetTimer = () => {
        if (!enabled) return;

        // Clear existing timers
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);

        // Set warning at 1 minute before timeout
        if (timeout > 60000) {
            warningRef.current = setTimeout(() => {
                console.log('Session will lock in 1 minute due to inactivity');
            }, timeout - 60000);
        }

        // Set main timeout
        timeoutRef.current = setTimeout(() => {
            console.log('Session locked due to inactivity');
            onTimeout();
        }, timeout);
    };

    useEffect(() => {
        if (!enabled) return;

        // Activity events
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

        events.forEach((event) => {
            window.addEventListener(event, resetTimer);
        });

        // Initial timer
        resetTimer();

        // Cleanup
        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, resetTimer);
            });
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (warningRef.current) clearTimeout(warningRef.current);
        };
    }, [enabled, timeout]);

    return null; // No visual component
}
