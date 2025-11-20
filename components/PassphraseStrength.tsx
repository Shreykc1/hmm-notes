'use client';

/**
 * PassphraseStrength - Visual indicator for passphrase strength
 */

import { validatePassphraseStrength } from '@/lib/crypto';

interface PassphraseStrengthProps {
    passphrase: string;
}

export default function PassphraseStrength({ passphrase }: PassphraseStrengthProps) {
    if (!passphrase) return null;

    const { score, feedback } = validatePassphraseStrength(passphrase);

    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

    return (
        <div className="space-y-2">
            <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className={`h-2 flex-1 rounded ${i <= score ? colors[score] : 'bg-gray-200 dark:bg-gray-700'}`}
                    />
                ))}
            </div>
            <div className="text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                    Strength: {labels[score]}
                </span>
                {feedback.length > 0 && (
                    <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                        {feedback.map((item, i) => (
                            <li key={i}>{item}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
