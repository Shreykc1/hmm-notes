'use client';

/**
 * NoteEditor - Component for creating and editing notes
 * Handles client-side encryption before storage
 */

import { useState, useEffect } from 'react';
import { encryptText, decryptText } from '@/lib/crypto';
import { saveNote } from '@/lib/indexeddb';
import type { Note } from '@/lib/indexeddb';
import { v4 as uuidv4 } from 'uuid';

interface NoteEditorProps {
    note: Note | null;
    masterKey: CryptoKey | null;
    onSave: () => void;
    onClose: () => void;
}

export default function NoteEditor({ note, masterKey, onSave, onClose }: NoteEditorProps) {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [decrypting, setDecrypting] = useState(false);

    useEffect(() => {
        if (note && masterKey) {
            setDecrypting(true);
            decryptText(note.ciphertext, note.iv, masterKey)
                .then(setContent)
                .catch(() => setContent('Error decrypting note'))
                .finally(() => setDecrypting(false));
        } else {
            setContent('');
        }
    }, [note, masterKey]);

    const handleSave = async () => {
        if (!masterKey) {
            alert('Cannot save: No master key');
            return;
        }

        setLoading(true);

        try {
            // Encrypt content
            const { ciphertext, iv } = await encryptText(content, masterKey);

            const now = Date.now();
            const savedNote: Note = {
                id: note?.id || uuidv4(),
                ciphertext,
                iv,
                createdAt: note?.createdAt || now,
                updatedAt: now,
            };

            await saveNote(savedNote);
            onSave();
            onClose();
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save note');
        } finally {
            setLoading(false);
        }
    };

    if (decrypting) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-gray-600 dark:text-gray-400">Decrypting...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {note ? 'Edit Note' : 'New Note'}
                </h3>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    ✕
                </button>
            </div>

            <div className="flex-1 p-4">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none font-mono"
                    placeholder="Start typing your note... (encrypted before saving)"
                    disabled={loading}
                />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    {content.length} characters
                    {note?.updatedAt && (
                        <span className="ml-2">
                            • Last updated: {new Date(note.updatedAt).toLocaleString()}
                        </span>
                    )}
                </div>
                <div className="space-x-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || !content.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
                    >
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
