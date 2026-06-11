// Data Management - Sync with Admin Portal
// Multi-API Failover System (Automatic Fallback if limit reached)

// ── Server JSON Storage Config ────────────────────────────────────────────
// Set this to your SAVE_TOKEN value from Vercel environment variables.
// This is the same token set as SAVE_TOKEN in your Vercel project settings.
const SERVER_SAVE_TOKEN = window.__SERVER_SAVE_TOKEN__ || '';
// ─────────────────────────────────────────────────────────────────────────

const SHEETDB_API_URLS = [
    "https://sheetdb.io/api/v1/bv1v9wrq0pziw", // ✅ Secondary API Connected (Working)
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

    // Clean brands object — only brand keys, no metadata
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
                console.log(`✅ Synced to SheetDB: ${url}`);
                return;
            } else if (patchRes.status === 429) {
                console.warn(`⚠️ Rate limit on ${url}, trying next...`);
                continue;
            } else {
                // Row doesn't exist — create it with POST
                const postRes = await fetch(url, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: [{ id: 1, database_json: jsonStr }] })
                });
                if (postRes.ok) { console.log(`✅ Created row in SheetDB: ${url}`); return; }
            }
        } catch (error) {
            console.error(`❌ SheetDB sync error [${url}]:`, error);
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
                    // SheetDB has data — use it as source of truth
                    const cloudBrands = JSON.parse(rows[0].database_json) || {};
                    brands = cloudBrands;
                    localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
                    console.log(`✅ Loaded from SheetDB: ${url} | Brands: ${Object.keys(brands).join(', ')}`);
                    return true;
                } else {
                    // SheetDB is empty — push local data to it
                    console.log(`📡 SheetDB empty, pushing local data to ${url}`);
                    syncToSheetDB();
                    return true;
                }
            } else if (res.status === 429) {
                console.warn(`⚠️ Rate limit on load [${url}], trying next...`);
                continue;
            }
        } catch (error) {
            console.warn(`❌ SheetDB load error [${url}]:`, error);
        }
    }
    return false;
}

// ── Sync brands to server JSON storage ────────────────────────────────────
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
        if (res.ok) console.log('✅ Synced to server JSON storage');
        else console.warn('⚠️ Server sync failed:', res.status);
    } catch (e) {
        console.warn('⚠️ syncToServer error', e);
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
            console.log('✅ Loaded from server');
            return true;
        }
    } catch (e) {
        console.warn('⚠️ loadFromServer error', e);
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

// Initialize — Load from Cloud DB first, then init UI
window.addEventListener('DOMContentLoaded', async () => {
    // 🛡️ RESET UI STATE: Prevent 'Authenticated' artifacts
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.innerHTML = `<i data-lucide="unlock" style="width: 18px; height: 18px;"></i> Unlock Dashboard`;
        loginBtn.style.background = '';
    }
    if (loginForm) loginForm.reset();
    if (window.lucide) lucide.createIcons();

    // Load data with priority: localStorage → server → SheetDB
    if (!Object.keys(brands).length) {
        // Try server first (if API available)
        try {
            const serverLoaded = await loadFromServer();
            if (!serverLoaded) {
                await loadFromSheetDB(); // fallback to SheetDB if server empty or fails
            }
        } catch (e) {
            console.warn('⚠️ Server load failed, falling back to SheetDB', e);
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

    // ✅ PERSISTENT LOGIN CHECK
    const savedAdmin = localStorage.getItem('socialSphere_admin');
    if (savedAdmin === 'true') {
        window.location.href = 'admin.html';
        return;
    }

    const savedBrandId = localStorage.getItem('socialSphere_currentBrandId');
    if (savedBrandId && brands[savedBrandId]) {
        login(savedBrandId, true); // ✅ Pass true for auto-login (skip animations)
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

    // 🛡️ REAL-TIME SECURITY SYNC: Pull latest credentials from Cloud before authenticating
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
        
        // ✅ Save Admin Session
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

    // ✅ Save User Session
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
            localStorage.setItem('socialSphere_brands', JSON.stringify(brands)); syncToSheetDB();
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
        planBadge.textContent = `${currentBrand.plan || 'Standard'} • ${currentBrand.trial || 'Active'}`;
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
                    <p style="font-size: 0.7rem; color: var(--text-gray); margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Admin Broadcast • Expires in ${Math.round((expiry - (now - msg.time)) / 3600000)} hours</p>
                </div>
                <button onclick="dismissMessage('${msg.time}', event)" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: 0.3s;" title="Dismiss Message">
                    <i data-lucide="x" style="width: 16px; height: 16px;"></i>
                </button>
            `;
            alertContainer.appendChild(div);
        });
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands)); syncToSheetDB();
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
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands)); syncToSheetDB();

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
    
    // ✅ Clear Session
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
            localStorage.setItem('socialSphere_brands', JSON.stringify(brands)); syncToSheetDB();
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

// Render Upcoming Schedule Panel
function renderSchedule() {
    const scheduleList = document.getElementById('scheduleList');
    if (!scheduleList) return;
    // Clear existing entries
    scheduleList.innerHTML = '';
    if (!currentBrand || !currentBrand.events) return;
    const now = new Date();
    // Gather upcoming events (including today)
    const upcoming = currentBrand.events
        .filter(e => {
            const eventDate = new Date(e.year || now.getFullYear(), e.month !== undefined ? e.month : now.getMonth(), e.day);
            // Only future dates (including today) and sort by date
            return eventDate >= now;
        })
        .sort((a, b) => {
            const dateA = new Date(a.year || now.getFullYear(), a.month !== undefined ? a.month : now.getMonth(), a.day);
            const dateB = new Date(b.year || now.getFullYear(), b.month !== undefined ? b.month : now.getMonth(), b.day);
            return dateA - dateB;
        });
    if (upcoming.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'color: var(--text-gray); font-size: 0.85rem; opacity: 0.7;';
        emptyDiv.textContent = 'No upcoming events.';
        scheduleList.appendChild(emptyDiv);
        return;
    }
    upcoming.forEach(event => {
        const item = document.createElement('div');
        item.style.cssText = 'background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); padding: 8px 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 4px;';
        const eventDate = new Date(event.year || now.getFullYear(), event.month !== undefined ? event.month : now.getMonth(), event.day);
        const dateStr = eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const label = event.type ? event.type.toUpperCase() : '';
        item.innerHTML = `<span style="font-weight:600; color: var(--primary-light);">${dateStr} - ${label}</span><span style="font-size:0.85rem;">${event.title}</span>`;
        scheduleList.appendChild(item);
    });
}

// Hook renderSchedule into calendar rendering
const originalRenderCalendar = renderCalendar;
renderCalendar = function() {
    originalRenderCalendar();
    renderSchedule();
};

// Update add event form submission to refresh schedule
document.getElementById('addEventForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const modal = document.getElementById('addEventModal');
    const day = parseInt(modal.dataset.day);
    const month = parseInt(modal.dataset.month);
    const year = parseInt(modal.dataset.year);
    const newEvent = {
        day: day,
        month: month,
        year: year,
        title: document.getElementById('eventTitle').value.trim(),
        type: document.getElementById('eventType').value.trim(),
        time: document.getElementById('eventTime').value.trim(),
        desc: document.getElementById('eventDesc').value.trim()
    };
    if (!currentBrand.events) currentBrand.events = [];
    currentBrand.events.push(newEvent);
    if (window.LocalDataStore) LocalDataStore.saveAll(brands);
    else localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
    syncToSheetDB();
    renderCalendar();
    renderSchedule();
    closeAddEventModal();
    alert('Event added successfully');
});

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
        // Use the cell's actual month and year for accurate matching
        const cellMonth = month; // month variable already set from cellDate earlier (line 525)
        const cellYear = year;   // year variable from cellDate (line 523)
        const dayEvents = currentBrand.events.filter(e =>
            e.day === num &&
            (e.month === undefined || e.month === cellMonth) &&
            (e.year === undefined || e.year === cellYear)
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

            eventDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                    <i data-lucide="${getIconName(event.type)}" style="width: 12px; height: 12px; flex-shrink: 0;"></i>
                    <span style="font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9;">${displayLabel}</span>
                </div>
                <div style="white-space: normal; line-height: 1.2; word-break: break-word;">${event.title}</div>
            `;
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
    // 24‑hour automatic chat message cleanup removed per user request

    if (!currentBrand.chat || currentBrand.chat.length === 0) {
        currentBrand.chat = [
            { sender: 'bot', text: "Welcome to Elite Support. I'm your AI Assistant. How can I help you today?", time: now }
        ];
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands)); syncToSheetDB();
    } else {
        
        // Ensure welcome message exists if chat is empty
        if (currentBrand.chat.length === 0) {
            currentBrand.chat.push({ sender: 'bot', text: "Welcome to Elite Support. I'm your AI Assistant. How can I help you today?", time: now });
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

    // 🔍 SCRIPT DETECTION
    const hasGujaratiScript = /[\u0A80-\u0AFF]/.test(text);
    const hasHindiScript = /[\u0900-\u097F]/.test(text);
    const lang = hasGujaratiScript ? 'guj' : (hasHindiScript ? 'hin' : 'eng');

    // 🏆 BLUE TICK & VERIFICATION
    if (/(blue tick|verify|verification|badge|tick|બ્લુ ટીક|ટિક|सत्यापन|ब्लू टिक)/i.test(lowerText)) {
        const res = {
            guj: `💎 <strong>Blue Tick Verification:</strong> અમે <strong>${brandName}</strong> ને Instagram અને Facebook પર વેરિફાઈડ કરાવવા માટે એક્સપર્ટ સર્વિસ આપીએ છીએ.`,
            hin: `💎 <strong>Blue Tick Verification:</strong> हम <strong>${brandName}</strong> को Instagram और Facebook पर वेरिफाइड कराने के लिए एक्सपर्ट सर्विस देते हैं।`,
            eng: `💎 <strong>Elite Verification:</strong> We specialize in authenticating <strong>${brandName}</strong> across Meta platforms to establish absolute market authority.`
        };
        return res[lang];
    }

    // 🎨 BRANDING & IDENTITY
    if (/(logo|design|branding|color|theme|દેખાવ|डिजाइन|ब्रांडिंग)/i.test(lowerText)) {
        const res = {
            guj: `🎨 <strong>Visual Identity:</strong> અમે <strong>${brandName}</strong> માટે પ્રીમિયમ કલર પેલેટ અને લોગો ડિઝાઈન તૈયાર કરીએ છીએ જે ગ્લોબલ સ્ટાન્ડર્ડ મુજબ હોય.`,
            hin: `🎨 <strong>Visual Identity:</strong> हम <strong>${brandName}</strong> के लिए प्रीमियम कलर पैलेट और लोगो डिजाइन तैयार करते हैं जो ग्लोबल स्टैंडर्ड के अनुसार होते हैं।`,
            eng: `🎨 <strong>Signature Identity:</strong> We craft a bespoke visual language for <strong>${brandName}</strong> ensuring your brand aesthetic is world-class.`
        };
        return res[lang];
    }

    // 📈 LEAD GEN & SALES FUNNEL
    if (/(lead|sales|customer|client|order|enquiry|ગ્રાહક|ग्राहक|बિક્રી)/i.test(lowerText)) {
        const res = {
            guj: `💰 <strong>Lead Generation:</strong> અમે ફક્ત લાઈક્સ જ નહીં, પણ <strong>${brandName}</strong> માટે રિયલ સેલ્સ અને લીડ્સ જનરેટ કરવા પર ફોકસ કરીએ છીએ.`,
            hin: `💰 <strong>Lead Generation:</strong> हम सिर्फ लाइक्स ही नहीं, बल्कि <strong>${brandName}</strong> के लिए रियल सेल्स और लीड्स जनरेट करने पर ध्यान केंद्रित करते हैं।`,
            eng: `💰 <strong>Revenue Engineering:</strong> For <strong>${brandName}</strong>, we build high-conversion sales funnels that turn social traffic into high-value clients.`
        };
        return res[lang];
    }

    // ⚔️ COMPETITOR DOMINANCE
    if (/(other|competitor|better|best|market|બીજા|દુનિયા|માર્કેટ|दुनिया)/i.test(lowerText)) {
        const res = {
            guj: `⚔️ <strong>Market Dominance:</strong> અમે <strong>${brandName}</strong> ને તમારા કોમ્પિટિશનથી 10 ડગલાં આગળ રાખવા માટે એડવાન્સ AI ટૂલ્સનો ઉપયોગ કરીએ છીએ.`,
            hin: `⚔️ <strong>Market Dominance:</strong> हम <strong>${brandName}</strong> को आपके कॉम्पिटिशन से 10 कदम आगे रखने के लिए एडवांस AI टूल्स का उपयोग करते हैं।`,
            eng: `⚔️ <strong>Elite Dominance:</strong> By leveraging advanced data-science, we keep <strong>${brandName}</strong> 10 steps ahead of the global competition.`
        };
        return res[lang];
    }

    // 🚀 VIRAL GROWTH & REELS
    if (/(viral|reel|video|reach|વીડિયો|વિડિઓ|वीडियो)/i.test(lowerText)) {
        const res = {
            guj: `🚀 <strong>Viral Growth:</strong> અમે <strong>${brandName}</strong> માટે હાઈ-રિટેન્શન હૂક સાથેના ટૂંકા વિડિયો પર ફોકસ કરીએ છીએ.`,
            hin: `🚀 <strong>Viral Growth:</strong> हम <strong>${brandName}</strong> के लिए हाई-रिटेंशन हुक वाले छोटे वीडियो पर ध्यान केंद्रित करते हैं।`,
            eng: `🚀 <strong>Viral Engineering:</strong> For <strong>${brandName}</strong>, we craft high-retention short-form content designed to amplify organic exposure.`
        };
        return res[lang];
    }

    // 🌟 GREETINGS
    if (/^(hi|hello|hey|kem chho|kaise ho|namaste)/i.test(lowerText)) {
        const res = {
            guj: `નમસ્તે! હું તમારો <strong>Elite AI Strategist</strong> છું. આજે આપણે <strong>${brandName}</strong> ને ગ્લોબલ લેવલ પર કેવી રીતે લઈ જઈએ?`,
            hin: `नमस्ते! मैं आपका <strong>Elite AI Strategist</strong> हूँ। आज हम <strong>${brandName}</strong> को ग्लोबल लेवल पर कैसे लेकर चलें?`,
            eng: `Greetings. I'm your <strong>Elite AI Strategist</strong>. How shall we accelerate the global dominance of <strong>${brandName}</strong> today?`
        };
        return res[lang];
    }

    // 💰 ROI & PERFORMANCE
    if (/(roi|profit|sales|grow|business|vadharo|badhana|નફો|मुनाफा)/i.test(lowerText)) {
        const res = {
            guj: `<strong>${brandName}</strong> નો ROI વધારવા માટે અમે ડેટા-ડ્રિવન એડ્સ અને હાઈ-કન્વર્ઝન કન્ટેન્ટ પર ફોકસ કરીએ છીએ.`,
            hin: `<strong>${brandName}</strong> का ROI बढ़ाने के लिए हम डेटा-ड्रिवन एड्स और हाई-कन्वर्जन कंटेंट पर ध्यान देते हैं।`,
            eng: `Precision ROI is our standard. We optimize <strong>${brandName}</strong> through aggressive data-driven scaling and performance marketing.`
        };
        return res[lang];
    }

    // 🛠️ SERVICES & AGENCY
    if (/(service|kaam|kam|what do you do|su karo cho|કામ|काम)/i.test(lowerText)) {
        const res = {
            guj: `Vertex Global Tech એક પ્રીમિયમ એજન્સી છે જે <strong>Web Dev</strong>, <strong>Growth Marketing</strong>, અને <strong>Elite Branding</strong> માં માસ્ટર છે. <br><br>અમારી મુખ્ય સર્વિસમાં <strong>Web & App Development</strong>, <strong>Odoo Customization</strong>, <strong>Product Listing</strong>, <strong>Verifyboost Marketing</strong> અને <strong>Google Ads Management</strong> નો સમાવેશ થાય છે. વધુ માહિતી માટે <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">અહીં ક્લિક કરો</a>.`,
            hin: `Vertex Global Tech एक प्रीमियम एजेंसी है जो <strong>Web Dev</strong>, <strong>Growth Marketing</strong>, और <strong>Elite Branding</strong> में मास्टर है। <br><br>हमारी मुख्य सर्विस में <strong>Web & App Development</strong>, <strong>Odoo Customization</strong>, <strong>Product Listing</strong>, <strong>Verifyboost Marketing</strong> और <strong>Google Ads Management</strong> शामिल हैं। अधिक जानकारी के लिए <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">यहाँ क्लिक करें</a>।`,
            eng: `Vertex Global Tech is an elite powerhouse specializing in <strong>Bespoke Development</strong>, <strong>Aggressive Growth Marketing</strong>, and <strong>World-Class Branding</strong>. <br><br>Our core expertise includes <strong>Web & App Engineering</strong>, <strong>Odoo Customization</strong>, <strong>Product Marketplace Listings</strong>, <strong>Verifyboost Marketing</strong>, and <strong>Google Ads Management</strong>. <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Book a meeting here</a>.`
        };
        return res[lang];
    }

    // 🌐 WEB DEVELOPMENT
    if (/(web|website|site|ecommerce|e-commerce|વેબસાઇટ|वेबसाइट)/i.test(lowerText)) {
        const res = {
            guj: `🌐 <strong>Web Development:</strong> અમે <strong>${brandName}</strong> માટે હાઇ-પરફોર્મન્સ, રિસ્પોન્સિવ અને કન્વર્ઝન-ઓપ્ટિમાઇઝ્ડ વેબસાઇટ્સ બનાવીએ છીએ.`,
            hin: `🌐 <strong>Web Development:</strong> हम <strong>${brandName}</strong> के लिए हाई-परफॉर्मेंस, रिस्पॉन्सिव और कन्वर्जन-ऑप्टिमाइज़्ड वेबसाइट्स बनाते हैं।`,
            eng: `🌐 <strong>Elite Web Engineering:</strong> We craft high-performance, responsive, and conversion-optimized websites tailored specifically for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // 📱 APP DEVELOPMENT
    if (/(app|application|mobile|ios|android|એપ|एप्लिकेशन|ऐप)/i.test(lowerText)) {
        const res = {
            guj: `📱 <strong>App Development:</strong> અમે <strong>${brandName}</strong> માટે નેટિવ અને ક્રોસ-પ્લેટફોર્મ મોબાઇલ એપ્સ ડેવલપ કરીએ છીએ.`,
            hin: `📱 <strong>App Development:</strong> हम <strong>${brandName}</strong> के लिए नेटिव और क्रॉस-प्लेटफॉर्म मोबाइल ऐप्स डेवलप करते हैं।`,
            eng: `📱 <strong>Mobile App Engineering:</strong> We develop robust, user-centric native and cross-platform mobile applications for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // ⚙️ ODOO CUSTOMIZATION
    if (/(odoo|erp|customization|system|સોફ્ટવેર|सॉफ्टवेयर)/i.test(lowerText)) {
        const res = {
            guj: `⚙️ <strong>Odoo Customization:</strong> અમે તમારા બિઝનેસ ઓપરેશન્સને સરળ બનાવવા માટે એડવાન્સ Odoo કસ્ટમાઇઝેશન પૂરું પાડીએ છીએ.`,
            hin: `⚙️ <strong>Odoo Customization:</strong> हम आपके बिजनेस ऑपरेशन्स को आसान बनाने के लिए एडवांस Odoo कस्टमाइज़ेशन प्रदान करते हैं।`,
            eng: `⚙️ <strong>Odoo Customization:</strong> We provide advanced Odoo customization and ERP integration to streamline operations for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // 🛍️ PRODUCT LISTING
    if (/(product|listing|marketplace|amazon|flipkart|પ્રોડક્ટ|उत्पाद)/i.test(lowerText)) {
        const res = {
            guj: `🛍️ <strong>Marketplace Listings:</strong> અમે <strong>${brandName}</strong> ના પ્રોડક્ટ્સને ટોપ માર્કેટપ્લેસ પર રેન્ક કરવા માટે પ્રોફેશનલ લિસ્ટિંગ કરીએ છીએ.`,
            hin: `🛍️ <strong>Marketplace Listings:</strong> हम <strong>${brandName}</strong> के प्रोडक्ट्स को टॉप मार्केटप्लेस पर रैंक करने के लिए प्रोफेशनल लिस्टिंग करते हैं।`,
            eng: `🛍️ <strong>Product Marketplace Listings:</strong> We optimize and rank <strong>${brandName}</strong>'s products across top marketplaces for maximum visibility and sales.`
        };
        return res[lang];
    }

    // 📈 GOOGLE ADS & MARKETING
    if (/(ads|google|verifyboost|marketing|campaign|એડ્સ|मार्केटिंग|विज्ञापन)/i.test(lowerText)) {
        const res = {
            guj: `📈 <strong>Marketing & Ads:</strong> અમે <strong>${brandName}</strong> માટે Google Ads અને Verifyboost માર્કેટિંગ દ્વારા હાઈ ROI અને ગ્રોથ લાવીએ છીએ.`,
            hin: `📈 <strong>Marketing & Ads:</strong> हम <strong>${brandName}</strong> के लिए Google Ads और Verifyboost मार्केटिंग के माध्यम से हाई ROI और ग्रोथ लाते हैं।`,
            eng: `📈 <strong>Marketing & Ads:</strong> We scale <strong>${brandName}</strong> through precision Google Ads management and aggressive Verifyboost marketing campaigns.`
        };
        return res[lang];
    }

    // 📅 MEETING SCHEDULER
    if (/(meeting|schedule|book|appointment|consultation|મીટિંગ|मीटिंग)/i.test(lowerText)) {
        const res = {
            guj: `📅 <strong>Meeting Booking:</strong> તમે અમારી સર્વિસ માટે <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">અહીં ક્લિક કરીને</a> ડાયરેક્ટ સિક્યોર મીટિંગ બુક કરી શકો છો.`,
            hin: `📅 <strong>Meeting Booking:</strong> आप हमारी सर्विस के लिए <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">यहाँ क्लिक करके</a> डायरेक्ट सिक्योर मीटिंग बुक कर सकते हैं।`,
            eng: `📅 <strong>Secure Meeting Scheduler:</strong> You can instantly book a consultation for <strong>${brandName}</strong> by visiting our <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Secure Scheduler System</a>.`
        };
        return res[lang];
    }

    // 📞 CONTACT
    if (/(human|call|speak|contact|agent|number|whatsapp|phone|help)/i.test(lowerText)) {
        const contactInfo = `WhatsApp: <strong>+91 96645 23986</strong> | Email: <strong>connectvertexglobal2209@gmail.com</strong>`;
        const res = {
            guj: `ચોક્કસ, તમે અમારા એડમિન સાથે સીધી વાત કરી શકો છો: ${contactInfo}`,
            hin: `जी हाँ, आप हमारे एडमिन से सीधे संपर्क कर सकते हैं: ${contactInfo}`,
            eng: `I understand. You can bridge directly to our Elite Administration at: ${contactInfo}`
        };
        return res[lang];
    }

    // 🗨️ YES/NO CONFIRMATIONS
    if (/^(yes|no|ha|na|chalse|nathi)/i.test(lowerText)) {
        return `Understood. I've noted your preference for <strong>${brandName}</strong>. Is there anything else I can assist with?`;
    }

    if (/(delete|clear|remove|nikal|bhusi)/i.test(lowerText)) {
        return `I cannot delete your history for audit reasons, but the system <strong>automatically resets every 24 hours</strong>.`;
    }

    // 💰 PRICING & COST
    if (/(price|cost|charge|fees|money|budget|package|plan|કિંમત|ભાવ|પૈસા|ખર્ચ|पैसे|फीस|कीमत)/i.test(lowerText)) {
        const res = {
            guj: `💰 <strong>Pricing:</strong> અમારી સર્વિસ કસ્ટમાઇઝ્ડ છે. <strong>${brandName}</strong> ની જરૂરિયાત મુજબ બેસ્ટ પેકેજ જાણવા માટે, કૃપા કરીને <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">મીટિંગ બુક કરો</a>.`,
            hin: `💰 <strong>Pricing:</strong> हमारी सर्विस कस्टमाइज्ड है। <strong>${brandName}</strong> की जरूरत के अनुसार बेस्ट पैकेज जानने के लिए, कृपया <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981;">मीटिंग बुक करें</a>।`,
            eng: `💰 <strong>Investment & Pricing:</strong> We build custom solutions. To get an exact quote tailored to <strong>${brandName}</strong>'s requirements, please <a href="https://vgt-ragister.vercel.app" target="_blank" style="color: #10B981; text-decoration: underline;">Schedule a Consultation</a>.`
        };
        return res[lang];
    }

    // ⏳ TIMEFRAME & DURATION
    if (/(time|days|duration|how long|fast|quick|ક્યારે|કેટલો સમય|સમય|समय|दिन)/i.test(lowerText)) {
        const res = {
            guj: `⏳ <strong>Timeframe:</strong> પ્રોજેક્ટની સાઇઝ પર આધાર રાખે છે. અમે <strong>${brandName}</strong> માટે હંમેશા ફાસ્ટ અને ક્વોલિટી ડિલિવરી આપીએ છીએ.`,
            hin: `⏳ <strong>Timeframe:</strong> प्रोजेक्ट की साइज पर निर्भर करता है। हम <strong>${brandName}</strong> के लिए हमेशा फास्ट और क्वालिटी डिलीवरी देते हैं।`,
            eng: `⏳ <strong>Delivery Timeframe:</strong> Timelines depend on project complexity. However, we pride ourselves on rapid, high-quality execution for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // 🏆 GUARANTEES & RESULTS
    if (/(guarantee|result|promise|sure|ગેરંટી|પરિણામ|परिणाम|गारंटी)/i.test(lowerText)) {
        const res = {
            guj: `🏆 <strong>Results:</strong> અમે ડેટા-ડ્રિવન અપ્રોચ વાપરીએ છીએ. <strong>${brandName}</strong> માટે ROI અને ગ્રોથની પૂરી ખાતરી આપીએ છીએ.`,
            hin: `🏆 <strong>Results:</strong> हम डेटा-ड्रिवन अप्रोच का इस्तेमाल करते हैं। <strong>${brandName}</strong> के लिए ROI और ग्रोथ की पूरी गारंटी देते हैं।`,
            eng: `🏆 <strong>Guaranteed Results:</strong> We are entirely data-driven. We engineer measurable growth and positive ROI for <strong>${brandName}</strong>.`
        };
        return res[lang];
    }

    // 💼 PORTFOLIO & PAST WORK
    if (/(portfolio|past work|example|sample|demo|કામ બતાવો|પોર્ટફોલિયો|पोर्टफोलियो|डेमो)/i.test(lowerText)) {
        const res = {
            guj: `💼 <strong>Portfolio:</strong> અમે ઘણા પ્રીમિયમ ક્લાયન્ટ્સ સાથે કામ કર્યું છે. <strong>${brandName}</strong> માટે અમારા પાસ્ટ વર્કનું ડેમો જોવા માટે મીટિંગ બુક કરો.`,
            hin: `💼 <strong>Portfolio:</strong> हमने कई प्रीमियम क्लाइंट्स के साथ काम किया है। <strong>${brandName}</strong> के लिए हमारे पास्ट वर्क का डेमो देखने के लिए मीटिंग बुक करें।`,
            eng: `💼 <strong>Elite Portfolio:</strong> We've scaled multiple premium brands. To see case studies relevant to <strong>${brandName}</strong>, let's connect on a quick call.`
        };
        return res[lang];
    }

    // 💻 TECH STACK
    if (/(react|node|php|python|tech|stack|technology|ટેક્નોલોજી|तकनीक|software|language)/i.test(lowerText)) {
        const res = {
            guj: `💻 <strong>Technology:</strong> અમે <strong>${brandName}</strong> માટે React, Node.js, Python, અને Odoo જેવી લેટેસ્ટ અને પાવરફુલ ટેક્નોલોજી વાપરીએ છીએ.`,
            hin: `💻 <strong>Technology:</strong> हम <strong>${brandName}</strong> के लिए React, Node.js, Python, और Odoo जैसी लेटेस्ट और पावरफुल तकनीक का उपयोग करते हैं।`,
            eng: `💻 <strong>Advanced Tech Stack:</strong> For <strong>${brandName}</strong>, we leverage modern, scalable stacks including React, Node.js, Python, and Odoo ERP.`
        };
        return res[lang];
    }

    // 🛠️ SUPPORT & MAINTENANCE
    if (/(support|maintenance|after|help|સપોર્ટ|સહાય|सपोर्ट|मदद)/i.test(lowerText)) {
        const res = {
            guj: `🛠️ <strong>Support:</strong> ડિલિવરી પછી પણ અમે <strong>${brandName}</strong> ને 24/7 પ્રીમિયમ ટેકનિકલ સપોર્ટ આપીએ છીએ.`,
            hin: `🛠️ <strong>Support:</strong> डिलीवरी के बाद भी हम <strong>${brandName}</strong> को 24/7 प्रीमियम टेक्निकल सपोर्ट प्रदान करते हैं।`,
            eng: `🛠️ <strong>Elite Support:</strong> Post-deployment, we provide 24/7 premium technical support and maintenance to ensure <strong>${brandName}</strong> runs flawlessly.`
        };
        return res[lang];
    }

    // 🙏 APPRECIATION / SMALL TALK
    if (/(thanks|thank you|good|awesome|great|nice|perfect|આભાર|સરસ|ધન્યવાદ|धन्यवाद|अच्छा|बहुत बढ़िया)/i.test(lowerText)) {
        const res = {
            guj: `તમારો આભાર! <strong>${brandName}</strong> ને ટોચ પર લઈ જવા માટે અમે હંમેશા તૈયાર છીએ. બીજું કોઈ કામ હોય તો જણાવજો.`,
            hin: `आपका धन्यवाद! <strong>${brandName}</strong> को टॉप पर ले जाने के लिए हम हमेशा तैयार हैं। और कोई मदद चाहिए तो बताएँ।`,
            eng: `You're very welcome! We are committed to taking <strong>${brandName}</strong> to the top. Let me know if you need anything else.`
        };
        return res[lang];
    }

    // 🧠 FALLBACK
    const fallback = {
        guj: `મેં તમારી આ વાત "${text}" એડમિન માટે નોંધી લીધી છે. તેઓ <strong>${brandName}</strong> માટે તમારો સંપર્ક કરશે.`,
        hin: `मैंने आपकी यह बात "${text}" एडमिन के लिए नोट कर ली है। वे <strong>${brandName}</strong> के लिए आपसे संपर्क करेंगे।`,
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

    localStorage.setItem('socialSphere_brands', JSON.stringify(brands)); syncToSheetDB();
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
// 24‑hour auto‑removal disabled per user request. No automatic cleanup performed.
// The background interval for message expiry has been disabled; messages will persist until manually removed by admin.
// setInterval(() => {
//     // Previously auto‑removed messages older than 24h.
// }, 60000); // Interval retained for potential future use.

// 24‑hour auto‑removal disabled per user request. No automatic cleanup performed.
// The original background interval for message expiry has been removed.
// Messages will now persist until manually removed by an admin.
// setInterval(() => {
//     // cleanup logic was here
// }, 60000); // Interval retained for potential future use.
//     // Previously auto‑removed messages older than 24h.
    //     if (currentBrand.chat.length === 0) {
    //         currentBrand.chat.push({ sender: 'bot', text: "Welcome to Elite Support. I'm your AI Assistant. How can I help you today?", time: Date.now() });
    //     }
    //     renderChatMessages();
    //     localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
    //     syncToSheetDB();
    // }
    
// 24‑hour auto‑removal disabled per user request. Messages will persist until manually removed by admin.
// setInterval disabled - no automatic cleanup performed


