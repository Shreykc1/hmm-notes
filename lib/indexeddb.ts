/**
 * IndexedDB storage layer for encrypted notes and keys
 * SECURITY: Stores only encrypted data; plaintext never persisted
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { z } from 'zod';

// TypeScript interfaces
export interface Note {
    id: string;
    ciphertext: string; // base64url
    iv: string; // base64url
    createdAt: number;
    updatedAt: number;
    title?: string; // Optional encrypted title for preview
}

export interface MasterKeyData {
    wrappedKey: string; // base64url
    salt: string; // base64url
    iv: string; // base64url
    iterations: number;
}

export interface WebAuthnCredentialRecord {
    id: string;
    publicKey: string; // base64url SPKI
    counter: number;
    createdAt: number;
}

export interface BackupData {
    version: number;
    masterKeyData: MasterKeyData | null;
    notes: Note[];
    exportedAt: number;
}

// IndexedDB Schema
interface SecureNotesDB extends DBSchema {
    notes: {
        key: string;
        value: Note;
        indexes: { createdAt: number; updatedAt: number };
    };
    masterKey: {
        key: 'current';
        value: MasterKeyData;
    };
    webauthn: {
        key: string;
        value: WebAuthnCredentialRecord;
    };
}

// Zod schemas for validation
const NoteSchema = z.object({
    id: z.string(),
    ciphertext: z.string(),
    iv: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    title: z.string().optional(),
});

const MasterKeyDataSchema = z.object({
    wrappedKey: z.string(),
    salt: z.string(),
    iv: z.string(),
    iterations: z.number().min(100000),
});

const BackupDataSchema = z.object({
    version: z.number(),
    masterKeyData: MasterKeyDataSchema.nullable(),
    notes: z.array(NoteSchema),
    exportedAt: z.number(),
});

const DB_NAME = 'secure-notes-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<SecureNotesDB> | null = null;

/**
 * Initialize the IndexedDB database
 * Creates object stores if they don't exist
 */
export async function initDB(): Promise<IDBPDatabase<SecureNotesDB>> {
    if (dbInstance) {
        return dbInstance;
    }

    dbInstance = await openDB<SecureNotesDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Notes store
            if (!db.objectStoreNames.contains('notes')) {
                const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
                notesStore.createIndex('createdAt', 'createdAt');
                notesStore.createIndex('updatedAt', 'updatedAt');
            }

            // Master key store
            if (!db.objectStoreNames.contains('masterKey')) {
                db.createObjectStore('masterKey');
            }

            // WebAuthn credentials store
            if (!db.objectStoreNames.contains('webauthn')) {
                db.createObjectStore('webauthn', { keyPath: 'id' });
            }
        },
    });

    return dbInstance;
}

/**
 * Save a note to IndexedDB
 * SECURITY: Note content should already be encrypted
 */
export async function saveNote(note: Note): Promise<void> {
    const db = await initDB();
    await db.put('notes', note);
}

/**
 * Get a single note by ID
 */
export async function getNote(id: string): Promise<Note | undefined> {
    const db = await initDB();
    return await db.get('notes', id);
}

/**
 * Get all notes, sorted by updatedAt (newest first)
 */
export async function getAllNotes(): Promise<Note[]> {
    const db = await initDB();
    const notes = await db.getAllFromIndex('notes', 'updatedAt');
    return notes.reverse(); // Newest first
}

/**
 * Delete a note
 */
export async function deleteNote(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('notes', id);
}

/**
 * Save master key data (wrapped key and metadata)
 * SECURITY: Only the wrapped key is stored, never the plaintext key
 */
export async function saveMasterKeyData(data: MasterKeyData): Promise<void> {
    const validated = MasterKeyDataSchema.parse(data);
    const db = await initDB();
    await db.put('masterKey', validated, 'current');
}

/**
 * Get master key data
 */
export async function getMasterKeyData(): Promise<MasterKeyData | undefined> {
    const db = await initDB();
    return await db.get('masterKey', 'current');
}

/**
 * Check if the app has been set up (master key exists)
 */
export async function isSetup(): Promise<boolean> {
    const masterKeyData = await getMasterKeyData();
    return masterKeyData !== undefined;
}

/**
 * Save WebAuthn credential
 */
export async function saveWebAuthnCredential(
    credential: WebAuthnCredentialRecord
): Promise<void> {
    const db = await initDB();
    await db.put('webauthn', credential);
}

/**
 * Get WebAuthn credential by ID
 */
export async function getWebAuthnCredential(
    id: string
): Promise<WebAuthnCredentialRecord | undefined> {
    const db = await initDB();
    return await db.get('webauthn', id);
}

/**
 * Get the primary WebAuthn credential (first one created)
 */
export async function getPrimaryWebAuthnCredential(): Promise<
    WebAuthnCredentialRecord | undefined
> {
    const db = await initDB();
    const credentials = await db.getAll('webauthn');
    return credentials[0]; // Return first credential
}

/**
 * Delete a WebAuthn credential
 */
export async function deleteWebAuthnCredential(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('webauthn', id);
}

/**
 * Export all data as a backup
 * SECURITY: Data is still encrypted; passphrase needed to decrypt
 * @returns Backup data object ready to be JSON stringified
 */
export async function exportBackup(): Promise<BackupData> {
    const masterKeyData = await getMasterKeyData();
    const notes = await getAllNotes();

    return {
        version: 1,
        masterKeyData: masterKeyData || null,
        notes,
        exportedAt: Date.now(),
    };
}

/**
 * Validate a backup before importing
 * Checks schema and master key compatibility
 */
export async function validateBackup(data: unknown): Promise<{ valid: boolean; reason?: string }> {
    // 1. Validate schema
    const result = BackupDataSchema.safeParse(data);
    if (!result.success) {
        return { valid: false, reason: 'Invalid backup file format' };
    }

    const backup = result.data;

    // 2. Check version
    if (backup.version !== 1) {
        return { valid: false, reason: `Unsupported backup version: ${backup.version}` };
    }

    // 3. Check master key compatibility
    // If we have a current master key, the backup must match it to be readable
    const currentKeyData = await getMasterKeyData();

    if (currentKeyData && backup.masterKeyData) {
        // We can check if the salt/iv/iterations match as a proxy for "same key derivation params"
        // Ideally we'd check a key checksum, but checking the salt is a good first step
        // If salts differ, it's definitely a different key setup
        if (currentKeyData.salt !== backup.masterKeyData.salt) {
            return {
                valid: false,
                reason: 'Keystore mismatch: This backup was created with a different master key/password and cannot be merged.'
            };
        }
    }

    return { valid: true };
}

/**
 * Import data from a backup
 * SECURITY: Validates structure before importing; does not decrypt
 * @param data - Backup data (parsed JSON)
 * @param mergeNotes - If true, merge with existing notes; if false, replace all
 */
export async function importBackup(
    data: unknown,
    mergeNotes: boolean = false
): Promise<void> {
    // Validate backup structure
    const validated = BackupDataSchema.parse(data);

    if (validated.version !== 1) {
        throw new Error(`Unsupported backup version: ${validated.version}`);
    }

    const db = await initDB();

    // Import master key data (if present)
    if (validated.masterKeyData) {
        await saveMasterKeyData(validated.masterKeyData);
    }

    // Import notes
    if (!mergeNotes) {
        // Clear existing notes
        const tx = db.transaction('notes', 'readwrite');
        await tx.store.clear();
        await tx.done;
    }

    // Add imported notes
    for (const note of validated.notes) {
        await saveNote(note);
    }
}

/**
 * Clear all data from IndexedDB (factory reset)
 * SECURITY WARNING: This is irreversible without a backup
 */
export async function clearAllData(): Promise<void> {
    const db = await initDB();

    const tx = db.transaction(['notes', 'masterKey', 'webauthn'], 'readwrite');

    await Promise.all([
        tx.objectStore('notes').clear(),
        tx.objectStore('masterKey').clear(),
        tx.objectStore('webauthn').clear(),
    ]);

    await tx.done;
}

/**
 * Get database statistics
 */
export async function getStats(): Promise<{
    noteCount: number;
    hasSetup: boolean;
    hasWebAuthn: boolean;
}> {
    const db = await initDB();

    const [noteCount, masterKey, webauthnCreds] = await Promise.all([
        db.count('notes'),
        db.get('masterKey', 'current'),
        db.getAll('webauthn'),
    ]);

    return {
        noteCount,
        hasSetup: !!masterKey,
        hasWebAuthn: webauthnCreds.length > 0,
    };
}
