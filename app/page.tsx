'use client';

/**
 * Main Dashboard - Notes list and editor
 * SECURITY: Auto-locks after inactivity, clears master key from memory on lock
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isSetup, getAllNotes, deleteNote, exportBackup, importBackup, getStats, validateBackup } from '@/lib/indexeddb';
import { decryptText } from '@/lib/crypto';
import type { Note } from '@/lib/indexeddb';
import UnlockModal from '@/components/UnlockModal';
import NoteEditor from '@/components/NoteEditor';
import SessionTimer from '@/components/SessionTimer';

export default function Home() {
  const router = useRouter();
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasWebAuthn, setHasWebAuthn] = useState(false);

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const setup = await isSetup();
      if (!setup) {
        router.push('/setup');
        return;
      }

      const stats = await getStats();
      setHasWebAuthn(stats.hasWebAuthn);
      setLoading(false);
    } catch (error) {
      console.error('Setup check error:', error);
      // If there's an error, assume not set up and redirect
      setLoading(false);
      router.push('/setup');
    }
  };

  const loadNotes = async () => {
    const allNotes = await getAllNotes();
    setNotes(allNotes);
  };

  const handleUnlock = async (key: CryptoKey) => {
    setMasterKey(key);
    await loadNotes();
  };

  const handleLock = () => {
    setMasterKey(null);
    setSelectedNote(null);
    setShowEditor(false);
    // Clear sensitive data from memory (best effort)
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
  };

  const handleNewNote = () => {
    setSelectedNote(null);
    setShowEditor(true);
  };

  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setShowEditor(true);
  };

  const handleDeleteNote = async (id: string) => {
    if (confirm('Delete this note? This cannot be undone.')) {
      await deleteNote(id);
      await loadNotes();
    }
  };

  const handleExport = async () => {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `secure-notes-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          alert('Invalid JSON file');
          return;
        }

        const validation = await validateBackup(data);
        if (!validation.valid) {
          alert(`Import failed: ${validation.reason}`);
          return;
        }

        await importBackup(data, true); // Merge with existing
        await loadNotes();
        alert('Backup imported successfully!');
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import backup. Please check the file format.');
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!masterKey) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              🔒 Secure Notes
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Your notes are locked and encrypted
            </p>
          </div>
        </div>
        <UnlockModal
          onUnlock={handleUnlock}
          onShowQR={() => router.push('/auth/qr')}
          hasWebAuthn={hasWebAuthn}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <SessionTimer
        timeout={5 * 60 * 1000} // 5 minutes
        onTimeout={handleLock}
        enabled={!!masterKey}
      />

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🔒 Secure Notes
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
            >
              📥 Export
            </button>
            <button
              onClick={handleImport}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
            >
              📤 Import
            </button>
            <button
              onClick={handleLock}
              className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              🔒 Lock
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Notes List */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4">
            <button
              onClick={handleNewNote}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors mb-4"
            >
              + New Note
            </button>

            <div className="space-y-2">
              {notes.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No notes yet. Create your first one!
                </p>
              ) : (
                notes.map((note) => (
                  <NotePreview
                    key={note.id}
                    note={note}
                    masterKey={masterKey}
                    onEdit={() => handleEditNote(note)}
                    onDelete={() => handleDeleteNote(note.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {showEditor ? (
            <NoteEditor
              note={selectedNote}
              masterKey={masterKey}
              onSave={async () => {
                await loadNotes();
                setShowEditor(false);
              }}
              onClose={() => setShowEditor(false)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Select a note or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotePreview({
  note,
  masterKey,
  onEdit,
  onDelete,
}: {
  note: Note;
  masterKey: CryptoKey;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [preview, setPreview] = useState('Decrypting...');

  useEffect(() => {
    decryptText(note.ciphertext, note.iv, masterKey)
      .then((text) => {
        const firstLine = text.split('\n')[0].substring(0, 50);
        setPreview(firstLine || 'Empty note');
      })
      .catch(() => setPreview('Error decrypting'));
  }, [note, masterKey]);

  return (
    <div className="group p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md cursor-pointer transition-colors">
      <div onClick={onEdit}>
        <div className="font-medium text-gray-900 dark:text-white truncate">
          {preview}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {new Date(note.updatedAt).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="mt-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        Delete
      </button>
    </div>
  );
}
