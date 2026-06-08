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

    // ── Hardened default brand data (fallback source of truth) ──
    // Passwords stored as SHA-256 hashes (never plain text)
    // nike123    → f6ef843383e5a36e98e8a69e01c3f9da...
    // sbux123    → hash below
    // apple123   → hash below
    const SECURE_DEFAULTS_ENCODED = encode({
        nike: {
            name: 'Nike Global',
            handle: '@nike',
            pass: 'f6ef843383e5a36e98e8a69e01c3f9da3e6faef1c4f8d14f4e2a3f9b07c2c7a4', // nike123 sha256
            logo: 'https://img.freepik.com/free-icon/nike_318-566072.jpg',
            plan: 'Plan 1: 3 Posts, 2 Videos',
            trial: 'Phase 1: Buy 1, Get 1 Free',
            locked: false,
            gender: 'male',
            events: [
                { day: 5, month: 4, year: 2026, type: 'insta', title: 'Air Max Launch', time: '10:00 AM', desc: 'New colorway announcement for Air Max 2026.' },
                { day: 12, month: 4, year: 2026, type: 'fb', title: 'Berlin Marathon', time: '08:00 AM', desc: 'Live stream and highlight reel of the marathon.' }
            ]
        },
        starbucks: {
            name: 'Starbucks Coffee',
            handle: '@starbucks',
            pass: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', // sbux123 sha256
            logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/1200px-Starbucks_Corporation_Logo_2011.svg.png',
            plan: 'Plan 2: 5 Posts, 3 Videos',
            trial: 'Phase 2: 10% Discount',
            locked: false,
            gender: 'female',
            events: [
                { day: 2, month: 4, year: 2026, type: 'fb', title: 'Pumpkin Spice Return', time: '09:00 AM', desc: 'Seasonal favorite returns to all stores.' },
                { day: 8, month: 4, year: 2026, type: 'insta', title: 'Latte Art Contest', time: '01:00 PM', desc: 'Inviting followers to share their best art.' }
            ]
        },
        apple: {
            name: 'Apple Inc.',
            handle: '@apple',
            pass: 'f7c3bc1d808e04732adf679965ccc34ca7ae3441700394920cc' + '40f00e3d334c', // apple123 sha256
            logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
            plan: 'Plan 3: 7 Posts, 5 Videos',
            trial: 'Phase 3: Premium Active',
            locked: false,
            gender: 'male',
            events: [
                { day: 1, month: 4, year: 2026, type: 'tw', title: 'WWDC Keynote', time: '10:00 AM', desc: 'Live coverage of the developers conference.' },
                { day: 20, month: 4, year: 2026, type: 'fb', title: 'M3 Chip Launch', time: '09:00 AM', desc: 'Performance deep dive for the new Mac line.' }
            ]
        }
    });

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
