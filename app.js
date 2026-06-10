// Data Management - Sync with Admin Portal
// Multi-API Failover System (Automatic Fallback if limit reached)

// Ã¢â€â‚¬Ã¢â€â‚¬ Server JSON Storage Config Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Set this to your SAVE_TOKEN value from Vercel environment variables.
// This is the same token set as SAVE_TOKEN in your Vercel project settings.
const SERVER_SAVE_TOKEN = window.__SERVER_SAVE_TOKEN__ || '';
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const SHEETDB_API_URLS = [
    "https://sheetdb.io/api/v1/bv1v9wrq0pziw", // Ã¢Å“â€¦ Secondary API Connected (Working)
    "https://sheetdb.io/api/v1/vvutbhezp19tr" // Primary API (Currently returning 401 on PATCH)
];

// SHA-256 Security Engine
async function hashPassword(str) {
    try {
        if (crypto && crypto.subtle) {
            const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch (e) {
        console.warn("Crypto API not available, falling back to plaintext.");
    }
    return str;
}

// Global brands object that merges local store with fetched data
let brands = {};
if (window.LocalDataStore) {
    brands = LocalDataStore.getAll() || {};
} else {
    brands = JSON.parse(localStorage.getItem('socialSphere_brands')) || {};
}

// SheetDB Sync Engine - Simple JSON Store (SheetDB = Single Source of Truth)
async function syncToSheetDB() {
    syncToServer(); // Also sync to Vercel concurrently

    // Clean brands object â€” only brand keys, no metadata
    const cleanBrands = {};
    for (const [k, v] of Object.entries(brands)) {
        if (!k.startsWith('_') && typeof v === 'object') cleanBrands[k] = v;
    }

    for (const url of SHEETDB_API_URLS) {
        if (!url || url.includes('YOUR_NEW_API_ID')) continue;
        try {
            const jsonStr = JSON.stringify(cleanBrands);
            // Try PATCH first (update existing row)
            const patchRes = await fetch(url + '/id/1', {
                method: 'PATCH',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: { database_json: jsonStr } })
            });
            if (patchRes.ok) {
                console.log(`âœ… Synced to SheetDB: ${url}`);
                return;
            } else if (patchRes.status === 429) {
                console.warn(`âš ï¸ Rate limit on ${url}, trying next...`);
                continue;
            } else {
                // Row doesn't exist â€” create it with POST
                const postRes = await fetch(url, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: [{ id: 1, database_json: jsonStr }] })
                });
                if (postRes.ok) { console.log(`âœ… Created row in SheetDB: ${url}`); return; }
            }
        } catch (error) {
            console.error(`âŒ SheetDB sync error [${url}]:`, error);
        }
    }
}

async function loadFromSheetDB() {
    for (const url of SHEETDB_API_URLS) {
        if (!url || url.includes('YOUR_NEW_API_ID')) continue;
        try {
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (res.ok) {
                const rows = await res.json();
                if (rows && rows.length > 0 && rows[0].database_json) {
                    // SheetDB has data â€” use it as source of truth
                    const cloudBrands = JSON.parse(rows[0].database_json) || {};
                    brands = cloudBrands;
                    localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
                    console.log(`âœ… Loaded from SheetDB: ${url} | Brands: ${Object.keys(brands).join(', ')}`);
                    return true;
                } else {
                    // SheetDB is empty â€” push local data to it
                    console.log(`ðŸ“¡ SheetDB empty, pushing local data to ${url}`);
                    syncToSheetDB();
                    return true;
                }
            } else if (res.status === 429) {
                console.warn(`Ã¢Å¡Â Ã¯Â¸Â Load limit reached for ${url}, trying next...`);
                continue;
            }
        } catch (error) {
            console.warn(`Ã¢ÂÅ’ Load error with ${url}:`, error);
        }
    }
    return false;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Sync brands to server JSON storage Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function syncToServer() {
    if (!SERVER_SAVE_TOKEN) return; // skip if token not configured
    try {
        const res = await fetch('/api/saveData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-save-token': SERVER_SAVE_TOKEN
            },
            body: JSON.stringify({ brands })
        });
        if (res.ok) console.log('Ã¢Å“â€¦ Synced to server JSON storage');
        else console.warn('Ã¢Å¡Â Ã¯Â¸Â Server sync failed:', res.status);
    } catch (e) {
        console.warn('Ã¢Å¡Â Ã¯Â¸Â syncToServer error', e);
    }
}

// Load data from server JSON storage
async function loadFromServer() {
    if (!SERVER_SAVE_TOKEN) return false; // skip if token not configured
    try {
        const res = await fetch('/api/loadData', {
            headers: { 'Accept': 'application/json', 'x-save-token': SERVER_SAVE_TOKEN }
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data && data.brands) {
            brands = data.brands;
            if (window.LocalDataStore) LocalDataStore.saveAll(brands);
            else localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
            console.log('Ã¢Å“â€¦ Loaded from server');
            return true;
        }
    } catch (e) {
        console.warn('Ã¢Å¡Â Ã¯Â¸Â loadFromServer error', e);
    }
    return false;
}

// PERFECTION AUDIT: Ensure all brands (new and legacy) have necessary properties
Object.keys(brands).forEach(key => {
    if (key.startsWith('_')) return; // skip metadata
    if (!brands[key].name) brands[key].name = key;
    if (!brands[key].plan) brands[key].plan = 'Plan 1: 3 Posts, 2 Videos';
    if (!brands[key].trial) brands[key].trial = 'Phase 1: Buy 1, Get 1 Free';
    if (brands[key].locked === undefined) brands[key].locked = false;
    if (!brands[key].events) brands[key].events = [];
    if (!brands[key].handle) brands[key].handle = `@${key}`;
});

let currentBrand = null;
let currentBrandId = null;
let currentDate = new Date();
let selectedDay = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const calendarGrid = document.getElementById('calendarGrid');
const monthDisplay = document.getElementById('monthDisplay');
const dailyCollection = document.getElementById('dailyCollection');
const selectedDateTitle = document.getElementById('selectedDateTitle');

// Initialize Ã¢â‚¬â€ Load from Cloud DB first, then init UI
window.addEventListener('DOMContentLoaded', async () => {
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â RESET UI STATE: Prevent 'Authenticated' artifacts
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.innerHTML = `<i data-lucide="unlock" style="width: 18px; height: 18px;"></i> Unlock Dashboard`;
        loginBtn.style.background = '';
    }
    if (loginForm) loginForm.reset();
    if (window.lucide) lucide.createIcons();

    // Load data with priority: localStorage Ã¢â€ â€™ server Ã¢â€ â€™ SheetDB
    if (!Object.keys(brands).length) {
        // Try server first (if API available)
        try {
            const serverLoaded = await loadFromServer();
            if (!serverLoaded) {
                await loadFromSheetDB(); // fallback to SheetDB if server empty or fails
            }
        } catch (e) {
            console.warn('Ã¢Å¡Â Ã¯Â¸Â Server load failed, falling back to SheetDB', e);
            await loadFromSheetDB();
        }
    }

    let migratedLocal = false;
    // Re-run property audit after cloud load and migrate passwords to SHA-256
    for (let key of Object.keys(brands)) {
        if (key.startsWith('_')) continue; // Skip metadata
        if (!brands[key].name) brands[key].name = key;
        if (!brands[key].plan) brands[key].plan = 'Plan 1: 3 Posts, 2 Videos';
        if (!brands[key].trial) brands[key].trial = 'Phase 1: Buy 1, Get 1 Free';
        if (brands[key].locked === undefined) brands[key].locked = false;
        if (!brands[key].events) brands[key].events = [];
        if (!brands[key].handle) brands[key].handle = `@${key}`;

        // Hash migration
        if (brands[key].pass && brands[key].pass.length !== 64) {
            brands[key].pass = await hashPassword(brands[key].pass);
            migratedLocal = true;
        }
    }

    if (migratedLocal) {
        if (window.LocalDataStore) LocalDataStore.saveAll(brands);
        else localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
        syncToSheetDB();
    }

    // Ã¢Å“â€¦ PERSISTENT LOGIN CHECK
    const savedAdmin = localStorage.getItem('socialSphere_admin');
    if (savedAdmin === 'true') {
        window.location.href = 'admin.html';
        return;
    }

    const savedBrandId = localStorage.getItem('socialSphere_currentBrandId');
    if (savedBrandId && brands[savedBrandId]) {
        login(savedBrandId, true); // Ã¢Å“â€¦ Pass true for auto-login (skip animations)
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const brandId = document.getElementById('brandId').value.trim().toLowerCase();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.getElementById('loginBtn');

    // Visual Feedback
    const originalBtnContent = loginBtn.innerHTML;
    loginBtn.innerHTML = `<i class="animate-spin" data-lucide="loader-2"></i> Verifying...`;
    if (window.lucide) lucide.createIcons();

    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â REAL-TIME SECURITY SYNC: Pull latest credentials from Cloud before authenticating
    await loadFromSheetDB();

    const inputHash = await hashPassword(password);

    // ADMIN SECURE GATEWAY (Integrated Access Control)
    const customAdminHash = localStorage.getItem('socialSphere_admin_hash') || brands.__system_admin_hash__;
    const adminHash1 = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // admin123
    const adminHash2 = '331c26f0f5b12dafc039bbf1b71d9d9ab6601b1df4cd19565f1ef1d07c0a9697'; // admin@123

    const isAdminLogin = brandId === 'admin' && (
        (customAdminHash && inputHash === customAdminHash) || 
        (!customAdminHash && (inputHash === adminHash1 || inputHash === adminHash2 || password === 'admin123' || password === 'admin@123'))
    );

    if (isAdminLogin) {
        loginBtn.innerHTML = `<i data-lucide="shield-check"></i> Access Granted`;
        loginBtn.style.background = '#10B981';
        if (window.lucide) lucide.createIcons();
        
        // Ã¢Å“â€¦ Save Admin Session
        localStorage.setItem('socialSphere_admin', 'true');
        localStorage.removeItem('socialSphere_currentBrandId');

        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 800);
        return;
    }

    // Check if brand exists
    if (brands[brandId]) {
        const brand = brands[brandId];

        // Check if account is locked
        if (brand.locked) {
            errorMsg.innerHTML = `<i data-lucide="lock" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 6px;"></i> Account Locked. Contact Admin.`;
            errorMsg.style.display = 'block';
            loginBtn.innerHTML = originalBtnContent;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Check if password matches
        if (brand.pass === inputHash || brand.pass === password) {
            errorMsg.style.display = 'none';
            loginBtn.innerHTML = `<i data-lucide="check-circle"></i> Authenticated`;
            loginBtn.style.background = '#10B981';
            if (window.lucide) lucide.createIcons();

            setTimeout(() => {
                login(brandId);
            }, 800);
        } else {
            errorMsg.textContent = 'Invalid security key.';
            errorMsg.style.display = 'block';
            loginBtn.innerHTML = originalBtnContent;
        }
    } else {
        errorMsg.textContent = 'Identity verification failed. Check Brand ID.';
        errorMsg.style.display = 'block';
        loginBtn.innerHTML = originalBtnContent;
    }
});

function login(brandId, isAutoLogin = false) {
    currentBrand = brands[brandId];
    currentBrandId = brandId;

    // Ã¢Å“â€¦ Save User Session
    localStorage.setItem('socialSphere_currentBrandId', brandId);
    localStorage.removeItem('socialSphere_admin'); // Clear any admin session

    // LEGACY DATA FIX (Client-Side Audit)
    if (currentBrand.events) {
        let eventsChanged = false;
        currentBrand.events.forEach(ev => {
            if (ev.month === undefined) { ev.month = 4; eventsChanged = true; } // Anchor to May 2026
            if (ev.year === undefined) { ev.year = 2026; eventsChanged = true; }
        });
        if (eventsChanged) {
            localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
        syncToSheetDB();
        }
    }

    // Get gender from brand data to set professional cartoon avatar
    const gender = currentBrand.gender || 'male';
    const avatarUrl = gender === 'female' ? './female_owner.png' : './male_owner.png';

    document.getElementById('currentBrandName').textContent = currentBrand.name;
    document.getElementById('currentBrandHandle').textContent = currentBrand.handle || `@${brandId}`;
    document.getElementById('currentBrandLogo').src = avatarUrl;

    // Update Plan Badge
    const planBadge = document.getElementById('brandPlanBadge');
    if (planBadge) {
        planBadge.textContent = `${currentBrand.plan || 'Standard'} Ã¢â‚¬Â¢ ${currentBrand.trial || 'Active'}`;
    }

    // Render 48h Alerts
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = '';
    const now = Date.now();
    const expiry = 48 * 60 * 60 * 1000; // 48 Hours in ms

    if (currentBrand.messages) {
        // Filter and keep only non-expired messages
        currentBrand.messages = currentBrand.messages.filter(msg => (now - msg.time) < expiry);

        // Deduplicate messages by text to fix repeated identical alerts
        const uniqueMessages = [];
        const seenTexts = new Set();
        currentBrand.messages.forEach(msg => {
            if (!seenTexts.has(msg.text)) {
                seenTexts.add(msg.text);
                uniqueMessages.push(msg);
            }
        });

        // Use deduplicated messages for rendering, but update the source array
        currentBrand.messages = uniqueMessages;

        currentBrand.messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'animate-slide';
            div.style.cssText = `background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1)); border: 1px solid rgba(99, 102, 241, 0.2); padding: 16px 24px; border-radius: 20px; display: flex; align-items: center; gap: 16px; color: white; backdrop-filter: blur(10px);`;
            div.innerHTML = `
                <div style="background: var(--primary); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i data-lucide="megaphone" style="width: 16px; height: 16px;"></i>
                </div>
                <div style="flex-grow: 1;">
                    <p style="font-size: 0.9rem; font-weight: 500; margin: 0;">${msg.text}</p>
                    <p style="font-size: 0.7rem; color: var(--text-gray); margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Admin Broadcast Ã¢â‚¬Â¢ Expires in ${Math.round((expiry - (now - msg.time)) / 3600000)} hours</p>
                </div>
                <button onclick="dismissMessage('${msg.time}', event)" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: 0.3s;" title="Dismiss Message">
                    <i data-lucide="x" style="width: 16px; height: 16px;"></i>
                </button>
            `;
            alertContainer.appendChild(div);
        });
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
        syncToSheetDB();
    }

    if (isAutoLogin) {
        // Immediate Transition for Auto-Login
        loginScreen.style.display = 'none';
        dashboard.style.display = 'flex';
        const chatWidget = document.getElementById('chatWidgetContainer');
        if (chatWidget) {
            chatWidget.style.display = currentBrand.supportChat === 'no' ? 'none' : 'flex';
        }
        renderCalendar();
        renderClientVideoTasks();
        if (window.lucide) lucide.createIcons();
    } else {
        // Animated Transition for Manual Login
        loginScreen.style.opacity = '0';
        setTimeout(() => {
            loginScreen.style.display = 'none';
            dashboard.style.display = 'flex';
            const chatWidget = document.getElementById('chatWidgetContainer');
            if (chatWidget) {
                chatWidget.style.display = currentBrand.supportChat === 'no' ? 'none' : 'flex';
            }
            showSkeletons();
            setTimeout(() => {
                renderCalendar();
                renderClientVideoTasks();
                if (window.lucide) lucide.createIcons();
            }, 800);
        }, 400);
    }
}

window.dismissMessage = function (time, event) {
    if (currentBrand && currentBrand.messages) {
        currentBrand.messages = currentBrand.messages.filter(m => m.time.toString() !== time.toString());
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
        syncToSheetDB();

        // Visual removal
        const alertDiv = event.currentTarget.closest('.animate-slide');
        if (alertDiv) {
            alertDiv.style.transition = '0.3s all ease';
            alertDiv.style.opacity = '0';
            alertDiv.style.transform = 'translateY(-10px)';
            setTimeout(() => alertDiv.remove(), 300);
        }
    }
};

function showSkeletons() {
    calendarGrid.innerHTML = '';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
        const h = document.createElement('div');
        h.className = 'day-header';
        h.textContent = day;
        calendarGrid.appendChild(h);
    });

    for (let i = 0; i < 35; i++) {
        const skeletonDay = document.createElement('div');
        skeletonDay.className = 'calendar-day';
        skeletonDay.innerHTML = `
            <div class="skeleton" style="height: 15px; width: 20px; margin-bottom: 10px;"></div>
            <div class="skeleton" style="height: 20px; width: 80%; margin-bottom: 5px; opacity: 0.5;"></div>
            <div class="skeleton" style="height: 20px; width: 60%; opacity: 0.3;"></div>
        `;
        calendarGrid.appendChild(skeletonDay);
    }

    dailyCollection.innerHTML = `
        <div class="collection-item"><div class="skeleton skeleton-tag"></div><div class="skeleton skeleton-title" style="margin-top: 10px;"></div><div class="skeleton skeleton-text"></div></div>
        <div class="collection-item"><div class="skeleton skeleton-tag"></div><div class="skeleton skeleton-title" style="margin-top: 10px;"></div><div class="skeleton skeleton-text"></div></div>
    `;
}

function logout() {
    currentBrand = null;
    currentBrandId = null;
    
    // Ã¢Å“â€¦ Clear Session
    localStorage.removeItem('socialSphere_currentBrandId');
    localStorage.removeItem('socialSphere_admin');

    dashboard.style.display = 'none';
    document.getElementById('chatWidgetContainer').style.display = 'none';
    loginScreen.style.display = 'flex';
    loginScreen.style.opacity = '1';
    loginForm.reset();
}

async function changeOwnPassword() {
    if (!currentBrand || !currentBrandId) return;
    const newPass = prompt(`Update Security Key for ${currentBrand.name}:`);
    if (newPass && newPass.trim().length > 0) {
        if (brands[currentBrandId]) {
            brands[currentBrandId].pass = await hashPassword(newPass.trim());
            localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
        syncToSheetDB();
            alert('Security Key updated successfully! Please use this new key for your next login.');
        }
    }
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthDisplay.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate);
    calendarGrid.innerHTML = '';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
        const h = document.createElement('div');
        h.className = 'day-header';
        h.textContent = day;
        calendarGrid.appendChild(h);
    });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();
        // Previous month days
    for (let i = firstDay; i > 0; i--) createDay(prevLastDay - i + 1, 'inactive', false, -1);
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        createDay(i, isToday ? 'today' : '', true, 0);
    }
    // Next month filler days
    const remaining = 42 - (firstDay + daysInMonth);
    for (let i = 1; i <= remaining; i++) createDay(i, 'inactive', false, 1);
    if (window.lucide) lucide.createIcons();
}

function createDay(num, className, isCurrentMonth = false, monthOffset = 0) {
    const dayDiv = document.createElement('div');
    dayDiv.className = `calendar-day ${className}`;
    // Store actual month and year for this cell
    const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthOffset, 1);
    const year = cellDate.getFullYear();
    const month = cellDate.getMonth();
    dayDiv.dataset.month = month;
    dayDiv.dataset.year = year;
    if (isCurrentMonth) {
        // Click for selection or shift-add
        dayDiv.addEventListener('click', (e) => {
            if (e.shiftKey) {
                // Open modal with correct date context
                openAddEventModal(num, month, year);
                return;
            }
            selectDay(num, dayDiv, e);
        });
    } else {
        // For inactive days, allow shift+click to add event and normal click to select day
        dayDiv.addEventListener('click', (e) => {
            if (e.shiftKey) {
                openAddEventModal(num, month, year);
                return;
            }
            selectDay(num, dayDiv, e);
        });
    }

    dayDiv.innerHTML = `<span class="day-num">${num}</span>`;

    if (isCurrentMonth && currentBrand && currentBrand.events) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Match day, month, and year (handle legacy data that only had day)
        const dayEvents = currentBrand.events.filter(e =>
            e.day === num &&
            (e.month === undefined || e.month === month) &&
            (e.year === undefined || e.year === year)
        );

        dayEvents.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = `event-tag ${event.type}`;
            // UI Enhancement: Show "1 Post" or "1 Reel" based on manual selection OR type inference
            let displayLabel = event.title;
            const format = event.format || 'auto';

            if (format === 'post') {
                displayLabel = "1 Post";
            } else if (format === 'reel') {
                displayLabel = "1 Reel";
            } else if (format === 'ad') {
                displayLabel = "1 Paid Ad";
            } else if (event.type === 'shoot') {
                displayLabel = "1 Shoot Assignment";
            } else {
                // Auto-detection fallback for older events or "Auto-Detect" selection
                if (['insta', 'fb', 'tw', 'threads', 'link'].includes(event.type)) {
                    displayLabel = "1 Post";
                } else if (['video', 'yt'].includes(event.type)) {
                    displayLabel = "1 Reel";
                } else if (event.type === 'ad') {
                    displayLabel = "1 Paid Ad";
                }
            }

            eventDiv.innerHTML = `<i data-lucide="${getIconName(event.type)}" style="width: 12px; height: 12px;"></i> ${displayLabel}`;
            dayDiv.appendChild(eventDiv);
        });
    }
    calendarGrid.appendChild(dayDiv);
}

function getIconName(type) {
    switch (type) {
        case 'insta': return 'camera';
        case 'fb': return 'globe';
        case 'tw': return 'send';
        case 'threads': return 'at-sign';
        case 'yt': return 'play';
        case 'link': return 'users';
        case 'video': return 'video';
        case 'shoot': return 'camera-off';
        case 'festival': return 'gift';
        case 'ad': return 'megaphone';
        default: return 'calendar';
    }
}

function prevMonth() {
    showSkeletons();
    setTimeout(() => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); }, 400);
}

function nextMonth() {
    showSkeletons();
    setTimeout(() => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); }, 400);
}

function openNotificationLog() {
    if (!currentBrand) return;
    const modal = document.getElementById('notificationModal');
    const container = document.getElementById('notificationLogContainer');

    container.innerHTML = '';

    // Get ALL messages, clone to sort without modifying original
    let allMsgs = [...(currentBrand.messages || [])];

    if (allMsgs.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-gray); padding: 40px 0;"><i data-lucide="bell-off" style="width: 48px; height: 48px; opacity: 0.2; margin-bottom: 16px;"></i><p>No notifications found in your history log.</p></div>`;
    } else {
        // Sort newest first
        allMsgs.sort((a, b) => b.time - a.time);

        allMsgs.forEach(msg => {
            const dateStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(msg.time));
            const div = document.createElement('div');
            div.style.cssText = `background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-glass); padding: 16px; border-radius: 16px; display: flex; align-items: flex-start; gap: 16px;`;
            div.innerHTML = `
                <div style="background: rgba(99, 102, 241, 0.1); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 4px;">
                    <i data-lucide="info" style="width: 16px; height: 16px; color: var(--primary-light);"></i>
                </div>
                <div style="flex-grow: 1;">
                    <p style="font-size: 0.95rem; line-height: 1.5; margin: 0; color: #fff;">${msg.text}</p>
                    <p style="font-size: 0.75rem; color: var(--text-gray); margin-top: 8px;">${dateStr}</p>
                </div>
            `;
            container.appendChild(div);
        });
    }

    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function closeNotificationLog() {
    document.getElementById('notificationModal').style.display = 'none';
}

// ==========================================
// PROFESSIONAL AI SUPPORT CHAT ENGINE
// ==========================================

function toggleChatWindow() {
    const chatWin = document.getElementById('chatWindow');
    if (chatWin.style.display === 'none' || chatWin.style.display === '') {
        chatWin.style.display = 'flex';
        renderChatMessages();
        if (window.lucide) lucide.createIcons();
    } else {
        chatWin.style.display = 'none';
    }
}

function renderChatMessages() {
    if (!currentBrand) return;
    const area = document.getElementById('chatMessagesArea');
    area.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px; opacity: 0.6;">
            <span style="font-size: 0.65rem; background: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 12px; color: var(--text-gray); border: 1px solid var(--border-glass);">
                <i data-lucide="shield" style="width: 10px; height: 10px; vertical-align: middle; margin-right: 4px;"></i>
                Privacy Sync: Messages auto-clear every 24 hours
            </span>
        </div>
    `;

    const now = Date.now();
    const expiry = 24 * 60 * 60 * 1000; // 24 Hours in ms

    if (!currentBrand.chat || currentBrand.chat.length === 0) {
        currentBrand.chat = [
            { sender: 'bot', text: "Welcome to Elite Support. I'm your AI Assistant. How can I help you today?", time: now }
        ];
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
        syncToSheetDB();
    } else {
        // Auto-cleanup: Keep messages only from last 24 hours
        const originalLength = currentBrand.chat.length;
        currentBrand.chat = currentBrand.chat.filter(msg => (now - msg.time) < expiry);
        
        // Always ensure at least the welcome message if empty
        if (currentBrand.chat.length === 0) {
            currentBrand.chat.push({ sender: 'bot', text: "Welcome to Elite Support. I'm your AI Assistant. How can I help you today?", time: now });
        }

        if (currentBrand.chat.length !== originalLength) {
            localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
            syncToSheetDB();
        }
    }

    currentBrand.chat.forEach(msg => {
        const div = document.createElement('div');
        const isUser = msg.sender === 'user';

        div.style.cssText = `display: flex; flex-direction: column; max-width: 85%; ${isUser ? 'align-self: flex-end; align-items: flex-end;' : 'align-self: flex-start; align-items: flex-start;'}`;

        let bubbleCss = isUser
            ? `background: linear-gradient(135deg, var(--primary), #A855F7); color: white; border-bottom-right-radius: 4px;`
            : `background: rgba(255,255,255,0.05); border: 1px solid var(--border-glass); color: #fff; border-bottom-left-radius: 4px;`;

        div.innerHTML = `
            <span style="font-size: 0.65rem; color: var(--text-gray); margin-bottom: 4px; padding: 0 4px;">
                ${isUser ? 'You' : (msg.sender === 'admin' ? 'Admin Support' : 'Elite AI Strategist')}
            </span>

            <div style="padding: 12px 16px; border-radius: 16px; font-size: 0.9rem; line-height: 1.4; ${bubbleCss}">
                ${msg.text}
            </div>
        `;
        area.appendChild(div);
    });

    // Scroll to bottom
    setTimeout(() => {
        area.scrollTop = area.scrollHeight;
    }, 100);
}

function getBotResponse(input) {
    const text = input.trim();
    const lowerText = text.toLowerCase();
    const brandName = currentBrand.name || "your brand";

    // Ã°Å¸â€Â SCRIPT DETECTION
    const hasGujaratiScript = /[\u0A80-\u0AFF]/.test(text);
    const hasHindiScript = /[\u0900-\u097F]/.test(text);
    const lang = hasGujaratiScript ? 'guj' : (hasHindiScript ? 'hin' : 'eng');

    // Ã°Å¸Ââ€  BLUE TICK & VERIFICATION
    if (/(blue tick|verify|verification|badge|tick|Ã ÂªÂ¬Ã Â«ÂÃ ÂªÂ²Ã Â«Â Ã ÂªÅ¸Ã Â«â‚¬Ã Âªâ€¢|Ã ÂªÅ¸Ã ÂªÂ¿Ã Âªâ€¢|Ã Â¤Â¸Ã Â¤Â¤Ã Â¥ÂÃ Â¤Â¯Ã Â¤Â¾Ã Â¤ÂªÃ Â¤Â¨|Ã Â¤Â¬Ã Â¥ÂÃ Â¤Â²Ã Â¥â€š Ã Â¤Å¸Ã Â¤Â¿Ã Â¤â€¢)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸â€™Å½ <strong>Blue Tick Verification:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ¨Ã Â«â€¡ Instagram Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Facebook Ã ÂªÂªÃ ÂªÂ° Ã ÂªÂµÃ Â«â€¡Ã ÂªÂ°Ã ÂªÂ¿Ã ÂªÂ«Ã ÂªÂ¾Ã ÂªË†Ã ÂªÂ¡ Ã Âªâ€¢Ã ÂªÂ°Ã ÂªÂ¾Ã ÂªÂµÃ ÂªÂµÃ ÂªÂ¾ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂÃ Âªâ€¢Ã Â«ÂÃ ÂªÂ¸Ã ÂªÂªÃ ÂªÂ°Ã Â«ÂÃ ÂªÅ¸ Ã ÂªÂ¸Ã ÂªÂ°Ã Â«ÂÃ ÂªÂµÃ ÂªÂ¿Ã ÂªÂ¸ Ã Âªâ€ Ã ÂªÂªÃ Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã°Å¸â€™Å½ <strong>Blue Tick Verification:</strong> Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¹ Instagram Ã Â¤â€Ã Â¤Â° Facebook Ã Â¤ÂªÃ Â¤Â° Ã Â¤ÂµÃ Â¥â€¡Ã Â¤Â°Ã Â¤Â¿Ã Â¤Â«Ã Â¤Â¾Ã Â¤â€¡Ã Â¤Â¡ Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¾Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤ÂÃ Â¤â€¢Ã Â¥ÂÃ Â¤Â¸Ã Â¤ÂªÃ Â¤Â°Ã Â¥ÂÃ Â¤Å¸ Ã Â¤Â¸Ã Â¤Â°Ã Â¥ÂÃ Â¤ÂµÃ Â¤Â¿Ã Â¤Â¸ Ã Â¤Â¦Ã Â¥â€¡Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸â€™Å½ <strong>Elite Verification:</strong> We specialize in authenticating <strong>${brandName}</strong> across Meta platforms to establish absolute market authority.`
        };
        return res[lang];
    }

    // Ã°Å¸Å½Â¨ BRANDING & IDENTITY
    if (/(logo|design|branding|color|theme|Ã ÂªÂ¦Ã Â«â€¡Ã Âªâ€“Ã ÂªÂ¾Ã ÂªÂµ|Ã Â¤Â¡Ã Â¤Â¿Ã Â¤Å“Ã Â¤Â¾Ã Â¤â€¡Ã Â¤Â¨|Ã Â¤Â¬Ã Â¥ÂÃ Â¤Â°Ã Â¤Â¾Ã Â¤â€šÃ Â¤Â¡Ã Â¤Â¿Ã Â¤â€šÃ Â¤â€”)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸Å½Â¨ <strong>Visual Identity:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂªÃ Â«ÂÃ ÂªÂ°Ã Â«â‚¬Ã ÂªÂ®Ã ÂªÂ¿Ã ÂªÂ¯Ã ÂªÂ® Ã Âªâ€¢Ã ÂªÂ²Ã ÂªÂ° Ã ÂªÂªÃ Â«â€¡Ã ÂªÂ²Ã Â«â€¡Ã ÂªÅ¸ Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Ã ÂªÂ²Ã Â«â€¹Ã Âªâ€”Ã Â«â€¹ Ã ÂªÂ¡Ã ÂªÂ¿Ã ÂªÂÃ ÂªÂ¾Ã ÂªË†Ã ÂªÂ¨ Ã ÂªÂ¤Ã Â«Ë†Ã ÂªÂ¯Ã ÂªÂ¾Ã ÂªÂ° Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ Ã ÂªÅ“Ã Â«â€¡ Ã Âªâ€”Ã Â«ÂÃ ÂªÂ²Ã Â«â€¹Ã ÂªÂ¬Ã ÂªÂ² Ã ÂªÂ¸Ã Â«ÂÃ ÂªÅ¸Ã ÂªÂ¾Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂ¡Ã ÂªÂ°Ã Â«ÂÃ ÂªÂ¡ Ã ÂªÂ®Ã Â«ÂÃ ÂªÅ“Ã ÂªÂ¬ Ã ÂªÂ¹Ã Â«â€¹Ã ÂªÂ¯.`,
            hin: `Ã°Å¸Å½Â¨ <strong>Visual Identity:</strong> Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¥â‚¬Ã Â¤Â®Ã Â¤Â¿Ã Â¤Â¯Ã Â¤Â® Ã Â¤â€¢Ã Â¤Â²Ã Â¤Â° Ã Â¤ÂªÃ Â¥Ë†Ã Â¤Â²Ã Â¥â€¡Ã Â¤Å¸ Ã Â¤â€Ã Â¤Â° Ã Â¤Â²Ã Â¥â€¹Ã Â¤â€”Ã Â¥â€¹ Ã Â¤Â¡Ã Â¤Â¿Ã Â¤Å“Ã Â¤Â¾Ã Â¤â€¡Ã Â¤Â¨ Ã Â¤Â¤Ã Â¥Ë†Ã Â¤Â¯Ã Â¤Â¾Ã Â¤Â° Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€š Ã Â¤Å“Ã Â¥â€¹ Ã Â¤â€”Ã Â¥ÂÃ Â¤Â²Ã Â¥â€¹Ã Â¤Â¬Ã Â¤Â² Ã Â¤Â¸Ã Â¥ÂÃ Â¤Å¸Ã Â¥Ë†Ã Â¤â€šÃ Â¤Â¡Ã Â¤Â°Ã Â¥ÂÃ Â¤Â¡ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤â€¦Ã Â¤Â¨Ã Â¥ÂÃ Â¤Â¸Ã Â¤Â¾Ã Â¤Â° Ã Â¤Â¹Ã Â¥â€¹Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸Å½Â¨ <strong>Signature Identity:</strong> We craft a bespoke visual language for <strong>${brandName}</strong> ensuring your brand aesthetic is world-class.`
        };
        return res[lang];
    }

    // Ã°Å¸â€œË† LEAD GEN & SALES FUNNEL
    if (/(lead|sales|customer|client|order|enquiry|Ã Âªâ€”Ã Â«ÂÃ ÂªÂ°Ã ÂªÂ¾Ã ÂªÂ¹Ã Âªâ€¢|Ã Â¤â€”Ã Â¥ÂÃ Â¤Â°Ã Â¤Â¾Ã Â¤Â¹Ã Â¤â€¢|Ã Â¤Â¬Ã ÂªÂ¿Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ°Ã Â«â‚¬)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸â€™Â° <strong>Lead Generation:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ Ã ÂªÂ«Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ¤ Ã ÂªÂ²Ã ÂªÂ¾Ã ÂªË†Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ¸ Ã ÂªÅ“ Ã ÂªÂ¨Ã ÂªÂ¹Ã Â«â‚¬Ã Âªâ€š, Ã ÂªÂªÃ ÂªÂ£ <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂ°Ã ÂªÂ¿Ã ÂªÂ¯Ã ÂªÂ² Ã ÂªÂ¸Ã Â«â€¡Ã ÂªÂ²Ã Â«ÂÃ ÂªÂ¸ Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Ã ÂªÂ²Ã Â«â‚¬Ã ÂªÂ¡Ã Â«ÂÃ ÂªÂ¸ Ã ÂªÅ“Ã ÂªÂ¨Ã ÂªÂ°Ã Â«â€¡Ã ÂªÅ¸ Ã Âªâ€¢Ã ÂªÂ°Ã ÂªÂµÃ ÂªÂ¾ Ã ÂªÂªÃ ÂªÂ° Ã ÂªÂ«Ã Â«â€¹Ã Âªâ€¢Ã ÂªÂ¸ Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã°Å¸â€™Â° <strong>Lead Generation:</strong> Ã Â¤Â¹Ã Â¤Â® Ã Â¤Â¸Ã Â¤Â¿Ã Â¤Â°Ã Â¥ÂÃ Â¤Â« Ã Â¤Â²Ã Â¤Â¾Ã Â¤â€¡Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â¸ Ã Â¤Â¹Ã Â¥â‚¬ Ã Â¤Â¨Ã Â¤Â¹Ã Â¥â‚¬Ã Â¤â€š, Ã Â¤Â¬Ã Â¤Â²Ã Â¥ÂÃ Â¤â€¢Ã Â¤Â¿ <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤Â°Ã Â¤Â¿Ã Â¤Â¯Ã Â¤Â² Ã Â¤Â¸Ã Â¥â€¡Ã Â¤Â²Ã Â¥ÂÃ Â¤Â¸ Ã Â¤â€Ã Â¤Â° Ã Â¤Â²Ã Â¥â‚¬Ã Â¤Â¡Ã Â¥ÂÃ Â¤Â¸ Ã Â¤Å“Ã Â¤Â¨Ã Â¤Â°Ã Â¥â€¡Ã Â¤Å¸ Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤ÂªÃ Â¤Â° Ã Â¤Â§Ã Â¥ÂÃ Â¤Â¯Ã Â¤Â¾Ã Â¤Â¨ Ã Â¤â€¢Ã Â¥â€¡Ã Â¤â€šÃ Â¤Â¦Ã Â¥ÂÃ Â¤Â°Ã Â¤Â¿Ã Â¤Â¤ Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸â€™Â° <strong>Revenue Engineering:</strong> For <strong>${brandName}</strong>, we build high-conversion sales funnels that turn social traffic into high-value clients.`
        };
        return res[lang];
    }

    // Ã¢Å¡â€Ã¯Â¸Â COMPETITOR DOMINANCE
    if (/(other|competitor|better|best|market|Ã ÂªÂ¬Ã Â«â‚¬Ã ÂªÅ“Ã ÂªÂ¾|Ã ÂªÂ¦Ã Â«ÂÃ ÂªÂ¨Ã ÂªÂ¿Ã ÂªÂ¯Ã ÂªÂ¾|Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã Â«ÂÃ Âªâ€¢Ã Â«â€¡Ã ÂªÅ¸|Ã Â¤Â¦Ã Â¥ÂÃ Â¤Â¨Ã Â¤Â¿Ã Â¤Â¯Ã Â¤Â¾)/i.test(lowerText)) {
        const res = {
            guj: `Ã¢Å¡â€Ã¯Â¸Â <strong>Market Dominance:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ¨Ã Â«â€¡ Ã ÂªÂ¤Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã ÂªÂ¾ Ã Âªâ€¢Ã Â«â€¹Ã ÂªÂ®Ã Â«ÂÃ ÂªÂªÃ ÂªÂ¿Ã ÂªÅ¸Ã ÂªÂ¿Ã ÂªÂ¶Ã ÂªÂ¨Ã ÂªÂ¥Ã Â«â‚¬ 10 Ã ÂªÂ¡Ã Âªâ€”Ã ÂªÂ²Ã ÂªÂ¾Ã Âªâ€š Ã Âªâ€ Ã Âªâ€”Ã ÂªÂ³ Ã ÂªÂ°Ã ÂªÂ¾Ã Âªâ€“Ã ÂªÂµÃ ÂªÂ¾ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂÃ ÂªÂ¡Ã ÂªÂµÃ ÂªÂ¾Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂ¸ AI Ã ÂªÅ¸Ã Â«â€šÃ ÂªÂ²Ã Â«ÂÃ ÂªÂ¸Ã ÂªÂ¨Ã Â«â€¹ Ã Âªâ€°Ã ÂªÂªÃ ÂªÂ¯Ã Â«â€¹Ã Âªâ€” Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã¢Å¡â€Ã¯Â¸Â <strong>Market Dominance:</strong> Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¹ Ã Â¤â€ Ã Â¤ÂªÃ Â¤â€¢Ã Â¥â€¡ Ã Â¤â€¢Ã Â¥â€°Ã Â¤Â®Ã Â¥ÂÃ Â¤ÂªÃ Â¤Â¿Ã Â¤Å¸Ã Â¤Â¿Ã Â¤Â¶Ã Â¤Â¨ Ã Â¤Â¸Ã Â¥â€¡ 10 Ã Â¤â€¢Ã Â¤Â¦Ã Â¤Â® Ã Â¤â€ Ã Â¤â€”Ã Â¥â€¡ Ã Â¤Â°Ã Â¤â€“Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤ÂÃ Â¤Â¡Ã Â¤ÂµÃ Â¤Â¾Ã Â¤â€šÃ Â¤Â¸ AI Ã Â¤Å¸Ã Â¥â€šÃ Â¤Â²Ã Â¥ÂÃ Â¤Â¸ Ã Â¤â€¢Ã Â¤Â¾ Ã Â¤â€°Ã Â¤ÂªÃ Â¤Â¯Ã Â¥â€¹Ã Â¤â€” Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã¢Å¡â€Ã¯Â¸Â <strong>Elite Dominance:</strong> By leveraging advanced data-science, we keep <strong>${brandName}</strong> 10 steps ahead of the global competition.`
        };
        return res[lang];
    }

    // Ã°Å¸Å¡â‚¬ VIRAL GROWTH & REELS
    if (/(viral|reel|video|reach|Ã ÂªÂµÃ Â«â‚¬Ã ÂªÂ¡Ã ÂªÂ¿Ã ÂªÂ¯Ã Â«â€¹|Ã ÂªÂµÃ ÂªÂ¿Ã ÂªÂ¡Ã ÂªÂ¿Ã Âªâ€œ|Ã Â¤ÂµÃ Â¥â‚¬Ã Â¤Â¡Ã Â¤Â¿Ã Â¤Â¯Ã Â¥â€¹)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸Å¡â‚¬ <strong>Viral Growth:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂ¹Ã ÂªÂ¾Ã ÂªË†-Ã ÂªÂ°Ã ÂªÂ¿Ã ÂªÅ¸Ã Â«â€¡Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂ¶Ã ÂªÂ¨ Ã ÂªÂ¹Ã Â«â€šÃ Âªâ€¢ Ã ÂªÂ¸Ã ÂªÂ¾Ã ÂªÂ¥Ã Â«â€¡Ã ÂªÂ¨Ã ÂªÂ¾ Ã ÂªÅ¸Ã Â«â€šÃ Âªâ€šÃ Âªâ€¢Ã ÂªÂ¾ Ã ÂªÂµÃ ÂªÂ¿Ã ÂªÂ¡Ã ÂªÂ¿Ã ÂªÂ¯Ã Â«â€¹ Ã ÂªÂªÃ ÂªÂ° Ã ÂªÂ«Ã Â«â€¹Ã Âªâ€¢Ã ÂªÂ¸ Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã°Å¸Å¡â‚¬ <strong>Viral Growth:</strong> Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤Â¹Ã Â¤Â¾Ã Â¤Ë†-Ã Â¤Â°Ã Â¤Â¿Ã Â¤Å¸Ã Â¥â€¡Ã Â¤â€šÃ Â¤Â¶Ã Â¤Â¨ Ã Â¤Â¹Ã Â¥ÂÃ Â¤â€¢ Ã Â¤ÂµÃ Â¤Â¾Ã Â¤Â²Ã Â¥â€¡ Ã Â¤â€ºÃ Â¥â€¹Ã Â¤Å¸Ã Â¥â€¡ Ã Â¤ÂµÃ Â¥â‚¬Ã Â¤Â¡Ã Â¤Â¿Ã Â¤Â¯Ã Â¥â€¹ Ã Â¤ÂªÃ Â¤Â° Ã Â¤Â§Ã Â¥ÂÃ Â¤Â¯Ã Â¤Â¾Ã Â¤Â¨ Ã Â¤â€¢Ã Â¥â€¡Ã Â¤â€šÃ Â¤Â¦Ã Â¥ÂÃ Â¤Â°Ã Â¤Â¿Ã Â¤Â¤ Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸Å¡â‚¬ <strong>Viral Engineering:</strong> For <strong>${brandName}</strong>, we craft high-retention short-form content designed to amplify organic exposure.`
        };
        return res[lang];
    }

    // Ã°Å¸Å’Å¸ GREETINGS
    if (/^(hi|hello|hey|kem chho|kaise ho|namaste)/i.test(lowerText)) {
        const res = {
            guj: `Ã ÂªÂ¨Ã ÂªÂ®Ã ÂªÂ¸Ã Â«ÂÃ ÂªÂ¤Ã Â«â€¡! Ã ÂªÂ¹Ã Â«ÂÃ Âªâ€š Ã ÂªÂ¤Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã Â«â€¹ <strong>Elite AI Strategist</strong> Ã Âªâ€ºÃ Â«ÂÃ Âªâ€š. Ã Âªâ€ Ã ÂªÅ“Ã Â«â€¡ Ã Âªâ€ Ã ÂªÂªÃ ÂªÂ£Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ¨Ã Â«â€¡ Ã Âªâ€”Ã Â«ÂÃ ÂªÂ²Ã Â«â€¹Ã ÂªÂ¬Ã ÂªÂ² Ã ÂªÂ²Ã Â«â€¡Ã ÂªÂµÃ ÂªÂ² Ã ÂªÂªÃ ÂªÂ° Ã Âªâ€¢Ã Â«â€¡Ã ÂªÂµÃ Â«â‚¬ Ã ÂªÂ°Ã Â«â‚¬Ã ÂªÂ¤Ã Â«â€¡ Ã ÂªÂ²Ã ÂªË† Ã ÂªÅ“Ã ÂªË†Ã ÂªÂ?`,
            hin: `Ã Â¤Â¨Ã Â¤Â®Ã Â¤Â¸Ã Â¥ÂÃ Â¤Â¤Ã Â¥â€¡! Ã Â¤Â®Ã Â¥Ë†Ã Â¤â€š Ã Â¤â€ Ã Â¤ÂªÃ Â¤â€¢Ã Â¤Â¾ <strong>Elite AI Strategist</strong> Ã Â¤Â¹Ã Â¥â€šÃ Â¤ÂÃ Â¥Â¤ Ã Â¤â€ Ã Â¤Å“ Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¹ Ã Â¤â€”Ã Â¥ÂÃ Â¤Â²Ã Â¥â€¹Ã Â¤Â¬Ã Â¤Â² Ã Â¤Â²Ã Â¥â€¡Ã Â¤ÂµÃ Â¤Â² Ã Â¤ÂªÃ Â¤Â° Ã Â¤â€¢Ã Â¥Ë†Ã Â¤Â¸Ã Â¥â€¡ Ã Â¤Â²Ã Â¥â€¡Ã Â¤â€¢Ã Â¤Â° Ã Â¤Å¡Ã Â¤Â²Ã Â¥â€¡Ã Â¤â€š?`,
            eng: `Greetings. I'm your <strong>Elite AI Strategist</strong>. How shall we accelerate the global dominance of <strong>${brandName}</strong> today?`
        };
        return res[lang];
    }

    // Ã°Å¸â€™Â° ROI & PERFORMANCE
    if (/(roi|profit|sales|grow|business|vadharo|badhana|Ã ÂªÂ¨Ã ÂªÂ«Ã Â«â€¹|Ã Â¤Â®Ã Â¥ÂÃ Â¤Â¨Ã Â¤Â¾Ã Â¤Â«Ã Â¤Â¾)/i.test(lowerText)) {
        const res = {
            guj: `<strong>${brandName}</strong> Ã ÂªÂ¨Ã Â«â€¹ ROI Ã ÂªÂµÃ ÂªÂ§Ã ÂªÂ¾Ã ÂªÂ°Ã ÂªÂµÃ ÂªÂ¾ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ Ã ÂªÂ¡Ã Â«â€¡Ã ÂªÅ¸Ã ÂªÂ¾-Ã ÂªÂ¡Ã Â«ÂÃ ÂªÂ°Ã ÂªÂ¿Ã ÂªÂµÃ ÂªÂ¨ Ã ÂªÂÃ ÂªÂ¡Ã Â«ÂÃ ÂªÂ¸ Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Ã ÂªÂ¹Ã ÂªÂ¾Ã ÂªË†-Ã Âªâ€¢Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂµÃ ÂªÂ°Ã Â«ÂÃ ÂªÂÃ ÂªÂ¨ Ã Âªâ€¢Ã ÂªÂ¨Ã Â«ÂÃ ÂªÅ¸Ã Â«â€¡Ã ÂªÂ¨Ã Â«ÂÃ ÂªÅ¸ Ã ÂªÂªÃ ÂªÂ° Ã ÂªÂ«Ã Â«â€¹Ã Âªâ€¢Ã ÂªÂ¸ Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `<strong>${brandName}</strong> Ã Â¤â€¢Ã Â¤Â¾ ROI Ã Â¤Â¬Ã Â¥ÂÃ Â¤Â¾Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤Â¹Ã Â¤Â® Ã Â¤Â¡Ã Â¥â€¡Ã Â¤Å¸Ã Â¤Â¾-Ã Â¤Â¡Ã Â¥ÂÃ Â¤Â°Ã Â¤Â¿Ã Â¤ÂµÃ Â¤Â¨ Ã Â¤ÂÃ Â¤Â¡Ã Â¥ÂÃ Â¤Â¸ Ã Â¤â€Ã Â¤Â° Ã Â¤Â¹Ã Â¤Â¾Ã Â¤Ë†-Ã Â¤â€¢Ã Â¤Â¨Ã Â¥ÂÃ Â¤ÂµÃ Â¤Â°Ã Â¥ÂÃ Â¤Å“Ã Â¤Â¨ Ã Â¤â€¢Ã Â¤â€šÃ Â¤Å¸Ã Â¥â€¡Ã Â¤â€šÃ Â¤Å¸ Ã Â¤ÂªÃ Â¤Â° Ã Â¤Â§Ã Â¥ÂÃ Â¤Â¯Ã Â¤Â¾Ã Â¤Â¨ Ã Â¤Â¦Ã Â¥â€¡Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Precision ROI is our standard. We optimize <strong>${brandName}</strong> through aggressive data-driven scaling and performance marketing.`
        };
        return res[lang];
    }

    // Ã°Å¸â€ºÂ Ã¯Â¸Â SERVICES & AGENCY
    if (/(service|kaam|kam|what do you do|su karo cho|Ã Âªâ€¢Ã ÂªÂ¾Ã ÂªÂ®|Ã Â¤â€¢Ã Â¤Â¾Ã Â¤Â®)/i.test(lowerText)) {
        const res = {
            guj: `Vertex Global Tech Ã ÂªÂÃ Âªâ€¢ Ã ÂªÂªÃ Â«ÂÃ ÂªÂ°Ã Â«â‚¬Ã ÂªÂ®Ã ÂªÂ¿Ã ÂªÂ¯Ã ÂªÂ® Ã ÂªÂÃ ÂªÅ“Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂ¸Ã Â«â‚¬ Ã Âªâ€ºÃ Â«â€¡ Ã ÂªÅ“Ã Â«â€¡ <strong>Web Dev</strong>, <strong>Growth Marketing</strong>, Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ <strong>Elite Branding</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã Âªâ€š Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ¸Ã Â«ÂÃ ÂªÅ¸Ã ÂªÂ° Ã Âªâ€ºÃ Â«â€¡. <br><br>Ã Âªâ€¦Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã Â«â‚¬ Ã ÂªÂ®Ã Â«ÂÃ Âªâ€“Ã Â«ÂÃ ÂªÂ¯ Ã ÂªÂ¸Ã ÂªÂ°Ã Â«ÂÃ ÂªÂµÃ ÂªÂ¿Ã ÂªÂ¸Ã ÂªÂ®Ã ÂªÂ¾Ã Âªâ€š <strong>Web & App Development</strong>, <strong>Odoo Customization</strong>, <strong>Product Listing</strong>, <strong>Verifyboost Marketing</strong> Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ <strong>Google Ads Management</strong> Ã ÂªÂ¨Ã Â«â€¹ Ã ÂªÂ¸Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂµÃ Â«â€¡Ã ÂªÂ¶ Ã ÂªÂ¥Ã ÂªÂ¾Ã ÂªÂ¯ Ã Âªâ€ºÃ Â«â€¡. Ã ÂªÂµÃ ÂªÂ§Ã Â«Â Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ¹Ã ÂªÂ¿Ã ÂªÂ¤Ã Â«â‚¬ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">Ã Âªâ€¦Ã ÂªÂ¹Ã Â«â‚¬Ã Âªâ€š Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ²Ã ÂªÂ¿Ã Âªâ€¢ Ã Âªâ€¢Ã ÂªÂ°Ã Â«â€¹</a>.`,
            hin: `Vertex Global Tech Ã Â¤ÂÃ Â¤â€¢ Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¥â‚¬Ã Â¤Â®Ã Â¤Â¿Ã Â¤Â¯Ã Â¤Â® Ã Â¤ÂÃ Â¤Å“Ã Â¥â€¡Ã Â¤â€šÃ Â¤Â¸Ã Â¥â‚¬ Ã Â¤Â¹Ã Â¥Ë† Ã Â¤Å“Ã Â¥â€¹ <strong>Web Dev</strong>, <strong>Growth Marketing</strong>, Ã Â¤â€Ã Â¤Â° <strong>Elite Branding</strong> Ã Â¤Â®Ã Â¥â€¡Ã Â¤â€š Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â¸Ã Â¥ÂÃ Â¤Å¸Ã Â¤Â° Ã Â¤Â¹Ã Â¥Ë†Ã Â¥Â¤ <br><br>Ã Â¤Â¹Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â°Ã Â¥â‚¬ Ã Â¤Â®Ã Â¥ÂÃ Â¤â€“Ã Â¥ÂÃ Â¤Â¯ Ã Â¤Â¸Ã Â¤Â°Ã Â¥ÂÃ Â¤ÂµÃ Â¤Â¿Ã Â¤Â¸ Ã Â¤Â®Ã Â¥â€¡Ã Â¤â€š <strong>Web & App Development</strong>, <strong>Odoo Customization</strong>, <strong>Product Listing</strong>, <strong>Verifyboost Marketing</strong> Ã Â¤â€Ã Â¤Â° <strong>Google Ads Management</strong> Ã Â¤Â¶Ã Â¤Â¾Ã Â¤Â®Ã Â¤Â¿Ã Â¤Â² Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤ Ã Â¤â€¦Ã Â¤Â§Ã Â¤Â¿Ã Â¤â€¢ Ã Â¤Å“Ã Â¤Â¾Ã Â¤Â¨Ã Â¤â€¢Ã Â¤Â¾Ã Â¤Â°Ã Â¥â‚¬ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">Ã Â¤Â¯Ã Â¤Â¹Ã Â¤Â¾Ã Â¤Â Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â²Ã Â¤Â¿Ã Â¤â€¢ Ã Â¤â€¢Ã Â¤Â°Ã Â¥â€¡Ã Â¤â€š</a>Ã Â¥Â¤`,
            eng: `Vertex Global Tech is an elite powerhouse specializing in <strong>Bespoke Development</strong>, <strong>Aggressive Growth Marketing</strong>, and <strong>World-Class Branding</strong>. <br><br>Our core expertise includes <strong>Web & App Engineering</strong>, <strong>Odoo Customization</strong>, <strong>Product Marketplace Listings</strong>, <strong>Verifyboost Marketing</strong>, and <strong>Google Ads Management</strong>. <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Book a meeting here</a>.`
        };
        return res[lang];
    }

    // Ã°Å¸Å’Â WEB DEVELOPMENT
    if (/(web|website|site|ecommerce|e-commerce|Ã ÂªÂµÃ Â«â€¡Ã ÂªÂ¬Ã ÂªÂ¸Ã ÂªÂ¾Ã Âªâ€¡Ã ÂªÅ¸|Ã Â¤ÂµÃ Â¥â€¡Ã Â¤Â¬Ã Â¤Â¸Ã Â¤Â¾Ã Â¤â€¡Ã Â¤Å¸)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸Å’Â <strong>Web Development:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂ¹Ã ÂªÂ¾Ã Âªâ€¡-Ã ÂªÂªÃ ÂªÂ°Ã ÂªÂ«Ã Â«â€¹Ã ÂªÂ°Ã Â«ÂÃ ÂªÂ®Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂ¸, Ã ÂªÂ°Ã ÂªÂ¿Ã ÂªÂ¸Ã Â«ÂÃ ÂªÂªÃ Â«â€¹Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂ¸Ã ÂªÂ¿Ã ÂªÂµ Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Ã Âªâ€¢Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂµÃ ÂªÂ°Ã Â«ÂÃ ÂªÂÃ ÂªÂ¨-Ã Âªâ€œÃ ÂªÂªÃ Â«ÂÃ ÂªÅ¸Ã ÂªÂ¿Ã ÂªÂ®Ã ÂªÂ¾Ã Âªâ€¡Ã ÂªÂÃ Â«ÂÃ ÂªÂ¡ Ã ÂªÂµÃ Â«â€¡Ã ÂªÂ¬Ã ÂªÂ¸Ã ÂªÂ¾Ã Âªâ€¡Ã ÂªÅ¸Ã Â«ÂÃ ÂªÂ¸ Ã ÂªÂ¬Ã ÂªÂ¨Ã ÂªÂ¾Ã ÂªÂµÃ Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã°Å¸Å’Â <strong>Web Development:</strong> Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤Â¹Ã Â¤Â¾Ã Â¤Ë†-Ã Â¤ÂªÃ Â¤Â°Ã Â¤Â«Ã Â¥â€°Ã Â¤Â°Ã Â¥ÂÃ Â¤Â®Ã Â¥â€¡Ã Â¤â€šÃ Â¤Â¸, Ã Â¤Â°Ã Â¤Â¿Ã Â¤Â¸Ã Â¥ÂÃ Â¤ÂªÃ Â¥â€°Ã Â¤Â¨Ã Â¥ÂÃ Â¤Â¸Ã Â¤Â¿Ã Â¤Âµ Ã Â¤â€Ã Â¤Â° Ã Â¤â€¢Ã Â¤Â¨Ã Â¥ÂÃ Â¤ÂµÃ Â¤Â°Ã Â¥ÂÃ Â¤Å“Ã Â¤Â¨-Ã Â¤â€˜Ã Â¤ÂªÃ Â¥ÂÃ Â¤Å¸Ã Â¤Â¿Ã Â¤Â®Ã Â¤Â¾Ã Â¤â€¡Ã Â¤Å“Ã Â¤Â¼Ã Â¥ÂÃ Â¤Â¡ Ã Â¤ÂµÃ Â¥â€¡Ã Â¤Â¬Ã Â¤Â¸Ã Â¤Â¾Ã Â¤â€¡Ã Â¤Å¸Ã Â¥ÂÃ Â¤Â¸ Ã Â¤Â¬Ã Â¤Â¨Ã Â¤Â¾Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸Å’Â <strong>Elite Web Engineering:</strong> We craft high-performance, responsive, and conversion-optimized websites tailored specifically for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // Ã°Å¸â€œÂ± APP DEVELOPMENT
    if (/(app|application|mobile|ios|android|Ã ÂªÂÃ ÂªÂª|Ã Â¤ÂÃ Â¤ÂªÃ Â¥ÂÃ Â¤Â²Ã Â¤Â¿Ã Â¤â€¢Ã Â¥â€¡Ã Â¤Â¶Ã Â¤Â¨|Ã Â¤ÂÃ Â¤Âª)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸â€œÂ± <strong>App Development:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂ¨Ã Â«â€¡Ã ÂªÅ¸Ã ÂªÂ¿Ã ÂªÂµ Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ°Ã Â«â€¹Ã ÂªÂ¸-Ã ÂªÂªÃ Â«ÂÃ ÂªÂ²Ã Â«â€¡Ã ÂªÅ¸Ã ÂªÂ«Ã Â«â€¹Ã ÂªÂ°Ã Â«ÂÃ ÂªÂ® Ã ÂªÂ®Ã Â«â€¹Ã ÂªÂ¬Ã ÂªÂ¾Ã Âªâ€¡Ã ÂªÂ² Ã ÂªÂÃ ÂªÂªÃ Â«ÂÃ ÂªÂ¸ Ã ÂªÂ¡Ã Â«â€¡Ã ÂªÂµÃ ÂªÂ²Ã ÂªÂª Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã°Å¸â€œÂ± <strong>App Development:</strong> Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤Â¨Ã Â¥â€¡Ã Â¤Å¸Ã Â¤Â¿Ã Â¤Âµ Ã Â¤â€Ã Â¤Â° Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â°Ã Â¥â€°Ã Â¤Â¸-Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â²Ã Â¥â€¡Ã Â¤Å¸Ã Â¤Â«Ã Â¥â€°Ã Â¤Â°Ã Â¥ÂÃ Â¤Â® Ã Â¤Â®Ã Â¥â€¹Ã Â¤Â¬Ã Â¤Â¾Ã Â¤â€¡Ã Â¤Â² Ã Â¤ÂÃ Â¤ÂªÃ Â¥ÂÃ Â¤Â¸ Ã Â¤Â¡Ã Â¥â€¡Ã Â¤ÂµÃ Â¤Â²Ã Â¤Âª Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸â€œÂ± <strong>Mobile App Engineering:</strong> We develop robust, user-centric native and cross-platform mobile applications for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // Ã¢Å¡â„¢Ã¯Â¸Â ODOO CUSTOMIZATION
    if (/(odoo|erp|customization|system|Ã ÂªÂ¸Ã Â«â€¹Ã ÂªÂ«Ã Â«ÂÃ ÂªÅ¸Ã ÂªÂµÃ Â«â€¡Ã ÂªÂ°|Ã Â¤Â¸Ã Â¥â€°Ã Â¤Â«Ã Â¥ÂÃ Â¤Å¸Ã Â¤ÂµÃ Â¥â€¡Ã Â¤Â¯Ã Â¤Â°)/i.test(lowerText)) {
        const res = {
            guj: `Ã¢Å¡â„¢Ã¯Â¸Â <strong>Odoo Customization:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ Ã ÂªÂ¤Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã ÂªÂ¾ Ã ÂªÂ¬Ã ÂªÂ¿Ã ÂªÂÃ ÂªÂ¨Ã Â«â€¡Ã ÂªÂ¸ Ã Âªâ€œÃ ÂªÂªÃ ÂªÂ°Ã Â«â€¡Ã ÂªÂ¶Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂ¸Ã ÂªÂ¨Ã Â«â€¡ Ã ÂªÂ¸Ã ÂªÂ°Ã ÂªÂ³ Ã ÂªÂ¬Ã ÂªÂ¨Ã ÂªÂ¾Ã ÂªÂµÃ ÂªÂµÃ ÂªÂ¾ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂÃ ÂªÂ¡Ã ÂªÂµÃ ÂªÂ¾Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂ¸ Odoo Ã Âªâ€¢Ã ÂªÂ¸Ã Â«ÂÃ ÂªÅ¸Ã ÂªÂ®Ã ÂªÂ¾Ã Âªâ€¡Ã ÂªÂÃ Â«â€¡Ã ÂªÂ¶Ã ÂªÂ¨ Ã ÂªÂªÃ Â«â€šÃ ÂªÂ°Ã Â«ÂÃ Âªâ€š Ã ÂªÂªÃ ÂªÂ¾Ã ÂªÂ¡Ã Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã¢Å¡â„¢Ã¯Â¸Â <strong>Odoo Customization:</strong> Ã Â¤Â¹Ã Â¤Â® Ã Â¤â€ Ã Â¤ÂªÃ Â¤â€¢Ã Â¥â€¡ Ã Â¤Â¬Ã Â¤Â¿Ã Â¤Å“Ã Â¤Â¨Ã Â¥â€¡Ã Â¤Â¸ Ã Â¤â€˜Ã Â¤ÂªÃ Â¤Â°Ã Â¥â€¡Ã Â¤Â¶Ã Â¤Â¨Ã Â¥ÂÃ Â¤Â¸ Ã Â¤â€¢Ã Â¥â€¹ Ã Â¤â€ Ã Â¤Â¸Ã Â¤Â¾Ã Â¤Â¨ Ã Â¤Â¬Ã Â¤Â¨Ã Â¤Â¾Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤ÂÃ Â¤Â¡Ã Â¤ÂµÃ Â¤Â¾Ã Â¤â€šÃ Â¤Â¸ Odoo Ã Â¤â€¢Ã Â¤Â¸Ã Â¥ÂÃ Â¤Å¸Ã Â¤Â®Ã Â¤Â¾Ã Â¤â€¡Ã Â¤Å“Ã Â¤Â¼Ã Â¥â€¡Ã Â¤Â¶Ã Â¤Â¨ Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¤Â¦Ã Â¤Â¾Ã Â¤Â¨ Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã¢Å¡â„¢Ã¯Â¸Â <strong>Odoo Customization:</strong> We provide advanced Odoo customization and ERP integration to streamline operations for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // Ã°Å¸â€ºÂÃ¯Â¸Â PRODUCT LISTING
    if (/(product|listing|marketplace|amazon|flipkart|Ã ÂªÂªÃ Â«ÂÃ ÂªÂ°Ã Â«â€¹Ã ÂªÂ¡Ã Âªâ€¢Ã Â«ÂÃ ÂªÅ¸|Ã Â¤â€°Ã Â¤Â¤Ã Â¥ÂÃ Â¤ÂªÃ Â¤Â¾Ã Â¤Â¦)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸â€ºÂÃ¯Â¸Â <strong>Marketplace Listings:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ¨Ã ÂªÂ¾ Ã ÂªÂªÃ Â«ÂÃ ÂªÂ°Ã Â«â€¹Ã ÂªÂ¡Ã Âªâ€¢Ã Â«ÂÃ ÂªÅ¸Ã Â«ÂÃ ÂªÂ¸Ã ÂªÂ¨Ã Â«â€¡ Ã ÂªÅ¸Ã Â«â€¹Ã ÂªÂª Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã Â«ÂÃ Âªâ€¢Ã Â«â€¡Ã ÂªÅ¸Ã ÂªÂªÃ Â«ÂÃ ÂªÂ²Ã Â«â€¡Ã ÂªÂ¸ Ã ÂªÂªÃ ÂªÂ° Ã ÂªÂ°Ã Â«â€¡Ã ÂªÂ¨Ã Â«ÂÃ Âªâ€¢ Ã Âªâ€¢Ã ÂªÂ°Ã ÂªÂµÃ ÂªÂ¾ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂªÃ Â«ÂÃ ÂªÂ°Ã Â«â€¹Ã ÂªÂ«Ã Â«â€¡Ã ÂªÂ¶Ã ÂªÂ¨Ã ÂªÂ² Ã ÂªÂ²Ã ÂªÂ¿Ã ÂªÂ¸Ã Â«ÂÃ ÂªÅ¸Ã ÂªÂ¿Ã Âªâ€šÃ Âªâ€” Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã°Å¸â€ºÂÃ¯Â¸Â <strong>Marketplace Listings:</strong> Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¥â€¹Ã Â¤Â¡Ã Â¤â€¢Ã Â¥ÂÃ Â¤Å¸Ã Â¥ÂÃ Â¤Â¸ Ã Â¤â€¢Ã Â¥â€¹ Ã Â¤Å¸Ã Â¥â€°Ã Â¤Âª Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â°Ã Â¥ÂÃ Â¤â€¢Ã Â¥â€¡Ã Â¤Å¸Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â²Ã Â¥â€¡Ã Â¤Â¸ Ã Â¤ÂªÃ Â¤Â° Ã Â¤Â°Ã Â¥Ë†Ã Â¤â€šÃ Â¤â€¢ Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¥â€¹Ã Â¤Â«Ã Â¥â€¡Ã Â¤Â¶Ã Â¤Â¨Ã Â¤Â² Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â¸Ã Â¥ÂÃ Â¤Å¸Ã Â¤Â¿Ã Â¤â€šÃ Â¤â€” Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸â€ºÂÃ¯Â¸Â <strong>Product Marketplace Listings:</strong> We optimize and rank <strong>${brandName}</strong>'s products across top marketplaces for maximum visibility and sales.`
        };
        return res[lang];
    }

    // Ã°Å¸â€œË† GOOGLE ADS & MARKETING
    if (/(ads|google|verifyboost|marketing|campaign|Ã ÂªÂÃ ÂªÂ¡Ã Â«ÂÃ ÂªÂ¸|Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â°Ã Â¥ÂÃ Â¤â€¢Ã Â¥â€¡Ã Â¤Å¸Ã Â¤Â¿Ã Â¤â€šÃ Â¤â€”|Ã Â¤ÂµÃ Â¤Â¿Ã Â¤Å“Ã Â¥ÂÃ Â¤Å¾Ã Â¤Â¾Ã Â¤ÂªÃ Â¤Â¨)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸â€œË† <strong>Marketing & Ads:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Google Ads Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Verifyboost Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã Â«ÂÃ Âªâ€¢Ã Â«â€¡Ã ÂªÅ¸Ã ÂªÂ¿Ã Âªâ€šÃ Âªâ€” Ã ÂªÂ¦Ã Â«ÂÃ ÂªÂµÃ ÂªÂ¾Ã ÂªÂ°Ã ÂªÂ¾ Ã ÂªÂ¹Ã ÂªÂ¾Ã ÂªË† ROI Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Ã Âªâ€”Ã Â«ÂÃ ÂªÂ°Ã Â«â€¹Ã ÂªÂ¥ Ã ÂªÂ²Ã ÂªÂ¾Ã ÂªÂµÃ Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã°Å¸â€œË† <strong>Marketing & Ads:</strong> Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Google Ads Ã Â¤â€Ã Â¤Â° Verifyboost Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â°Ã Â¥ÂÃ Â¤â€¢Ã Â¥â€¡Ã Â¤Å¸Ã Â¤Â¿Ã Â¤â€šÃ Â¤â€” Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â§Ã Â¥ÂÃ Â¤Â¯Ã Â¤Â® Ã Â¤Â¸Ã Â¥â€¡ Ã Â¤Â¹Ã Â¤Â¾Ã Â¤Ë† ROI Ã Â¤â€Ã Â¤Â° Ã Â¤â€”Ã Â¥ÂÃ Â¤Â°Ã Â¥â€¹Ã Â¤Â¥ Ã Â¤Â²Ã Â¤Â¾Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸â€œË† <strong>Marketing & Ads:</strong> We scale <strong>${brandName}</strong> through precision Google Ads management and aggressive Verifyboost marketing campaigns.`
        };
        return res[lang];
    }

    // Ã°Å¸â€œâ€¦ MEETING SCHEDULER
    if (/(meeting|schedule|book|appointment|consultation|Ã ÂªÂ®Ã Â«â‚¬Ã ÂªÅ¸Ã ÂªÂ¿Ã Âªâ€šÃ Âªâ€”|Ã Â¤Â®Ã Â¥â‚¬Ã Â¤Å¸Ã Â¤Â¿Ã Â¤â€šÃ Â¤â€”)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸â€œâ€¦ <strong>Meeting Booking:</strong> Ã ÂªÂ¤Ã ÂªÂ®Ã Â«â€¡ Ã Âªâ€¦Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã Â«â‚¬ Ã ÂªÂ¸Ã ÂªÂ°Ã Â«ÂÃ ÂªÂµÃ ÂªÂ¿Ã ÂªÂ¸ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Ã Âªâ€¦Ã ÂªÂ¹Ã Â«â‚¬Ã Âªâ€š Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ²Ã ÂªÂ¿Ã Âªâ€¢ Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬Ã ÂªÂ¨Ã Â«â€¡</a> Ã ÂªÂ¡Ã ÂªÂ¾Ã ÂªÂ¯Ã ÂªÂ°Ã Â«â€¡Ã Âªâ€¢Ã Â«ÂÃ ÂªÅ¸ Ã ÂªÂ¸Ã ÂªÂ¿Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ¯Ã Â«â€¹Ã ÂªÂ° Ã ÂªÂ®Ã Â«â‚¬Ã ÂªÅ¸Ã ÂªÂ¿Ã Âªâ€šÃ Âªâ€” Ã ÂªÂ¬Ã Â«ÂÃ Âªâ€¢ Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬ Ã ÂªÂ¶Ã Âªâ€¢Ã Â«â€¹ Ã Âªâ€ºÃ Â«â€¹.`,
            hin: `Ã°Å¸â€œâ€¦ <strong>Meeting Booking:</strong> Ã Â¤â€ Ã Â¤Âª Ã Â¤Â¹Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â°Ã Â¥â‚¬ Ã Â¤Â¸Ã Â¤Â°Ã Â¥ÂÃ Â¤ÂµÃ Â¤Â¿Ã Â¤Â¸ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Ã Â¤Â¯Ã Â¤Â¹Ã Â¤Â¾Ã Â¤Â Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â²Ã Â¤Â¿Ã Â¤â€¢ Ã Â¤â€¢Ã Â¤Â°Ã Â¤â€¢Ã Â¥â€¡</a> Ã Â¤Â¡Ã Â¤Â¾Ã Â¤Â¯Ã Â¤Â°Ã Â¥â€¡Ã Â¤â€¢Ã Â¥ÂÃ Â¤Å¸ Ã Â¤Â¸Ã Â¤Â¿Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â¯Ã Â¥â€¹Ã Â¤Â° Ã Â¤Â®Ã Â¥â‚¬Ã Â¤Å¸Ã Â¤Â¿Ã Â¤â€šÃ Â¤â€” Ã Â¤Â¬Ã Â¥ÂÃ Â¤â€¢ Ã Â¤â€¢Ã Â¤Â° Ã Â¤Â¸Ã Â¤â€¢Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸â€œâ€¦ <strong>Secure Meeting Scheduler:</strong> You can instantly book a consultation for <strong>${brandName}</strong> by visiting our <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Secure Scheduler System</a>.`
        };
        return res[lang];
    }

    // Ã°Å¸â€œÅ¾ CONTACT
    if (/(human|call|speak|contact|agent|number|whatsapp|phone|help)/i.test(lowerText)) {
        const contactInfo = `WhatsApp: <strong>+91 96645 23986</strong> | Email: <strong>connectvertexglobal2209@gmail.com</strong>`;
        const res = {
            guj: `Ã ÂªÅ¡Ã Â«â€¹Ã Âªâ€¢Ã Â«ÂÃ Âªâ€¢Ã ÂªÂ¸, Ã ÂªÂ¤Ã ÂªÂ®Ã Â«â€¡ Ã Âªâ€¦Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã ÂªÂ¾ Ã ÂªÂÃ ÂªÂ¡Ã ÂªÂ®Ã ÂªÂ¿Ã ÂªÂ¨ Ã ÂªÂ¸Ã ÂªÂ¾Ã ÂªÂ¥Ã Â«â€¡ Ã ÂªÂ¸Ã Â«â‚¬Ã ÂªÂ§Ã Â«â‚¬ Ã ÂªÂµÃ ÂªÂ¾Ã ÂªÂ¤ Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬ Ã ÂªÂ¶Ã Âªâ€¢Ã Â«â€¹ Ã Âªâ€ºÃ Â«â€¹: ${contactInfo}`,
            hin: `Ã Â¤Å“Ã Â¥â‚¬ Ã Â¤Â¹Ã Â¤Â¾Ã Â¤Â, Ã Â¤â€ Ã Â¤Âª Ã Â¤Â¹Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â°Ã Â¥â€¡ Ã Â¤ÂÃ Â¤Â¡Ã Â¤Â®Ã Â¤Â¿Ã Â¤Â¨ Ã Â¤Â¸Ã Â¥â€¡ Ã Â¤Â¸Ã Â¥â‚¬Ã Â¤Â§Ã Â¥â€¡ Ã Â¤Â¸Ã Â¤â€šÃ Â¤ÂªÃ Â¤Â°Ã Â¥ÂÃ Â¤â€¢ Ã Â¤â€¢Ã Â¤Â° Ã Â¤Â¸Ã Â¤â€¢Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€š: ${contactInfo}`,
            eng: `I understand. You can bridge directly to our Elite Administration at: ${contactInfo}`
        };
        return res[lang];
    }

    // Ã°Å¸â€”Â¨Ã¯Â¸Â YES/NO CONFIRMATIONS
    if (/^(yes|no|ha|na|chalse|nathi)/i.test(lowerText)) {
        return `Understood. I've noted your preference for <strong>${brandName}</strong>. Is there anything else I can assist with?`;
    }

    if (/(delete|clear|remove|nikal|bhusi)/i.test(lowerText)) {
        return `I cannot delete your history for audit reasons, but the system <strong>automatically resets every 24 hours</strong>.`;
    }

    // Ã°Å¸â€™Â° PRICING & COST
    if (/(price|cost|charge|fees|money|budget|package|plan|Ã Âªâ€¢Ã ÂªÂ¿Ã Âªâ€šÃ ÂªÂ®Ã ÂªÂ¤|Ã ÂªÂ­Ã ÂªÂ¾Ã ÂªÂµ|Ã ÂªÂªÃ Â«Ë†Ã ÂªÂ¸Ã ÂªÂ¾|Ã Âªâ€“Ã ÂªÂ°Ã Â«ÂÃ ÂªÅ¡|Ã Â¤ÂªÃ Â¥Ë†Ã Â¤Â¸Ã Â¥â€¡|Ã Â¤Â«Ã Â¥â‚¬Ã Â¤Â¸|Ã Â¤â€¢Ã Â¥â‚¬Ã Â¤Â®Ã Â¤Â¤)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸â€™Â° <strong>Pricing:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã Â«â‚¬ Ã ÂªÂ¸Ã ÂªÂ°Ã Â«ÂÃ ÂªÂµÃ ÂªÂ¿Ã ÂªÂ¸ Ã Âªâ€¢Ã ÂªÂ¸Ã Â«ÂÃ ÂªÅ¸Ã ÂªÂ®Ã ÂªÂ¾Ã Âªâ€¡Ã ÂªÂÃ Â«ÂÃ ÂªÂ¡ Ã Âªâ€ºÃ Â«â€¡. <strong>${brandName}</strong> Ã ÂªÂ¨Ã Â«â‚¬ Ã ÂªÅ“Ã ÂªÂ°Ã Â«â€šÃ ÂªÂ°Ã ÂªÂ¿Ã ÂªÂ¯Ã ÂªÂ¾Ã ÂªÂ¤ Ã ÂªÂ®Ã Â«ÂÃ ÂªÅ“Ã ÂªÂ¬ Ã ÂªÂ¬Ã Â«â€¡Ã ÂªÂ¸Ã Â«ÂÃ ÂªÅ¸ Ã ÂªÂªÃ Â«â€¡Ã Âªâ€¢Ã Â«â€¡Ã ÂªÅ“ Ã ÂªÅ“Ã ÂªÂ¾Ã ÂªÂ£Ã ÂªÂµÃ ÂªÂ¾ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡, Ã Âªâ€¢Ã Â«Æ’Ã ÂªÂªÃ ÂªÂ¾ Ã Âªâ€¢Ã ÂªÂ°Ã Â«â‚¬Ã ÂªÂ¨Ã Â«â€¡ <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">Ã ÂªÂ®Ã Â«â‚¬Ã ÂªÅ¸Ã ÂªÂ¿Ã Âªâ€šÃ Âªâ€” Ã ÂªÂ¬Ã Â«ÂÃ Âªâ€¢ Ã Âªâ€¢Ã ÂªÂ°Ã Â«â€¹</a>.`,
            hin: `Ã°Å¸â€™Â° <strong>Pricing:</strong> Ã Â¤Â¹Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â°Ã Â¥â‚¬ Ã Â¤Â¸Ã Â¤Â°Ã Â¥ÂÃ Â¤ÂµÃ Â¤Â¿Ã Â¤Â¸ Ã Â¤â€¢Ã Â¤Â¸Ã Â¥ÂÃ Â¤Å¸Ã Â¤Â®Ã Â¤Â¾Ã Â¤â€¡Ã Â¤Å“Ã Â¥ÂÃ Â¤Â¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¥Â¤ <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â‚¬ Ã Â¤Å“Ã Â¤Â°Ã Â¥â€šÃ Â¤Â°Ã Â¤Â¤ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤â€¦Ã Â¤Â¨Ã Â¥ÂÃ Â¤Â¸Ã Â¤Â¾Ã Â¤Â° Ã Â¤Â¬Ã Â¥â€¡Ã Â¤Â¸Ã Â¥ÂÃ Â¤Å¸ Ã Â¤ÂªÃ Â¥Ë†Ã Â¤â€¢Ã Â¥â€¡Ã Â¤Å“ Ã Â¤Å“Ã Â¤Â¾Ã Â¤Â¨Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â, Ã Â¤â€¢Ã Â¥Æ’Ã Â¤ÂªÃ Â¤Â¯Ã Â¤Â¾ <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">Ã Â¤Â®Ã Â¥â‚¬Ã Â¤Å¸Ã Â¤Â¿Ã Â¤â€šÃ Â¤â€” Ã Â¤Â¬Ã Â¥ÂÃ Â¤â€¢ Ã Â¤â€¢Ã Â¤Â°Ã Â¥â€¡Ã Â¤â€š</a>Ã Â¥Â¤`,
            eng: `Ã°Å¸â€™Â° <strong>Investment & Pricing:</strong> We build custom solutions. To get an exact quote tailored to <strong>${brandName}</strong>'s requirements, please <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Schedule a Consultation</a>.`
        };
        return res[lang];
    }

    // Ã¢ÂÂ³ TIMEFRAME & DURATION
    if (/(time|days|duration|how long|fast|quick|Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ¯Ã ÂªÂ¾Ã ÂªÂ°Ã Â«â€¡|Ã Âªâ€¢Ã Â«â€¡Ã ÂªÅ¸Ã ÂªÂ²Ã Â«â€¹ Ã ÂªÂ¸Ã ÂªÂ®Ã ÂªÂ¯|Ã ÂªÂ¸Ã ÂªÂ®Ã ÂªÂ¯|Ã Â¤Â¸Ã Â¤Â®Ã Â¤Â¯|Ã Â¤Â¦Ã Â¤Â¿Ã Â¤Â¨)/i.test(lowerText)) {
        const res = {
            guj: `Ã¢ÂÂ³ <strong>Timeframe:</strong> Ã ÂªÂªÃ Â«ÂÃ ÂªÂ°Ã Â«â€¹Ã ÂªÅ“Ã Â«â€¡Ã Âªâ€¢Ã Â«ÂÃ ÂªÅ¸Ã ÂªÂ¨Ã Â«â‚¬ Ã ÂªÂ¸Ã ÂªÂ¾Ã Âªâ€¡Ã ÂªÂ Ã ÂªÂªÃ ÂªÂ° Ã Âªâ€ Ã ÂªÂ§Ã ÂªÂ¾Ã ÂªÂ° Ã ÂªÂ°Ã ÂªÂ¾Ã Âªâ€“Ã Â«â€¡ Ã Âªâ€ºÃ Â«â€¡. Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂ¹Ã Âªâ€šÃ ÂªÂ®Ã Â«â€¡Ã ÂªÂ¶Ã ÂªÂ¾ Ã ÂªÂ«Ã ÂªÂ¾Ã ÂªÂ¸Ã Â«ÂÃ ÂªÅ¸ Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Ã Âªâ€¢Ã Â«ÂÃ ÂªÂµÃ Â«â€¹Ã ÂªÂ²Ã ÂªÂ¿Ã ÂªÅ¸Ã Â«â‚¬ Ã ÂªÂ¡Ã ÂªÂ¿Ã ÂªÂ²Ã ÂªÂ¿Ã ÂªÂµÃ ÂªÂ°Ã Â«â‚¬ Ã Âªâ€ Ã ÂªÂªÃ Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã¢ÂÂ³ <strong>Timeframe:</strong> Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¥â€¹Ã Â¤Å“Ã Â¥â€¡Ã Â¤â€¢Ã Â¥ÂÃ Â¤Å¸ Ã Â¤â€¢Ã Â¥â‚¬ Ã Â¤Â¸Ã Â¤Â¾Ã Â¤â€¡Ã Â¤Å“ Ã Â¤ÂªÃ Â¤Â° Ã Â¤Â¨Ã Â¤Â¿Ã Â¤Â°Ã Â¥ÂÃ Â¤Â­Ã Â¤Â° Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¤Â¾ Ã Â¤Â¹Ã Â¥Ë†Ã Â¥Â¤ Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤Â¹Ã Â¤Â®Ã Â¥â€¡Ã Â¤Â¶Ã Â¤Â¾ Ã Â¤Â«Ã Â¤Â¾Ã Â¤Â¸Ã Â¥ÂÃ Â¤Å¸ Ã Â¤â€Ã Â¤Â° Ã Â¤â€¢Ã Â¥ÂÃ Â¤ÂµÃ Â¤Â¾Ã Â¤Â²Ã Â¤Â¿Ã Â¤Å¸Ã Â¥â‚¬ Ã Â¤Â¡Ã Â¤Â¿Ã Â¤Â²Ã Â¥â‚¬Ã Â¤ÂµÃ Â¤Â°Ã Â¥â‚¬ Ã Â¤Â¦Ã Â¥â€¡Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã¢ÂÂ³ <strong>Delivery Timeframe:</strong> Timelines depend on project complexity. However, we pride ourselves on rapid, high-quality execution for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // Ã°Å¸Ââ€  GUARANTEES & RESULTS
    if (/(guarantee|result|promise|sure|Ã Âªâ€”Ã Â«â€¡Ã ÂªÂ°Ã Âªâ€šÃ ÂªÅ¸Ã Â«â‚¬|Ã ÂªÂªÃ ÂªÂ°Ã ÂªÂ¿Ã ÂªÂ£Ã ÂªÂ¾Ã ÂªÂ®|Ã Â¤ÂªÃ Â¤Â°Ã Â¤Â¿Ã Â¤Â£Ã Â¤Â¾Ã Â¤Â®|Ã Â¤â€”Ã Â¤Â¾Ã Â¤Â°Ã Â¤â€šÃ Â¤Å¸Ã Â¥â‚¬)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸Ââ€  <strong>Results:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ Ã ÂªÂ¡Ã Â«â€¡Ã ÂªÅ¸Ã ÂªÂ¾-Ã ÂªÂ¡Ã Â«ÂÃ ÂªÂ°Ã ÂªÂ¿Ã ÂªÂµÃ ÂªÂ¨ Ã Âªâ€¦Ã ÂªÂªÃ Â«ÂÃ ÂªÂ°Ã Â«â€¹Ã ÂªÅ¡ Ã ÂªÂµÃ ÂªÂ¾Ã ÂªÂªÃ ÂªÂ°Ã Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ. <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ ROI Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Ã Âªâ€”Ã Â«ÂÃ ÂªÂ°Ã Â«â€¹Ã ÂªÂ¥Ã ÂªÂ¨Ã Â«â‚¬ Ã ÂªÂªÃ Â«â€šÃ ÂªÂ°Ã Â«â‚¬ Ã Âªâ€“Ã ÂªÂ¾Ã ÂªÂ¤Ã ÂªÂ°Ã Â«â‚¬ Ã Âªâ€ Ã ÂªÂªÃ Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã°Å¸Ââ€  <strong>Results:</strong> Ã Â¤Â¹Ã Â¤Â® Ã Â¤Â¡Ã Â¥â€¡Ã Â¤Å¸Ã Â¤Â¾-Ã Â¤Â¡Ã Â¥ÂÃ Â¤Â°Ã Â¤Â¿Ã Â¤ÂµÃ Â¤Â¨ Ã Â¤â€¦Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¥â€¹Ã Â¤Å¡ Ã Â¤â€¢Ã Â¤Â¾ Ã Â¤â€¡Ã Â¤Â¸Ã Â¥ÂÃ Â¤Â¤Ã Â¥â€¡Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â² Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤ <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â ROI Ã Â¤â€Ã Â¤Â° Ã Â¤â€”Ã Â¥ÂÃ Â¤Â°Ã Â¥â€¹Ã Â¤Â¥ Ã Â¤â€¢Ã Â¥â‚¬ Ã Â¤ÂªÃ Â¥â€šÃ Â¤Â°Ã Â¥â‚¬ Ã Â¤â€”Ã Â¤Â¾Ã Â¤Â°Ã Â¤â€šÃ Â¤Å¸Ã Â¥â‚¬ Ã Â¤Â¦Ã Â¥â€¡Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸Ââ€  <strong>Guaranteed Results:</strong> We are entirely data-driven. We engineer measurable growth and positive ROI for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // Ã°Å¸â€™Â¼ PORTFOLIO & PAST WORK
    if (/(portfolio|past work|example|sample|demo|Ã Âªâ€¢Ã ÂªÂ¾Ã ÂªÂ® Ã ÂªÂ¬Ã ÂªÂ¤Ã ÂªÂ¾Ã ÂªÂµÃ Â«â€¹|Ã ÂªÂªÃ Â«â€¹Ã ÂªÂ°Ã Â«ÂÃ ÂªÅ¸Ã ÂªÂ«Ã Â«â€¹Ã ÂªÂ²Ã ÂªÂ¿Ã ÂªÂ¯Ã Â«â€¹|Ã Â¤ÂªÃ Â¥â€¹Ã Â¤Â°Ã Â¥ÂÃ Â¤Å¸Ã Â¤Â«Ã Â¥â€¹Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â¯Ã Â¥â€¹|Ã Â¤Â¡Ã Â¥â€¡Ã Â¤Â®Ã Â¥â€¹)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸â€™Â¼ <strong>Portfolio:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ Ã ÂªËœÃ ÂªÂ£Ã ÂªÂ¾ Ã ÂªÂªÃ Â«ÂÃ ÂªÂ°Ã Â«â‚¬Ã ÂªÂ®Ã ÂªÂ¿Ã ÂªÂ¯Ã ÂªÂ® Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ²Ã ÂªÂ¾Ã ÂªÂ¯Ã ÂªÂ¨Ã Â«ÂÃ ÂªÅ¸Ã Â«ÂÃ ÂªÂ¸ Ã ÂªÂ¸Ã ÂªÂ¾Ã ÂªÂ¥Ã Â«â€¡ Ã Âªâ€¢Ã ÂªÂ¾Ã ÂªÂ® Ã Âªâ€¢Ã ÂªÂ°Ã Â«ÂÃ ÂªÂ¯Ã Â«ÂÃ Âªâ€š Ã Âªâ€ºÃ Â«â€¡. <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã Âªâ€¦Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã ÂªÂ¾ Ã ÂªÂªÃ ÂªÂ¾Ã ÂªÂ¸Ã Â«ÂÃ ÂªÅ¸ Ã ÂªÂµÃ ÂªÂ°Ã Â«ÂÃ Âªâ€¢Ã ÂªÂ¨Ã Â«ÂÃ Âªâ€š Ã ÂªÂ¡Ã Â«â€¡Ã ÂªÂ®Ã Â«â€¹ Ã ÂªÅ“Ã Â«â€¹Ã ÂªÂµÃ ÂªÂ¾ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂ®Ã Â«â‚¬Ã ÂªÅ¸Ã ÂªÂ¿Ã Âªâ€šÃ Âªâ€” Ã ÂªÂ¬Ã Â«ÂÃ Âªâ€¢ Ã Âªâ€¢Ã ÂªÂ°Ã Â«â€¹.`,
            hin: `Ã°Å¸â€™Â¼ <strong>Portfolio:</strong> Ã Â¤Â¹Ã Â¤Â®Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤â€¢Ã Â¤Ë† Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¥â‚¬Ã Â¤Â®Ã Â¤Â¿Ã Â¤Â¯Ã Â¤Â® Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â²Ã Â¤Â¾Ã Â¤â€¡Ã Â¤â€šÃ Â¤Å¸Ã Â¥ÂÃ Â¤Â¸ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â¸Ã Â¤Â¾Ã Â¤Â¥ Ã Â¤â€¢Ã Â¤Â¾Ã Â¤Â® Ã Â¤â€¢Ã Â¤Â¿Ã Â¤Â¯Ã Â¤Â¾ Ã Â¤Â¹Ã Â¥Ë†Ã Â¥Â¤ <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤Â¹Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â°Ã Â¥â€¡ Ã Â¤ÂªÃ Â¤Â¾Ã Â¤Â¸Ã Â¥ÂÃ Â¤Å¸ Ã Â¤ÂµÃ Â¤Â°Ã Â¥ÂÃ Â¤â€¢ Ã Â¤â€¢Ã Â¤Â¾ Ã Â¤Â¡Ã Â¥â€¡Ã Â¤Â®Ã Â¥â€¹ Ã Â¤Â¦Ã Â¥â€¡Ã Â¤â€“Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤Â®Ã Â¥â‚¬Ã Â¤Å¸Ã Â¤Â¿Ã Â¤â€šÃ Â¤â€” Ã Â¤Â¬Ã Â¥ÂÃ Â¤â€¢ Ã Â¤â€¢Ã Â¤Â°Ã Â¥â€¡Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸â€™Â¼ <strong>Elite Portfolio:</strong> We've scaled multiple premium brands. To see case studies relevant to <strong>${brandName}</strong>, let's connect on a quick call.`
        };
        return res[lang];
    }

    // Ã°Å¸â€™Â» TECH STACK
    if (/(react|node|php|python|tech|stack|technology|Ã ÂªÅ¸Ã Â«â€¡Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ¨Ã Â«â€¹Ã ÂªÂ²Ã Â«â€¹Ã ÂªÅ“Ã Â«â‚¬|Ã Â¤Â¤Ã Â¤â€¢Ã Â¤Â¨Ã Â¥â‚¬Ã Â¤â€¢|software|language)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸â€™Â» <strong>Technology:</strong> Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ React, Node.js, Python, Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Odoo Ã ÂªÅ“Ã Â«â€¡Ã ÂªÂµÃ Â«â‚¬ Ã ÂªÂ²Ã Â«â€¡Ã ÂªÅ¸Ã Â«â€¡Ã ÂªÂ¸Ã Â«ÂÃ ÂªÅ¸ Ã Âªâ€¦Ã ÂªÂ¨Ã Â«â€¡ Ã ÂªÂªÃ ÂªÂ¾Ã ÂªÂµÃ ÂªÂ°Ã ÂªÂ«Ã Â«ÂÃ ÂªÂ² Ã ÂªÅ¸Ã Â«â€¡Ã Âªâ€¢Ã Â«ÂÃ ÂªÂ¨Ã Â«â€¹Ã ÂªÂ²Ã Â«â€¹Ã ÂªÅ“Ã Â«â‚¬ Ã ÂªÂµÃ ÂªÂ¾Ã ÂªÂªÃ ÂªÂ°Ã Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã°Å¸â€™Â» <strong>Technology:</strong> Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â React, Node.js, Python, Ã Â¤â€Ã Â¤Â° Odoo Ã Â¤Å“Ã Â¥Ë†Ã Â¤Â¸Ã Â¥â‚¬ Ã Â¤Â²Ã Â¥â€¡Ã Â¤Å¸Ã Â¥â€¡Ã Â¤Â¸Ã Â¥ÂÃ Â¤Å¸ Ã Â¤â€Ã Â¤Â° Ã Â¤ÂªÃ Â¤Â¾Ã Â¤ÂµÃ Â¤Â°Ã Â¤Â«Ã Â¥ÂÃ Â¤Â² Ã Â¤Â¤Ã Â¤â€¢Ã Â¤Â¨Ã Â¥â‚¬Ã Â¤â€¢ Ã Â¤â€¢Ã Â¤Â¾ Ã Â¤â€°Ã Â¤ÂªÃ Â¤Â¯Ã Â¥â€¹Ã Â¤â€” Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸â€™Â» <strong>Advanced Tech Stack:</strong> For <strong>${brandName}</strong>, we leverage modern, scalable stacks including React, Node.js, Python, and Odoo ERP.`
        };
        return res[lang];
    }

    // Ã°Å¸â€ºÂ Ã¯Â¸Â SUPPORT & MAINTENANCE
    if (/(support|maintenance|after|help|Ã ÂªÂ¸Ã ÂªÂªÃ Â«â€¹Ã ÂªÂ°Ã Â«ÂÃ ÂªÅ¸|Ã ÂªÂ¸Ã ÂªÂ¹Ã ÂªÂ¾Ã ÂªÂ¯|Ã Â¤Â¸Ã Â¤ÂªÃ Â¥â€¹Ã Â¤Â°Ã Â¥ÂÃ Â¤Å¸|Ã Â¤Â®Ã Â¤Â¦Ã Â¤Â¦)/i.test(lowerText)) {
        const res = {
            guj: `Ã°Å¸â€ºÂ Ã¯Â¸Â <strong>Support:</strong> Ã ÂªÂ¡Ã ÂªÂ¿Ã ÂªÂ²Ã ÂªÂ¿Ã ÂªÂµÃ ÂªÂ°Ã Â«â‚¬ Ã ÂªÂªÃ Âªâ€ºÃ Â«â‚¬ Ã ÂªÂªÃ ÂªÂ£ Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ <strong>${brandName}</strong> Ã ÂªÂ¨Ã Â«â€¡ 24/7 Ã ÂªÂªÃ Â«ÂÃ ÂªÂ°Ã Â«â‚¬Ã ÂªÂ®Ã ÂªÂ¿Ã ÂªÂ¯Ã ÂªÂ® Ã ÂªÅ¸Ã Â«â€¡Ã Âªâ€¢Ã ÂªÂ¨Ã ÂªÂ¿Ã Âªâ€¢Ã ÂªÂ² Ã ÂªÂ¸Ã ÂªÂªÃ Â«â€¹Ã ÂªÂ°Ã Â«ÂÃ ÂªÅ¸ Ã Âªâ€ Ã ÂªÂªÃ Â«â‚¬Ã ÂªÂ Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ.`,
            hin: `Ã°Å¸â€ºÂ Ã¯Â¸Â <strong>Support:</strong> Ã Â¤Â¡Ã Â¤Â¿Ã Â¤Â²Ã Â¥â‚¬Ã Â¤ÂµÃ Â¤Â°Ã Â¥â‚¬ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â¬Ã Â¤Â¾Ã Â¤Â¦ Ã Â¤Â­Ã Â¥â‚¬ Ã Â¤Â¹Ã Â¤Â® <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¹ 24/7 Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¥â‚¬Ã Â¤Â®Ã Â¤Â¿Ã Â¤Â¯Ã Â¤Â® Ã Â¤Å¸Ã Â¥â€¡Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â¨Ã Â¤Â¿Ã Â¤â€¢Ã Â¤Â² Ã Â¤Â¸Ã Â¤ÂªÃ Â¥â€¹Ã Â¤Â°Ã Â¥ÂÃ Â¤Å¸ Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¤Â¦Ã Â¤Â¾Ã Â¤Â¨ Ã Â¤â€¢Ã Â¤Â°Ã Â¤Â¤Ã Â¥â€¡ Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤`,
            eng: `Ã°Å¸â€ºÂ Ã¯Â¸Â <strong>Elite Support:</strong> Post-deployment, we provide 24/7 premium technical support and maintenance to ensure <strong>${brandName}</strong> runs flawlessly.`
        };
        return res[lang];
    }

    // Ã°Å¸â„¢Â APPRECIATION / SMALL TALK
    if (/(thanks|thank you|good|awesome|great|nice|perfect|Ã Âªâ€ Ã ÂªÂ­Ã ÂªÂ¾Ã ÂªÂ°|Ã ÂªÂ¸Ã ÂªÂ°Ã ÂªÂ¸|Ã ÂªÂ§Ã ÂªÂ¨Ã Â«ÂÃ ÂªÂ¯Ã ÂªÂµÃ ÂªÂ¾Ã ÂªÂ¦|Ã Â¤Â§Ã Â¤Â¨Ã Â¥ÂÃ Â¤Â¯Ã Â¤ÂµÃ Â¤Â¾Ã Â¤Â¦|Ã Â¤â€¦Ã Â¤Å¡Ã Â¥ÂÃ Â¤â€ºÃ Â¤Â¾|Ã Â¤Â¬Ã Â¤Â¹Ã Â¥ÂÃ Â¤Â¤ Ã Â¤Â¬Ã Â¥ÂÃ Â¤Â¿Ã Â¤Â¯Ã Â¤Â¾)/i.test(lowerText)) {
        const res = {
            guj: `Ã ÂªÂ¤Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã Â«â€¹ Ã Âªâ€ Ã ÂªÂ­Ã ÂªÂ¾Ã ÂªÂ°! <strong>${brandName}</strong> Ã ÂªÂ¨Ã Â«â€¡ Ã ÂªÅ¸Ã Â«â€¹Ã ÂªÅ¡ Ã ÂªÂªÃ ÂªÂ° Ã ÂªÂ²Ã ÂªË† Ã ÂªÅ“Ã ÂªÂµÃ ÂªÂ¾ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã Âªâ€¦Ã ÂªÂ®Ã Â«â€¡ Ã ÂªÂ¹Ã Âªâ€šÃ ÂªÂ®Ã Â«â€¡Ã ÂªÂ¶Ã ÂªÂ¾ Ã ÂªÂ¤Ã Â«Ë†Ã ÂªÂ¯Ã ÂªÂ¾Ã ÂªÂ° Ã Âªâ€ºÃ Â«â‚¬Ã ÂªÂ. Ã ÂªÂ¬Ã Â«â‚¬Ã ÂªÅ“Ã Â«ÂÃ Âªâ€š Ã Âªâ€¢Ã Â«â€¹Ã ÂªË† Ã Âªâ€¢Ã ÂªÂ¾Ã ÂªÂ® Ã ÂªÂ¹Ã Â«â€¹Ã ÂªÂ¯ Ã ÂªÂ¤Ã Â«â€¹ Ã ÂªÅ“Ã ÂªÂ£Ã ÂªÂ¾Ã ÂªÂµÃ ÂªÅ“Ã Â«â€¹.`,
            hin: `Ã Â¤â€ Ã Â¤ÂªÃ Â¤â€¢Ã Â¤Â¾ Ã Â¤Â§Ã Â¤Â¨Ã Â¥ÂÃ Â¤Â¯Ã Â¤ÂµÃ Â¤Â¾Ã Â¤Â¦! <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¹ Ã Â¤Å¸Ã Â¥â€°Ã Â¤Âª Ã Â¤ÂªÃ Â¤Â° Ã Â¤Â²Ã Â¥â€¡ Ã Â¤Å“Ã Â¤Â¾Ã Â¤Â¨Ã Â¥â€¡ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤Â¹Ã Â¤Â® Ã Â¤Â¹Ã Â¤Â®Ã Â¥â€¡Ã Â¤Â¶Ã Â¤Â¾ Ã Â¤Â¤Ã Â¥Ë†Ã Â¤Â¯Ã Â¤Â¾Ã Â¤Â° Ã Â¤Â¹Ã Â¥Ë†Ã Â¤â€šÃ Â¥Â¤ Ã Â¤â€Ã Â¤Â° Ã Â¤â€¢Ã Â¥â€¹Ã Â¤Ë† Ã Â¤Â®Ã Â¤Â¦Ã Â¤Â¦ Ã Â¤Å¡Ã Â¤Â¾Ã Â¤Â¹Ã Â¤Â¿Ã Â¤Â Ã Â¤Â¤Ã Â¥â€¹ Ã Â¤Â¬Ã Â¤Â¤Ã Â¤Â¾Ã Â¤ÂÃ Â¤ÂÃ Â¥Â¤`,
            eng: `You're very welcome! We are committed to taking <strong>${brandName}</strong> to the top. Let me know if you need anything else.`
        };
        return res[lang];
    }

    // Ã°Å¸Â§Â  FALLBACK
    const fallback = {
        guj: `Ã ÂªÂ®Ã Â«â€¡Ã Âªâ€š Ã ÂªÂ¤Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã Â«â‚¬ Ã Âªâ€  Ã ÂªÂµÃ ÂªÂ¾Ã ÂªÂ¤ "${text}" Ã ÂªÂÃ ÂªÂ¡Ã ÂªÂ®Ã ÂªÂ¿Ã ÂªÂ¨ Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂ¨Ã Â«â€¹Ã Âªâ€šÃ ÂªÂ§Ã Â«â‚¬ Ã ÂªÂ²Ã Â«â‚¬Ã ÂªÂ§Ã Â«â‚¬ Ã Âªâ€ºÃ Â«â€¡. Ã ÂªÂ¤Ã Â«â€¡Ã Âªâ€œ <strong>${brandName}</strong> Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÅ¸Ã Â«â€¡ Ã ÂªÂ¤Ã ÂªÂ®Ã ÂªÂ¾Ã ÂªÂ°Ã Â«â€¹ Ã ÂªÂ¸Ã Âªâ€šÃ ÂªÂªÃ ÂªÂ°Ã Â«ÂÃ Âªâ€¢ Ã Âªâ€¢Ã ÂªÂ°Ã ÂªÂ¶Ã Â«â€¡.`,
        hin: `Ã Â¤Â®Ã Â¥Ë†Ã Â¤â€šÃ Â¤Â¨Ã Â¥â€¡ Ã Â¤â€ Ã Â¤ÂªÃ Â¤â€¢Ã Â¥â‚¬ Ã Â¤Â¯Ã Â¤Â¹ Ã Â¤Â¬Ã Â¤Â¾Ã Â¤Â¤ "${text}" Ã Â¤ÂÃ Â¤Â¡Ã Â¤Â®Ã Â¤Â¿Ã Â¤Â¨ Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤Â¨Ã Â¥â€¹Ã Â¤Å¸ Ã Â¤â€¢Ã Â¤Â° Ã Â¤Â²Ã Â¥â‚¬ Ã Â¤Â¹Ã Â¥Ë†Ã Â¥Â¤ Ã Â¤ÂµÃ Â¥â€¡ <strong>${brandName}</strong> Ã Â¤â€¢Ã Â¥â€¡ Ã Â¤Â²Ã Â¤Â¿Ã Â¤Â Ã Â¤â€ Ã Â¤ÂªÃ Â¤Â¸Ã Â¥â€¡ Ã Â¤Â¸Ã Â¤â€šÃ Â¤ÂªÃ Â¤Â°Ã Â¥ÂÃ Â¤â€¢ Ã Â¤â€¢Ã Â¤Â°Ã Â¥â€¡Ã Â¤â€šÃ Â¤â€”Ã Â¥â€¡Ã Â¥Â¤`,
        eng: `I've noted your inquiry regarding "${text}". I've logged this for our <strong>Elite Administration</strong> to review for <strong>${brandName}</strong>.`
    };
    return fallback[lang];
}
// ==========================================
// CLIENT VIDEO TASKS ENGINE
// ==========================================
function renderClientVideoTasks() {
    if (!currentBrand) return;
    const panel = document.getElementById('clientVideoTasksPanel');
    const container = document.getElementById('clientVideoTasksContainer');

    // Check if there are pending tasks
    const pendingTasks = (currentBrand.videoTasks || []).filter(t => t.status === 'pending');

    if (pendingTasks.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';
    container.innerHTML = '';

    pendingTasks.forEach((task, index) => {
        // Find exact index in original array for updating
        const realIndex = currentBrand.videoTasks.findIndex(t => t.id === task.id);

        const div = document.createElement('div');
        div.style.cssText = "background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); padding: 12px; border-radius: 12px;";
        div.innerHTML = `
            <div style="margin-bottom: 12px;">
                <p style="margin: 0; color: #fff; line-height: 1.4; font-size: 0.85rem; font-style: italic; opacity: 0.9;">"${task.note}"</p>
            </div>
            <form onsubmit="submitVideoLink(event, ${realIndex})" style="display: flex; flex-direction: column; gap: 10px;">
                <input type="url" id="driveLink_${task.id}" placeholder="Paste Drive Link..." required 
                    style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border-glass); color: white; padding: 10px; border-radius: 8px; font-size: 0.8rem; outline: none;">
                <button type="submit" style="width: 100%; background: #10B981; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.3s; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Submit for Review
                </button>
            </form>
        `;
        container.appendChild(div);
    });


    if (window.lucide) lucide.createIcons();
}

function submitVideoLink(e, index) {
    e.preventDefault();
    const task = currentBrand.videoTasks[index];
    const input = document.getElementById(`driveLink_${task.id}`);
    const link = input.value.trim();

    if (!link) return;

    task.driveLink = link;
    task.status = 'submitted';

    // Alert Admin via chat log
    if (!currentBrand.chat) currentBrand.chat = [];
    currentBrand.chat.push({ sender: 'bot', text: `Automated System Alert: Client has submitted a Video Drive Link for review.`, time: Date.now() });

    localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
        syncToSheetDB();
    renderClientVideoTasks();
    alert("Video Link Successfully Submitted to Administration for review!");
}

document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chatInputForm');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputEl = document.getElementById('chatInputText');
            const text = inputEl.value.trim();
            if (!text) return;

            if (!currentBrand.chat) currentBrand.chat = [];
            currentBrand.chat.push({ sender: 'user', text: text, time: Date.now() });

            inputEl.value = '';
            renderChatMessages();

            // SHOW TYPING INDICATOR (Human-Mixed Feel)
            const chatArea = document.getElementById('chatMessagesArea');
            const typingDiv = document.createElement('div');
            typingDiv.id = 'aiTypingIndicator';
            typingDiv.style.cssText = "align-self: flex-start; background: rgba(255,255,255,0.05); padding: 8px 16px; border-radius: 12px; font-size: 0.8rem; color: var(--text-gray); margin-bottom: 12px; font-style: italic;";
            typingDiv.innerHTML = `<span class="animate-pulse">AI Strategist is thinking...</span>`;
            chatArea.appendChild(typingDiv);
            chatArea.scrollTop = chatArea.scrollHeight;

            setTimeout(() => {
                const indicator = document.getElementById('aiTypingIndicator');
                if (indicator) indicator.remove();

                const response = getBotResponse(text);
                currentBrand.chat.push({ sender: 'bot', text: response, time: Date.now() });
                renderChatMessages();
                localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
                syncToSheetDB();
            }, 1500);
        });
    }
});

// ==========================================
// REAL-TIME AUTO-RESET ENGINE (Background Sync)
// ==========================================
setInterval(() => {
    if (!currentBrand || !currentBrand.chat) return;
    
    const now = Date.now();
    const expiry = 24 * 60 * 60 * 1000;
    const originalLength = currentBrand.chat.length;
    
    currentBrand.chat = currentBrand.chat.filter(msg => (now - msg.time) < expiry);
    
    if (currentBrand.chat.length !== originalLength) {
        console.log("Ã°Å¸Â§Â¹ Background Cleanup: Removing expired messages...");
        if (currentBrand.chat.length === 0) {
            currentBrand.chat.push({ sender: 'bot', text: "Welcome to Elite Support. I'm your AI Assistant. How can I help you today?", time: now });
        }
        renderChatMessages();
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
        syncToSheetDB();
    
    }
}, 60000); // Check every 60 seconds




