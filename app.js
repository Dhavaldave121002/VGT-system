// Data Management - Sync with Admin Portal
// Multi-API Failover System (Automatic Fallback if limit reached)

// â”€â”€ Server JSON Storage Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Set this to your SAVE_TOKEN value from Vercel environment variables.
// This is the same token set as SAVE_TOKEN in your Vercel project settings.
const SERVER_SAVE_TOKEN = window.__SERVER_SAVE_TOKEN__ || '';
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SHEETDB_API_URLS = [
    "https://sheetdb.io/api/v1/bv1v9wrq0pziw", // âœ… Secondary API Connected (Working)
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

// SheetDB Sync Engine (Client-Side) - JSON Blob Architecture with Failover
async function syncToSheetDB() {
    brands._lastUpdated = Date.now();
    syncToServer(); // ðŸš€ Also sync to Vercel Server JSON Storage concurrently

    // Strip metadata keys before pushing to cloud
    const cloudPayload = Object.fromEntries(
        Object.entries(brands).filter(([k]) => !k.startsWith('_'))
    );

    for (const url of SHEETDB_API_URLS) {
        if (!url || url.includes('YOUR_NEW_API_ID')) continue;
        try {
            const payload = { data: { database_json: JSON.stringify(cloudPayload) } };
            // Try PATCH first
            const patchRes = await fetch(url + '/id/1', {
                method: 'PATCH',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (patchRes.ok) {
                console.log(`âœ… Synced successfully to: ${url}`);
                return; // Stop if success
            } else if (patchRes.status === 429) {
                console.warn(`âš ï¸ Limit reached for ${url}, trying next...`);
                continue; // Try next API if limit reached
            } else {
                // If row 1 doesn't exist, try POST
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: [{ id: 1, database_json: JSON.stringify(cloudPayload) }] })
                });
                return;
            }
        } catch (error) {
            console.error(`âŒ Sync error with ${url}:`, error);
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
                    const cloudBrands = JSON.parse(rows[0].database_json) || {};
                    const localTime = brands._lastUpdated || 0;
                    const cloudTime = cloudBrands._lastUpdated || 0;
                    
                    if (cloudTime >= localTime) {
                        brands = cloudBrands;
                        if (window.LocalDataStore) LocalDataStore.saveAll(brands);
                        else localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
                        console.log(`âœ… Loaded from: ${url}`);
                    } else {
                        console.log(`ðŸ“¡ Local data is newer (${localTime} > ${cloudTime}), skipping overwrite.`);
                        syncToSheetDB(); // Push local changes back to cloud
                    }
                    return true;
                } else {
                    // ðŸš¨ NEW SHEET DETECTED: If sheet is empty but we have local data, populate the sheet
                    console.log(`ðŸ“¡ Initializing new empty sheet: ${url}`);
                    syncToSheetDB(); 
                    return true;
                }
            } else if (res.status === 429) {
                console.warn(`âš ï¸ Load limit reached for ${url}, trying next...`);
                continue;
            }
        } catch (error) {
            console.warn(`âŒ Load error with ${url}:`, error);
        }
    }
    return false;
}

// â”€â”€ Sync brands to server JSON storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        if (res.ok) console.log('âœ… Synced to server JSON storage');
        else console.warn('âš ï¸ Server sync failed:', res.status);
    } catch (e) {
        console.warn('âš ï¸ syncToServer error', e);
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
            console.log('âœ… Loaded from server');
            return true;
        }
    } catch (e) {
        console.warn('âš ï¸ loadFromServer error', e);
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

// Initialize â€” Load from Cloud DB first, then init UI
window.addEventListener('DOMContentLoaded', async () => {
    // ðŸ›¡ï¸ RESET UI STATE: Prevent 'Authenticated' artifacts
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.innerHTML = `<i data-lucide="unlock" style="width: 18px; height: 18px;"></i> Unlock Dashboard`;
        loginBtn.style.background = '';
    }
    if (loginForm) loginForm.reset();
    if (window.lucide) lucide.createIcons();

    // Load data with priority: localStorage â†’ server â†’ SheetDB
    if (!Object.keys(brands).length) {
        // Try server first (if API available)
        try {
            const serverLoaded = await loadFromServer();
            if (!serverLoaded) {
                await loadFromSheetDB(); // fallback to SheetDB if server empty or fails
            }
        } catch (e) {
            console.warn('âš ï¸ Server load failed, falling back to SheetDB', e);
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

    // âœ… PERSISTENT LOGIN CHECK
    const savedAdmin = localStorage.getItem('socialSphere_admin');
    if (savedAdmin === 'true') {
        window.location.href = 'admin.html';
        return;
    }

    const savedBrandId = localStorage.getItem('socialSphere_currentBrandId');
    if (savedBrandId && brands[savedBrandId]) {
        login(savedBrandId, true); // âœ… Pass true for auto-login (skip animations)
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

    // ðŸ›¡ï¸ REAL-TIME SECURITY SYNC: Pull latest credentials from Cloud before authenticating
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
        
        // âœ… Save Admin Session
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

    // âœ… Save User Session
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
            brands._lastUpdated = Date.now();
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
        planBadge.textContent = `${currentBrand.plan || 'Standard'} â€¢ ${currentBrand.trial || 'Active'}`;
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
                    <p style="font-size: 0.7rem; color: var(--text-gray); margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Admin Broadcast â€¢ Expires in ${Math.round((expiry - (now - msg.time)) / 3600000)} hours</p>
                </div>
                <button onclick="dismissMessage('${msg.time}', event)" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: 0.3s;" title="Dismiss Message">
                    <i data-lucide="x" style="width: 16px; height: 16px;"></i>
                </button>
            `;
            alertContainer.appendChild(div);
        });
        brands._lastUpdated = Date.now();
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
        brands._lastUpdated = Date.now();
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
    
    // âœ… Clear Session
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
            brands._lastUpdated = Date.now();
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
        brands._lastUpdated = Date.now();
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

    // ðŸ” SCRIPT DETECTION
    const hasGujaratiScript = /[\u0A80-\u0AFF]/.test(text);
    const hasHindiScript = /[\u0900-\u097F]/.test(text);
    const lang = hasGujaratiScript ? 'guj' : (hasHindiScript ? 'hin' : 'eng');

    // ðŸ† BLUE TICK & VERIFICATION
    if (/(blue tick|verify|verification|badge|tick|àª¬à«àª²à« àªŸà«€àª•|àªŸàª¿àª•|à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨|à¤¬à¥à¤²à¥‚ à¤Ÿà¤¿à¤•)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ’Ž <strong>Blue Tick Verification:</strong> àª…àª®à«‡ <strong>${brandName}</strong> àª¨à«‡ Instagram àª…àª¨à«‡ Facebook àªªàª° àªµà«‡àª°àª¿àª«àª¾àªˆàª¡ àª•àª°àª¾àªµàªµàª¾ àª®àª¾àªŸà«‡ àªàª•à«àª¸àªªàª°à«àªŸ àª¸àª°à«àªµàª¿àª¸ àª†àªªà«€àª àª›à«€àª.`,
            hin: `ðŸ’Ž <strong>Blue Tick Verification:</strong> à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‹ Instagram à¤”à¤° Facebook à¤ªà¤° à¤µà¥‡à¤°à¤¿à¤«à¤¾à¤‡à¤¡ à¤•à¤°à¤¾à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤à¤•à¥à¤¸à¤ªà¤°à¥à¤Ÿ à¤¸à¤°à¥à¤µà¤¿à¤¸ à¤¦à¥‡à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸ’Ž <strong>Elite Verification:</strong> We specialize in authenticating <strong>${brandName}</strong> across Meta platforms to establish absolute market authority.`
        };
        return res[lang];
    }

    // ðŸŽ¨ BRANDING & IDENTITY
    if (/(logo|design|branding|color|theme|àª¦à«‡àª–àª¾àªµ|à¤¡à¤¿à¤œà¤¾à¤‡à¤¨|à¤¬à¥à¤°à¤¾à¤‚à¤¡à¤¿à¤‚à¤—)/i.test(lowerText)) {
        const res = {
            guj: `ðŸŽ¨ <strong>Visual Identity:</strong> àª…àª®à«‡ <strong>${brandName}</strong> àª®àª¾àªŸà«‡ àªªà«àª°à«€àª®àª¿àª¯àª® àª•àª²àª° àªªà«‡àª²à«‡àªŸ àª…àª¨à«‡ àª²à«‹àª—à«‹ àª¡àª¿àªàª¾àªˆàª¨ àª¤à«ˆàª¯àª¾àª° àª•àª°à«€àª àª›à«€àª àªœà«‡ àª—à«àª²à«‹àª¬àª² àª¸à«àªŸàª¾àª¨à«àª¡àª°à«àª¡ àª®à«àªœàª¬ àª¹à«‹àª¯.`,
            hin: `ðŸŽ¨ <strong>Visual Identity:</strong> à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ à¤ªà¥à¤°à¥€à¤®à¤¿à¤¯à¤® à¤•à¤²à¤° à¤ªà¥ˆà¤²à¥‡à¤Ÿ à¤”à¤° à¤²à¥‹à¤—à¥‹ à¤¡à¤¿à¤œà¤¾à¤‡à¤¨ à¤¤à¥ˆà¤¯à¤¾à¤° à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚ à¤œà¥‹ à¤—à¥à¤²à¥‹à¤¬à¤² à¤¸à¥à¤Ÿà¥ˆà¤‚à¤¡à¤°à¥à¤¡ à¤•à¥‡ à¤…à¤¨à¥à¤¸à¤¾à¤° à¤¹à¥‹à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸŽ¨ <strong>Signature Identity:</strong> We craft a bespoke visual language for <strong>${brandName}</strong> ensuring your brand aesthetic is world-class.`
        };
        return res[lang];
    }

    // ðŸ“ˆ LEAD GEN & SALES FUNNEL
    if (/(lead|sales|customer|client|order|enquiry|àª—à«àª°àª¾àª¹àª•|à¤—à¥à¤°à¤¾à¤¹à¤•|à¤¬àª¿àª•à«àª°à«€)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ’° <strong>Lead Generation:</strong> àª…àª®à«‡ àª«àª•à«àª¤ àª²àª¾àªˆàª•à«àª¸ àªœ àª¨àª¹à«€àª‚, àªªàª£ <strong>${brandName}</strong> àª®àª¾àªŸà«‡ àª°àª¿àª¯àª² àª¸à«‡àª²à«àª¸ àª…àª¨à«‡ àª²à«€àª¡à«àª¸ àªœàª¨àª°à«‡àªŸ àª•àª°àªµàª¾ àªªàª° àª«à«‹àª•àª¸ àª•àª°à«€àª àª›à«€àª.`,
            hin: `ðŸ’° <strong>Lead Generation:</strong> à¤¹à¤® à¤¸à¤¿à¤°à¥à¤« à¤²à¤¾à¤‡à¤•à¥à¤¸ à¤¹à¥€ à¤¨à¤¹à¥€à¤‚, à¤¬à¤²à¥à¤•à¤¿ <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ à¤°à¤¿à¤¯à¤² à¤¸à¥‡à¤²à¥à¤¸ à¤”à¤° à¤²à¥€à¤¡à¥à¤¸ à¤œà¤¨à¤°à¥‡à¤Ÿ à¤•à¤°à¤¨à¥‡ à¤ªà¤° à¤§à¥à¤¯à¤¾à¤¨ à¤•à¥‡à¤‚à¤¦à¥à¤°à¤¿à¤¤ à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸ’° <strong>Revenue Engineering:</strong> For <strong>${brandName}</strong>, we build high-conversion sales funnels that turn social traffic into high-value clients.`
        };
        return res[lang];
    }

    // âš”ï¸ COMPETITOR DOMINANCE
    if (/(other|competitor|better|best|market|àª¬à«€àªœàª¾|àª¦à«àª¨àª¿àª¯àª¾|àª®àª¾àª°à«àª•à«‡àªŸ|à¤¦à¥à¤¨à¤¿à¤¯à¤¾)/i.test(lowerText)) {
        const res = {
            guj: `âš”ï¸ <strong>Market Dominance:</strong> àª…àª®à«‡ <strong>${brandName}</strong> àª¨à«‡ àª¤àª®àª¾àª°àª¾ àª•à«‹àª®à«àªªàª¿àªŸàª¿àª¶àª¨àª¥à«€ 10 àª¡àª—àª²àª¾àª‚ àª†àª—àª³ àª°àª¾àª–àªµàª¾ àª®àª¾àªŸà«‡ àªàª¡àªµàª¾àª¨à«àª¸ AI àªŸà«‚àª²à«àª¸àª¨à«‹ àª‰àªªàª¯à«‹àª— àª•àª°à«€àª àª›à«€àª.`,
            hin: `âš”ï¸ <strong>Market Dominance:</strong> à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‹ à¤†à¤ªà¤•à¥‡ à¤•à¥‰à¤®à¥à¤ªà¤¿à¤Ÿà¤¿à¤¶à¤¨ à¤¸à¥‡ 10 à¤•à¤¦à¤® à¤†à¤—à¥‡ à¤°à¤–à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤à¤¡à¤µà¤¾à¤‚à¤¸ AI à¤Ÿà¥‚à¤²à¥à¤¸ à¤•à¤¾ à¤‰à¤ªà¤¯à¥‹à¤— à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `âš”ï¸ <strong>Elite Dominance:</strong> By leveraging advanced data-science, we keep <strong>${brandName}</strong> 10 steps ahead of the global competition.`
        };
        return res[lang];
    }

    // ðŸš€ VIRAL GROWTH & REELS
    if (/(viral|reel|video|reach|àªµà«€àª¡àª¿àª¯à«‹|àªµàª¿àª¡àª¿àª“|à¤µà¥€à¤¡à¤¿à¤¯à¥‹)/i.test(lowerText)) {
        const res = {
            guj: `ðŸš€ <strong>Viral Growth:</strong> àª…àª®à«‡ <strong>${brandName}</strong> àª®àª¾àªŸà«‡ àª¹àª¾àªˆ-àª°àª¿àªŸà«‡àª¨à«àª¶àª¨ àª¹à«‚àª• àª¸àª¾àª¥à«‡àª¨àª¾ àªŸà«‚àª‚àª•àª¾ àªµàª¿àª¡àª¿àª¯à«‹ àªªàª° àª«à«‹àª•àª¸ àª•àª°à«€àª àª›à«€àª.`,
            hin: `ðŸš€ <strong>Viral Growth:</strong> à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ à¤¹à¤¾à¤ˆ-à¤°à¤¿à¤Ÿà¥‡à¤‚à¤¶à¤¨ à¤¹à¥à¤• à¤µà¤¾à¤²à¥‡ à¤›à¥‹à¤Ÿà¥‡ à¤µà¥€à¤¡à¤¿à¤¯à¥‹ à¤ªà¤° à¤§à¥à¤¯à¤¾à¤¨ à¤•à¥‡à¤‚à¤¦à¥à¤°à¤¿à¤¤ à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸš€ <strong>Viral Engineering:</strong> For <strong>${brandName}</strong>, we craft high-retention short-form content designed to amplify organic exposure.`
        };
        return res[lang];
    }

    // ðŸŒŸ GREETINGS
    if (/^(hi|hello|hey|kem chho|kaise ho|namaste)/i.test(lowerText)) {
        const res = {
            guj: `àª¨àª®àª¸à«àª¤à«‡! àª¹à«àª‚ àª¤àª®àª¾àª°à«‹ <strong>Elite AI Strategist</strong> àª›à«àª‚. àª†àªœà«‡ àª†àªªàª£à«‡ <strong>${brandName}</strong> àª¨à«‡ àª—à«àª²à«‹àª¬àª² àª²à«‡àªµàª² àªªàª° àª•à«‡àªµà«€ àª°à«€àª¤à«‡ àª²àªˆ àªœàªˆàª?`,
            hin: `à¤¨à¤®à¤¸à¥à¤¤à¥‡! à¤®à¥ˆà¤‚ à¤†à¤ªà¤•à¤¾ <strong>Elite AI Strategist</strong> à¤¹à¥‚à¤à¥¤ à¤†à¤œ à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‹ à¤—à¥à¤²à¥‹à¤¬à¤² à¤²à¥‡à¤µà¤² à¤ªà¤° à¤•à¥ˆà¤¸à¥‡ à¤²à¥‡à¤•à¤° à¤šà¤²à¥‡à¤‚?`,
            eng: `Greetings. I'm your <strong>Elite AI Strategist</strong>. How shall we accelerate the global dominance of <strong>${brandName}</strong> today?`
        };
        return res[lang];
    }

    // ðŸ’° ROI & PERFORMANCE
    if (/(roi|profit|sales|grow|business|vadharo|badhana|àª¨àª«à«‹|à¤®à¥à¤¨à¤¾à¤«à¤¾)/i.test(lowerText)) {
        const res = {
            guj: `<strong>${brandName}</strong> àª¨à«‹ ROI àªµàª§àª¾àª°àªµàª¾ àª®àª¾àªŸà«‡ àª…àª®à«‡ àª¡à«‡àªŸàª¾-àª¡à«àª°àª¿àªµàª¨ àªàª¡à«àª¸ àª…àª¨à«‡ àª¹àª¾àªˆ-àª•àª¨à«àªµàª°à«àªàª¨ àª•àª¨à«àªŸà«‡àª¨à«àªŸ àªªàª° àª«à«‹àª•àª¸ àª•àª°à«€àª àª›à«€àª.`,
            hin: `<strong>${brandName}</strong> à¤•à¤¾ ROI à¤¬à¥à¤¾à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤¹à¤® à¤¡à¥‡à¤Ÿà¤¾-à¤¡à¥à¤°à¤¿à¤µà¤¨ à¤à¤¡à¥à¤¸ à¤”à¤° à¤¹à¤¾à¤ˆ-à¤•à¤¨à¥à¤µà¤°à¥à¤œà¤¨ à¤•à¤‚à¤Ÿà¥‡à¤‚à¤Ÿ à¤ªà¤° à¤§à¥à¤¯à¤¾à¤¨ à¤¦à¥‡à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `Precision ROI is our standard. We optimize <strong>${brandName}</strong> through aggressive data-driven scaling and performance marketing.`
        };
        return res[lang];
    }

    // ðŸ› ï¸ SERVICES & AGENCY
    if (/(service|kaam|kam|what do you do|su karo cho|àª•àª¾àª®|à¤•à¤¾à¤®)/i.test(lowerText)) {
        const res = {
            guj: `Vertex Global Tech àªàª• àªªà«àª°à«€àª®àª¿àª¯àª® àªàªœàª¨à«àª¸à«€ àª›à«‡ àªœà«‡ <strong>Web Dev</strong>, <strong>Growth Marketing</strong>, àª…àª¨à«‡ <strong>Elite Branding</strong> àª®àª¾àª‚ àª®àª¾àª¸à«àªŸàª° àª›à«‡. <br><br>àª…àª®àª¾àª°à«€ àª®à«àª–à«àª¯ àª¸àª°à«àªµàª¿àª¸àª®àª¾àª‚ <strong>Web & App Development</strong>, <strong>Odoo Customization</strong>, <strong>Product Listing</strong>, <strong>Verifyboost Marketing</strong> àª…àª¨à«‡ <strong>Google Ads Management</strong> àª¨à«‹ àª¸àª®àª¾àªµà«‡àª¶ àª¥àª¾àª¯ àª›à«‡. àªµàª§à« àª®àª¾àª¹àª¿àª¤à«€ àª®àª¾àªŸà«‡ <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">àª…àª¹à«€àª‚ àª•à«àª²àª¿àª• àª•àª°à«‹</a>.`,
            hin: `Vertex Global Tech à¤à¤• à¤ªà¥à¤°à¥€à¤®à¤¿à¤¯à¤® à¤à¤œà¥‡à¤‚à¤¸à¥€ à¤¹à¥ˆ à¤œà¥‹ <strong>Web Dev</strong>, <strong>Growth Marketing</strong>, à¤”à¤° <strong>Elite Branding</strong> à¤®à¥‡à¤‚ à¤®à¤¾à¤¸à¥à¤Ÿà¤° à¤¹à¥ˆà¥¤ <br><br>à¤¹à¤®à¤¾à¤°à¥€ à¤®à¥à¤–à¥à¤¯ à¤¸à¤°à¥à¤µà¤¿à¤¸ à¤®à¥‡à¤‚ <strong>Web & App Development</strong>, <strong>Odoo Customization</strong>, <strong>Product Listing</strong>, <strong>Verifyboost Marketing</strong> à¤”à¤° <strong>Google Ads Management</strong> à¤¶à¤¾à¤®à¤¿à¤² à¤¹à¥ˆà¤‚à¥¤ à¤…à¤§à¤¿à¤• à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤•à¥‡ à¤²à¤¿à¤ <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">à¤¯à¤¹à¤¾à¤ à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¥‡à¤‚</a>à¥¤`,
            eng: `Vertex Global Tech is an elite powerhouse specializing in <strong>Bespoke Development</strong>, <strong>Aggressive Growth Marketing</strong>, and <strong>World-Class Branding</strong>. <br><br>Our core expertise includes <strong>Web & App Engineering</strong>, <strong>Odoo Customization</strong>, <strong>Product Marketplace Listings</strong>, <strong>Verifyboost Marketing</strong>, and <strong>Google Ads Management</strong>. <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Book a meeting here</a>.`
        };
        return res[lang];
    }

    // ðŸŒ WEB DEVELOPMENT
    if (/(web|website|site|ecommerce|e-commerce|àªµà«‡àª¬àª¸àª¾àª‡àªŸ|à¤µà¥‡à¤¬à¤¸à¤¾à¤‡à¤Ÿ)/i.test(lowerText)) {
        const res = {
            guj: `ðŸŒ <strong>Web Development:</strong> àª…àª®à«‡ <strong>${brandName}</strong> àª®àª¾àªŸà«‡ àª¹àª¾àª‡-àªªàª°àª«à«‹àª°à«àª®àª¨à«àª¸, àª°àª¿àª¸à«àªªà«‹àª¨à«àª¸àª¿àªµ àª…àª¨à«‡ àª•àª¨à«àªµàª°à«àªàª¨-àª“àªªà«àªŸàª¿àª®àª¾àª‡àªà«àª¡ àªµà«‡àª¬àª¸àª¾àª‡àªŸà«àª¸ àª¬àª¨àª¾àªµà«€àª àª›à«€àª.`,
            hin: `ðŸŒ <strong>Web Development:</strong> à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ à¤¹à¤¾à¤ˆ-à¤ªà¤°à¤«à¥‰à¤°à¥à¤®à¥‡à¤‚à¤¸, à¤°à¤¿à¤¸à¥à¤ªà¥‰à¤¨à¥à¤¸à¤¿à¤µ à¤”à¤° à¤•à¤¨à¥à¤µà¤°à¥à¤œà¤¨-à¤‘à¤ªà¥à¤Ÿà¤¿à¤®à¤¾à¤‡à¤œà¤¼à¥à¤¡ à¤µà¥‡à¤¬à¤¸à¤¾à¤‡à¤Ÿà¥à¤¸ à¤¬à¤¨à¤¾à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸŒ <strong>Elite Web Engineering:</strong> We craft high-performance, responsive, and conversion-optimized websites tailored specifically for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // ðŸ“± APP DEVELOPMENT
    if (/(app|application|mobile|ios|android|àªàªª|à¤à¤ªà¥à¤²à¤¿à¤•à¥‡à¤¶à¤¨|à¤à¤ª)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ“± <strong>App Development:</strong> àª…àª®à«‡ <strong>${brandName}</strong> àª®àª¾àªŸà«‡ àª¨à«‡àªŸàª¿àªµ àª…àª¨à«‡ àª•à«àª°à«‹àª¸-àªªà«àª²à«‡àªŸàª«à«‹àª°à«àª® àª®à«‹àª¬àª¾àª‡àª² àªàªªà«àª¸ àª¡à«‡àªµàª²àªª àª•àª°à«€àª àª›à«€àª.`,
            hin: `ðŸ“± <strong>App Development:</strong> à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ à¤¨à¥‡à¤Ÿà¤¿à¤µ à¤”à¤° à¤•à¥à¤°à¥‰à¤¸-à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¥‰à¤°à¥à¤® à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤à¤ªà¥à¤¸ à¤¡à¥‡à¤µà¤²à¤ª à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸ“± <strong>Mobile App Engineering:</strong> We develop robust, user-centric native and cross-platform mobile applications for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // âš™ï¸ ODOO CUSTOMIZATION
    if (/(odoo|erp|customization|system|àª¸à«‹àª«à«àªŸàªµà«‡àª°|à¤¸à¥‰à¤«à¥à¤Ÿà¤µà¥‡à¤¯à¤°)/i.test(lowerText)) {
        const res = {
            guj: `âš™ï¸ <strong>Odoo Customization:</strong> àª…àª®à«‡ àª¤àª®àª¾àª°àª¾ àª¬àª¿àªàª¨à«‡àª¸ àª“àªªàª°à«‡àª¶àª¨à«àª¸àª¨à«‡ àª¸àª°àª³ àª¬àª¨àª¾àªµàªµàª¾ àª®àª¾àªŸà«‡ àªàª¡àªµàª¾àª¨à«àª¸ Odoo àª•àª¸à«àªŸàª®àª¾àª‡àªà«‡àª¶àª¨ àªªà«‚àª°à«àª‚ àªªàª¾àª¡à«€àª àª›à«€àª.`,
            hin: `âš™ï¸ <strong>Odoo Customization:</strong> à¤¹à¤® à¤†à¤ªà¤•à¥‡ à¤¬à¤¿à¤œà¤¨à¥‡à¤¸ à¤‘à¤ªà¤°à¥‡à¤¶à¤¨à¥à¤¸ à¤•à¥‹ à¤†à¤¸à¤¾à¤¨ à¤¬à¤¨à¤¾à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤à¤¡à¤µà¤¾à¤‚à¤¸ Odoo à¤•à¤¸à¥à¤Ÿà¤®à¤¾à¤‡à¤œà¤¼à¥‡à¤¶à¤¨ à¤ªà¥à¤°à¤¦à¤¾à¤¨ à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `âš™ï¸ <strong>Odoo Customization:</strong> We provide advanced Odoo customization and ERP integration to streamline operations for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // ðŸ›ï¸ PRODUCT LISTING
    if (/(product|listing|marketplace|amazon|flipkart|àªªà«àª°à«‹àª¡àª•à«àªŸ|à¤‰à¤¤à¥à¤ªà¤¾à¤¦)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ›ï¸ <strong>Marketplace Listings:</strong> àª…àª®à«‡ <strong>${brandName}</strong> àª¨àª¾ àªªà«àª°à«‹àª¡àª•à«àªŸà«àª¸àª¨à«‡ àªŸà«‹àªª àª®àª¾àª°à«àª•à«‡àªŸàªªà«àª²à«‡àª¸ àªªàª° àª°à«‡àª¨à«àª• àª•àª°àªµàª¾ àª®àª¾àªŸà«‡ àªªà«àª°à«‹àª«à«‡àª¶àª¨àª² àª²àª¿àª¸à«àªŸàª¿àª‚àª— àª•àª°à«€àª àª›à«€àª.`,
            hin: `ðŸ›ï¸ <strong>Marketplace Listings:</strong> à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‡ à¤ªà¥à¤°à¥‹à¤¡à¤•à¥à¤Ÿà¥à¤¸ à¤•à¥‹ à¤Ÿà¥‰à¤ª à¤®à¤¾à¤°à¥à¤•à¥‡à¤Ÿà¤ªà¥à¤²à¥‡à¤¸ à¤ªà¤° à¤°à¥ˆà¤‚à¤• à¤•à¤°à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤ªà¥à¤°à¥‹à¤«à¥‡à¤¶à¤¨à¤² à¤²à¤¿à¤¸à¥à¤Ÿà¤¿à¤‚à¤— à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸ›ï¸ <strong>Product Marketplace Listings:</strong> We optimize and rank <strong>${brandName}</strong>'s products across top marketplaces for maximum visibility and sales.`
        };
        return res[lang];
    }

    // ðŸ“ˆ GOOGLE ADS & MARKETING
    if (/(ads|google|verifyboost|marketing|campaign|àªàª¡à«àª¸|à¤®à¤¾à¤°à¥à¤•à¥‡à¤Ÿà¤¿à¤‚à¤—|à¤µà¤¿à¤œà¥à¤žà¤¾à¤ªà¤¨)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ“ˆ <strong>Marketing & Ads:</strong> àª…àª®à«‡ <strong>${brandName}</strong> àª®àª¾àªŸà«‡ Google Ads àª…àª¨à«‡ Verifyboost àª®àª¾àª°à«àª•à«‡àªŸàª¿àª‚àª— àª¦à«àªµàª¾àª°àª¾ àª¹àª¾àªˆ ROI àª…àª¨à«‡ àª—à«àª°à«‹àª¥ àª²àª¾àªµà«€àª àª›à«€àª.`,
            hin: `ðŸ“ˆ <strong>Marketing & Ads:</strong> à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ Google Ads à¤”à¤° Verifyboost à¤®à¤¾à¤°à¥à¤•à¥‡à¤Ÿà¤¿à¤‚à¤— à¤•à¥‡ à¤®à¤¾à¤§à¥à¤¯à¤® à¤¸à¥‡ à¤¹à¤¾à¤ˆ ROI à¤”à¤° à¤—à¥à¤°à¥‹à¤¥ à¤²à¤¾à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸ“ˆ <strong>Marketing & Ads:</strong> We scale <strong>${brandName}</strong> through precision Google Ads management and aggressive Verifyboost marketing campaigns.`
        };
        return res[lang];
    }

    // ðŸ“… MEETING SCHEDULER
    if (/(meeting|schedule|book|appointment|consultation|àª®à«€àªŸàª¿àª‚àª—|à¤®à¥€à¤Ÿà¤¿à¤‚à¤—)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ“… <strong>Meeting Booking:</strong> àª¤àª®à«‡ àª…àª®àª¾àª°à«€ àª¸àª°à«àªµàª¿àª¸ àª®àª¾àªŸà«‡ <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">àª…àª¹à«€àª‚ àª•à«àª²àª¿àª• àª•àª°à«€àª¨à«‡</a> àª¡àª¾àª¯àª°à«‡àª•à«àªŸ àª¸àª¿àª•à«àª¯à«‹àª° àª®à«€àªŸàª¿àª‚àª— àª¬à«àª• àª•àª°à«€ àª¶àª•à«‹ àª›à«‹.`,
            hin: `ðŸ“… <strong>Meeting Booking:</strong> à¤†à¤ª à¤¹à¤®à¤¾à¤°à¥€ à¤¸à¤°à¥à¤µà¤¿à¤¸ à¤•à¥‡ à¤²à¤¿à¤ <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">à¤¯à¤¹à¤¾à¤ à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤•à¥‡</a> à¤¡à¤¾à¤¯à¤°à¥‡à¤•à¥à¤Ÿ à¤¸à¤¿à¤•à¥à¤¯à¥‹à¤° à¤®à¥€à¤Ÿà¤¿à¤‚à¤— à¤¬à¥à¤• à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸ“… <strong>Secure Meeting Scheduler:</strong> You can instantly book a consultation for <strong>${brandName}</strong> by visiting our <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Secure Scheduler System</a>.`
        };
        return res[lang];
    }

    // ðŸ“ž CONTACT
    if (/(human|call|speak|contact|agent|number|whatsapp|phone|help)/i.test(lowerText)) {
        const contactInfo = `WhatsApp: <strong>+91 96645 23986</strong> | Email: <strong>connectvertexglobal2209@gmail.com</strong>`;
        const res = {
            guj: `àªšà«‹àª•à«àª•àª¸, àª¤àª®à«‡ àª…àª®àª¾àª°àª¾ àªàª¡àª®àª¿àª¨ àª¸àª¾àª¥à«‡ àª¸à«€àª§à«€ àªµàª¾àª¤ àª•àª°à«€ àª¶àª•à«‹ àª›à«‹: ${contactInfo}`,
            hin: `à¤œà¥€ à¤¹à¤¾à¤, à¤†à¤ª à¤¹à¤®à¤¾à¤°à¥‡ à¤à¤¡à¤®à¤¿à¤¨ à¤¸à¥‡ à¤¸à¥€à¤§à¥‡ à¤¸à¤‚à¤ªà¤°à¥à¤• à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚: ${contactInfo}`,
            eng: `I understand. You can bridge directly to our Elite Administration at: ${contactInfo}`
        };
        return res[lang];
    }

    // ðŸ—¨ï¸ YES/NO CONFIRMATIONS
    if (/^(yes|no|ha|na|chalse|nathi)/i.test(lowerText)) {
        return `Understood. I've noted your preference for <strong>${brandName}</strong>. Is there anything else I can assist with?`;
    }

    if (/(delete|clear|remove|nikal|bhusi)/i.test(lowerText)) {
        return `I cannot delete your history for audit reasons, but the system <strong>automatically resets every 24 hours</strong>.`;
    }

    // ðŸ’° PRICING & COST
    if (/(price|cost|charge|fees|money|budget|package|plan|àª•àª¿àª‚àª®àª¤|àª­àª¾àªµ|àªªà«ˆàª¸àª¾|àª–àª°à«àªš|à¤ªà¥ˆà¤¸à¥‡|à¤«à¥€à¤¸|à¤•à¥€à¤®à¤¤)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ’° <strong>Pricing:</strong> àª…àª®àª¾àª°à«€ àª¸àª°à«àªµàª¿àª¸ àª•àª¸à«àªŸàª®àª¾àª‡àªà«àª¡ àª›à«‡. <strong>${brandName}</strong> àª¨à«€ àªœàª°à«‚àª°àª¿àª¯àª¾àª¤ àª®à«àªœàª¬ àª¬à«‡àª¸à«àªŸ àªªà«‡àª•à«‡àªœ àªœàª¾àª£àªµàª¾ àª®àª¾àªŸà«‡, àª•à«ƒàªªàª¾ àª•àª°à«€àª¨à«‡ <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">àª®à«€àªŸàª¿àª‚àª— àª¬à«àª• àª•àª°à«‹</a>.`,
            hin: `ðŸ’° <strong>Pricing:</strong> à¤¹à¤®à¤¾à¤°à¥€ à¤¸à¤°à¥à¤µà¤¿à¤¸ à¤•à¤¸à¥à¤Ÿà¤®à¤¾à¤‡à¤œà¥à¤¡ à¤¹à¥ˆà¥¤ <strong>${brandName}</strong> à¤•à¥€ à¤œà¤°à¥‚à¤°à¤¤ à¤•à¥‡ à¤…à¤¨à¥à¤¸à¤¾à¤° à¤¬à¥‡à¤¸à¥à¤Ÿ à¤ªà¥ˆà¤•à¥‡à¤œ à¤œà¤¾à¤¨à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤, à¤•à¥ƒà¤ªà¤¯à¤¾ <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">à¤®à¥€à¤Ÿà¤¿à¤‚à¤— à¤¬à¥à¤• à¤•à¤°à¥‡à¤‚</a>à¥¤`,
            eng: `ðŸ’° <strong>Investment & Pricing:</strong> We build custom solutions. To get an exact quote tailored to <strong>${brandName}</strong>'s requirements, please <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Schedule a Consultation</a>.`
        };
        return res[lang];
    }

    // â³ TIMEFRAME & DURATION
    if (/(time|days|duration|how long|fast|quick|àª•à«àª¯àª¾àª°à«‡|àª•à«‡àªŸàª²à«‹ àª¸àª®àª¯|àª¸àª®àª¯|à¤¸à¤®à¤¯|à¤¦à¤¿à¤¨)/i.test(lowerText)) {
        const res = {
            guj: `â³ <strong>Timeframe:</strong> àªªà«àª°à«‹àªœà«‡àª•à«àªŸàª¨à«€ àª¸àª¾àª‡àª àªªàª° àª†àª§àª¾àª° àª°àª¾àª–à«‡ àª›à«‡. àª…àª®à«‡ <strong>${brandName}</strong> àª®àª¾àªŸà«‡ àª¹àª‚àª®à«‡àª¶àª¾ àª«àª¾àª¸à«àªŸ àª…àª¨à«‡ àª•à«àªµà«‹àª²àª¿àªŸà«€ àª¡àª¿àª²àª¿àªµàª°à«€ àª†àªªà«€àª àª›à«€àª.`,
            hin: `â³ <strong>Timeframe:</strong> à¤ªà¥à¤°à¥‹à¤œà¥‡à¤•à¥à¤Ÿ à¤•à¥€ à¤¸à¤¾à¤‡à¤œ à¤ªà¤° à¤¨à¤¿à¤°à¥à¤­à¤° à¤•à¤°à¤¤à¤¾ à¤¹à¥ˆà¥¤ à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ à¤¹à¤®à¥‡à¤¶à¤¾ à¤«à¤¾à¤¸à¥à¤Ÿ à¤”à¤° à¤•à¥à¤µà¤¾à¤²à¤¿à¤Ÿà¥€ à¤¡à¤¿à¤²à¥€à¤µà¤°à¥€ à¤¦à¥‡à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `â³ <strong>Delivery Timeframe:</strong> Timelines depend on project complexity. However, we pride ourselves on rapid, high-quality execution for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // ðŸ† GUARANTEES & RESULTS
    if (/(guarantee|result|promise|sure|àª—à«‡àª°àª‚àªŸà«€|àªªàª°àª¿àª£àª¾àª®|à¤ªà¤°à¤¿à¤£à¤¾à¤®|à¤—à¤¾à¤°à¤‚à¤Ÿà¥€)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ† <strong>Results:</strong> àª…àª®à«‡ àª¡à«‡àªŸàª¾-àª¡à«àª°àª¿àªµàª¨ àª…àªªà«àª°à«‹àªš àªµàª¾àªªàª°à«€àª àª›à«€àª. <strong>${brandName}</strong> àª®àª¾àªŸà«‡ ROI àª…àª¨à«‡ àª—à«àª°à«‹àª¥àª¨à«€ àªªà«‚àª°à«€ àª–àª¾àª¤àª°à«€ àª†àªªà«€àª àª›à«€àª.`,
            hin: `ðŸ† <strong>Results:</strong> à¤¹à¤® à¤¡à¥‡à¤Ÿà¤¾-à¤¡à¥à¤°à¤¿à¤µà¤¨ à¤…à¤ªà¥à¤°à¥‹à¤š à¤•à¤¾ à¤‡à¤¸à¥à¤¤à¥‡à¤®à¤¾à¤² à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤ <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ ROI à¤”à¤° à¤—à¥à¤°à¥‹à¤¥ à¤•à¥€ à¤ªà¥‚à¤°à¥€ à¤—à¤¾à¤°à¤‚à¤Ÿà¥€ à¤¦à¥‡à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸ† <strong>Guaranteed Results:</strong> We are entirely data-driven. We engineer measurable growth and positive ROI for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // ðŸ’¼ PORTFOLIO & PAST WORK
    if (/(portfolio|past work|example|sample|demo|àª•àª¾àª® àª¬àª¤àª¾àªµà«‹|àªªà«‹àª°à«àªŸàª«à«‹àª²àª¿àª¯à«‹|à¤ªà¥‹à¤°à¥à¤Ÿà¤«à¥‹à¤²à¤¿à¤¯à¥‹|à¤¡à¥‡à¤®à¥‹)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ’¼ <strong>Portfolio:</strong> àª…àª®à«‡ àª˜àª£àª¾ àªªà«àª°à«€àª®àª¿àª¯àª® àª•à«àª²àª¾àª¯àª¨à«àªŸà«àª¸ àª¸àª¾àª¥à«‡ àª•àª¾àª® àª•àª°à«àª¯à«àª‚ àª›à«‡. <strong>${brandName}</strong> àª®àª¾àªŸà«‡ àª…àª®àª¾àª°àª¾ àªªàª¾àª¸à«àªŸ àªµàª°à«àª•àª¨à«àª‚ àª¡à«‡àª®à«‹ àªœà«‹àªµàª¾ àª®àª¾àªŸà«‡ àª®à«€àªŸàª¿àª‚àª— àª¬à«àª• àª•àª°à«‹.`,
            hin: `ðŸ’¼ <strong>Portfolio:</strong> à¤¹à¤®à¤¨à¥‡ à¤•à¤ˆ à¤ªà¥à¤°à¥€à¤®à¤¿à¤¯à¤® à¤•à¥à¤²à¤¾à¤‡à¤‚à¤Ÿà¥à¤¸ à¤•à¥‡ à¤¸à¤¾à¤¥ à¤•à¤¾à¤® à¤•à¤¿à¤¯à¤¾ à¤¹à¥ˆà¥¤ <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ à¤¹à¤®à¤¾à¤°à¥‡ à¤ªà¤¾à¤¸à¥à¤Ÿ à¤µà¤°à¥à¤• à¤•à¤¾ à¤¡à¥‡à¤®à¥‹ à¤¦à¥‡à¤–à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤®à¥€à¤Ÿà¤¿à¤‚à¤— à¤¬à¥à¤• à¤•à¤°à¥‡à¤‚à¥¤`,
            eng: `ðŸ’¼ <strong>Elite Portfolio:</strong> We've scaled multiple premium brands. To see case studies relevant to <strong>${brandName}</strong>, let's connect on a quick call.`
        };
        return res[lang];
    }

    // ðŸ’» TECH STACK
    if (/(react|node|php|python|tech|stack|technology|àªŸà«‡àª•à«àª¨à«‹àª²à«‹àªœà«€|à¤¤à¤•à¤¨à¥€à¤•|software|language)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ’» <strong>Technology:</strong> àª…àª®à«‡ <strong>${brandName}</strong> àª®àª¾àªŸà«‡ React, Node.js, Python, àª…àª¨à«‡ Odoo àªœà«‡àªµà«€ àª²à«‡àªŸà«‡àª¸à«àªŸ àª…àª¨à«‡ àªªàª¾àªµàª°àª«à«àª² àªŸà«‡àª•à«àª¨à«‹àª²à«‹àªœà«€ àªµàª¾àªªàª°à«€àª àª›à«€àª.`,
            hin: `ðŸ’» <strong>Technology:</strong> à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ React, Node.js, Python, à¤”à¤° Odoo à¤œà¥ˆà¤¸à¥€ à¤²à¥‡à¤Ÿà¥‡à¤¸à¥à¤Ÿ à¤”à¤° à¤ªà¤¾à¤µà¤°à¤«à¥à¤² à¤¤à¤•à¤¨à¥€à¤• à¤•à¤¾ à¤‰à¤ªà¤¯à¥‹à¤— à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸ’» <strong>Advanced Tech Stack:</strong> For <strong>${brandName}</strong>, we leverage modern, scalable stacks including React, Node.js, Python, and Odoo ERP.`
        };
        return res[lang];
    }

    // ðŸ› ï¸ SUPPORT & MAINTENANCE
    if (/(support|maintenance|after|help|àª¸àªªà«‹àª°à«àªŸ|àª¸àª¹àª¾àª¯|à¤¸à¤ªà¥‹à¤°à¥à¤Ÿ|à¤®à¤¦à¤¦)/i.test(lowerText)) {
        const res = {
            guj: `ðŸ› ï¸ <strong>Support:</strong> àª¡àª¿àª²àª¿àªµàª°à«€ àªªàª›à«€ àªªàª£ àª…àª®à«‡ <strong>${brandName}</strong> àª¨à«‡ 24/7 àªªà«àª°à«€àª®àª¿àª¯àª® àªŸà«‡àª•àª¨àª¿àª•àª² àª¸àªªà«‹àª°à«àªŸ àª†àªªà«€àª àª›à«€àª.`,
            hin: `ðŸ› ï¸ <strong>Support:</strong> à¤¡à¤¿à¤²à¥€à¤µà¤°à¥€ à¤•à¥‡ à¤¬à¤¾à¤¦ à¤­à¥€ à¤¹à¤® <strong>${brandName}</strong> à¤•à¥‹ 24/7 à¤ªà¥à¤°à¥€à¤®à¤¿à¤¯à¤® à¤Ÿà¥‡à¤•à¥à¤¨à¤¿à¤•à¤² à¤¸à¤ªà¥‹à¤°à¥à¤Ÿ à¤ªà¥à¤°à¤¦à¤¾à¤¨ à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`,
            eng: `ðŸ› ï¸ <strong>Elite Support:</strong> Post-deployment, we provide 24/7 premium technical support and maintenance to ensure <strong>${brandName}</strong> runs flawlessly.`
        };
        return res[lang];
    }

    // ðŸ™ APPRECIATION / SMALL TALK
    if (/(thanks|thank you|good|awesome|great|nice|perfect|àª†àª­àª¾àª°|àª¸àª°àª¸|àª§àª¨à«àª¯àªµàª¾àª¦|à¤§à¤¨à¥à¤¯à¤µà¤¾à¤¦|à¤…à¤šà¥à¤›à¤¾|à¤¬à¤¹à¥à¤¤ à¤¬à¥à¤¿à¤¯à¤¾)/i.test(lowerText)) {
        const res = {
            guj: `àª¤àª®àª¾àª°à«‹ àª†àª­àª¾àª°! <strong>${brandName}</strong> àª¨à«‡ àªŸà«‹àªš àªªàª° àª²àªˆ àªœàªµàª¾ àª®àª¾àªŸà«‡ àª…àª®à«‡ àª¹àª‚àª®à«‡àª¶àª¾ àª¤à«ˆàª¯àª¾àª° àª›à«€àª. àª¬à«€àªœà«àª‚ àª•à«‹àªˆ àª•àª¾àª® àª¹à«‹àª¯ àª¤à«‹ àªœàª£àª¾àªµàªœà«‹.`,
            hin: `à¤†à¤ªà¤•à¤¾ à¤§à¤¨à¥à¤¯à¤µà¤¾à¤¦! <strong>${brandName}</strong> à¤•à¥‹ à¤Ÿà¥‰à¤ª à¤ªà¤° à¤²à¥‡ à¤œà¤¾à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤ à¤¹à¤® à¤¹à¤®à¥‡à¤¶à¤¾ à¤¤à¥ˆà¤¯à¤¾à¤° à¤¹à¥ˆà¤‚à¥¤ à¤”à¤° à¤•à¥‹à¤ˆ à¤®à¤¦à¤¦ à¤šà¤¾à¤¹à¤¿à¤ à¤¤à¥‹ à¤¬à¤¤à¤¾à¤à¤à¥¤`,
            eng: `You're very welcome! We are committed to taking <strong>${brandName}</strong> to the top. Let me know if you need anything else.`
        };
        return res[lang];
    }

    // ðŸ§  FALLBACK
    const fallback = {
        guj: `àª®à«‡àª‚ àª¤àª®àª¾àª°à«€ àª† àªµàª¾àª¤ "${text}" àªàª¡àª®àª¿àª¨ àª®àª¾àªŸà«‡ àª¨à«‹àª‚àª§à«€ àª²à«€àª§à«€ àª›à«‡. àª¤à«‡àª“ <strong>${brandName}</strong> àª®àª¾àªŸà«‡ àª¤àª®àª¾àª°à«‹ àª¸àª‚àªªàª°à«àª• àª•àª°àª¶à«‡.`,
        hin: `à¤®à¥ˆà¤‚à¤¨à¥‡ à¤†à¤ªà¤•à¥€ à¤¯à¤¹ à¤¬à¤¾à¤¤ "${text}" à¤à¤¡à¤®à¤¿à¤¨ à¤•à¥‡ à¤²à¤¿à¤ à¤¨à¥‹à¤Ÿ à¤•à¤° à¤²à¥€ à¤¹à¥ˆà¥¤ à¤µà¥‡ <strong>${brandName}</strong> à¤•à¥‡ à¤²à¤¿à¤ à¤†à¤ªà¤¸à¥‡ à¤¸à¤‚à¤ªà¤°à¥à¤• à¤•à¤°à¥‡à¤‚à¤—à¥‡à¥¤`,
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

    brands._lastUpdated = Date.now();
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
        console.log("ðŸ§¹ Background Cleanup: Removing expired messages...");
        if (currentBrand.chat.length === 0) {
            currentBrand.chat.push({ sender: 'bot', text: "Welcome to Elite Support. I'm your AI Assistant. How can I help you today?", time: now });
        }
        renderChatMessages();
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
        syncToSheetDB();
    
    }
}, 60000); // Check every 60 seconds



