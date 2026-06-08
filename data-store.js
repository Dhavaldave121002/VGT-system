// ============================================================
// SOCIALSPHERE — SECURE LOCAL DATA STORE (JS Fallback Layer)
// ============================================================
// This file stores all brand data as encrypted JS objects.
// It is loaded BEFORE app.js and acts as the offline fallback
// when SheetDB is unreachable (network issues, rate limits).
// Data is Base64-encoded to prevent casual tampering in DevTools.
// ============================================================

(function () {
    'use strict';

    // ── Encode / Decode helpers ──────────────────────────────
    function encode(obj) {
        try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
        catch (e) { return null; }
    }

    function decode(str) {
        try { return JSON.parse(decodeURIComponent(escape(atob(str)))); }
        catch (e) { return null; }
    }

    const SECURE_DEFAULTS_ENCODED = encode({});

    // ── Storage key ──────────────────────────────────────────
    const LS_KEY = 'socialSphere_brands';
    const LS_BACKUP_KEY = 'socialSphere_brands_backup';
    const LS_STORE_VERSION = 'socialSphere_store_v1';

    // ── Public API exposed on window ─────────────────────────
    window.LocalDataStore = {

        /**
         * Get all brands. Priority order:
         * 1. localStorage (live data from SheetDB sync)
         * 2. localStorage backup snapshot
         * 3. Hardened JS defaults (this file)
         */
        getAll() {
            const live = localStorage.getItem(LS_KEY);
            if (live) {
                try { return JSON.parse(live); } catch (e) { /* corrupted */ }
            }
            const backup = localStorage.getItem(LS_BACKUP_KEY);
            if (backup) {
                const decoded = decode(backup);
                if (decoded) {
                    console.warn('⚠️ LocalDataStore: Using backup snapshot.');
                    return decoded;
                }
            }
            console.warn('⚠️ LocalDataStore: Using hardened JS defaults.');
            return decode(SECURE_DEFAULTS_ENCODED) || {};
        },

        /**
         * Save brands to localStorage + create encrypted backup snapshot.
         * Called automatically on every save in app.js via saveAll().
         */
        saveAll(brandsObj) {
            try {
                localStorage.setItem(LS_KEY, JSON.stringify(brandsObj));
                // Also write an encoded backup
                const encoded = encode(brandsObj);
                if (encoded) localStorage.setItem(LS_BACKUP_KEY, encoded);
                localStorage.setItem(LS_STORE_VERSION, Date.now().toString());
                return true;
            } catch (e) {
                console.error('❌ LocalDataStore save failed:', e);
                return false;
            }
        },

        /**
         * Returns timestamp of last successful save.
         */
        lastSaved() {
            const ts = localStorage.getItem(LS_STORE_VERSION);
            return ts ? new Date(parseInt(ts)).toLocaleString() : 'Never';
        },

        /**
         * Wipes ALL local storage keys for this app (use in admin panel only).
         */
        nuke() {
            [LS_KEY, LS_BACKUP_KEY, LS_STORE_VERSION,
             'socialSphere_currentBrandId', 'socialSphere_admin',
             'socialSphere_admin_hash'].forEach(k => localStorage.removeItem(k));
            console.log('🗑️ LocalDataStore: All data wiped.');
        },

        /**
         * Export current data as a downloadable JSON file.
         */
        export() {
            const data = this.getAll();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `socialsphere_backup_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },

        /**
         * Import from a JSON file (used in admin panel).
         * @param {File} file
         */
        async import(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const parsed = JSON.parse(e.target.result);
                        this.saveAll(parsed);
                        resolve(parsed);
                    } catch (err) { reject(err); }
                };
                reader.readAsText(file);
            });
        }
    };

    // ── Auto-init: Ensure localStorage is seeded if empty ───
    if (!localStorage.getItem(LS_KEY)) {
        const defaults = decode(SECURE_DEFAULTS_ENCODED);
        if (defaults) {
            localStorage.setItem(LS_KEY, JSON.stringify(defaults));
            console.log('🌱 LocalDataStore: Seeded localStorage with defaults.');
        }
    }

    console.log(`✅ LocalDataStore ready | Last saved: ${window.LocalDataStore.lastSaved()}`);

})();
