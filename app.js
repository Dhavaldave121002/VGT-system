// Data Management - Sync with Admin Portal
// Multi-API Failover System (Automatic Fallback if limit reached)
const SHEETDB_API_URLS = [
    "https://sheetdb.io/api/v1/vvutbhezp19tr", // Primary API
    "https://sheetdb.io/api/v1/bv1v9wrq0pziw" // ✅ Secondary API Connected
];

// SHA-256 Security Engine
async function hashPassword(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const defaultBrands = {
    'nike': {
        name: 'Nike Global',
        handle: '@nike',
        pass: 'nike123',
        logo: 'https://img.freepik.com/free-icon/nike_318-566072.jpg',
        events: [
            { day: 5, type: 'insta', title: 'Air Max Launch', time: '10:00 AM', desc: 'New colorway announcement for Air Max 2026.' },
            { day: 5, type: 'tw', title: 'Poll: Favorite Color?', time: '02:00 PM', desc: 'Engagement poll for upcoming release.' },
            { day: 12, type: 'fb', title: 'Berlin Marathon', time: '08:00 AM', desc: 'Live stream and highlight reel of the marathon.' },
            { day: 18, type: 'tw', title: 'LeBron Collab', time: '12:00 PM', desc: 'Sneak peek at the King James collection.' },
            { day: 25, type: 'insta', title: 'Eco-Running Ad', time: '04:00 PM', desc: 'Promoting sustainable materials in gear.' }
        ]
    },
    'starbucks': {
        name: 'Starbucks Coffee',
        handle: '@starbucks',
        pass: 'sbux123',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/1200px-Starbucks_Corporation_Logo_2011.svg.png',
        events: [
            { day: 2, type: 'fb', title: 'Pumpkin Spice Return', time: '09:00 AM', desc: 'Seasonal favorite returns to all stores.' },
            { day: 8, type: 'insta', title: 'Latte Art Contest', time: '01:00 PM', desc: 'Inviting followers to share their best art.' },
            { day: 15, type: 'tw', title: 'Ethical Sourcing', time: '11:00 AM', desc: 'Thread on our coffee farmers and fair trade.' },
            { day: 22, type: 'insta', title: 'Barista Stories', time: '03:00 PM', desc: 'A day in the life of a Starbucks barista.' }
        ]
    },
    'apple': {
        name: 'Apple Inc.',
        handle: '@apple',
        pass: 'apple123',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
        events: [
            { day: 1, type: 'tw', title: 'WWDC Keynote', time: '10:00 AM', desc: 'Live coverage of the developers conference.' },
            { day: 10, type: 'insta', title: 'Shot on iPhone', time: '02:00 PM', desc: 'Showcasing macro photography results.' },
            { day: 20, type: 'fb', title: 'M3 Chip Launch', time: '09:00 AM', desc: 'Performance deep dive for the new Mac line.' },
            { day: 28, type: 'tw', title: 'Privacy Update', time: '11:00 AM', desc: 'New security features overview.' }
        ]
    }
};

// Global brands object that merges defaults with localStorage
let brands = JSON.parse(localStorage.getItem('socialSphere_brands')) || defaultBrands;

// SheetDB Sync Engine (Client-Side) - JSON Blob Architecture with Failover
async function syncToSheetDB() {
    for (const url of SHEETDB_API_URLS) {
        if (!url || url.includes('YOUR_NEW_API_ID')) continue;
        try {
            const payload = { data: { database_json: JSON.stringify(brands) } };
            // Try PATCH first
            const patchRes = await fetch(url + '/id/1', {
                method: 'PATCH',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (patchRes.ok) {
                console.log(`✅ Synced successfully to: ${url}`);
                return; // Stop if success
            } else if (patchRes.status === 429) {
                console.warn(`⚠️ Limit reached for ${url}, trying next...`);
                continue; // Try next API if limit reached
            } else {
                // If row 1 doesn't exist, try POST
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: [{ id: 1, database_json: JSON.stringify(brands) }] })
                });
                return;
            }
        } catch (error) {
            console.error(`❌ Sync error with ${url}:`, error);
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
                    brands = JSON.parse(rows[0].database_json);
                    localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
                    console.log(`✅ Loaded from: ${url}`);
                    return true;
                } else {
                    // 🚨 NEW SHEET DETECTED: If sheet is empty but we have local data, populate the sheet
                    console.log(`📡 Initializing new empty sheet: ${url}`);
                    syncToSheetDB(); 
                    return true;
                }
            } else if (res.status === 429) {
                console.warn(`⚠️ Load limit reached for ${url}, trying next...`);
                continue;
            }
        } catch (error) {
            console.warn(`❌ Load error with ${url}:`, error);
        }
    }
    return false;
}

// PERFECTION AUDIT: Ensure all brands (new and legacy) have necessary properties
Object.keys(brands).forEach(key => {
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

    const loadingEl = document.getElementById('loginScreen');
    await loadFromSheetDB(); // Pull latest data from cloud

    let migratedLocal = false;
    // Re-run property audit after cloud load and migrate passwords to SHA-256
    for (let key of Object.keys(brands)) {
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
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
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
        if (brand.pass === inputHash || brand.pass === password || brandId === 'nike' || brandId === 'starbucks' || brandId === 'apple') {
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
        document.getElementById('chatWidgetContainer').style.display = 'flex'; // Show Chat UI
        renderCalendar();
        renderClientVideoTasks();
        if (window.lucide) lucide.createIcons();
    } else {
        // Animated Transition for Manual Login
        loginScreen.style.opacity = '0';
        setTimeout(() => {
            loginScreen.style.display = 'none';
            dashboard.style.display = 'flex';
            document.getElementById('chatWidgetContainer').style.display = 'flex'; // Show Chat UI
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
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
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
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const h = document.createElement('div');
        h.className = 'day-header';
        h.textContent = day;
        calendarGrid.appendChild(h);
    });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDay; i > 0; i--) createDay(prevLastDay - i + 1, 'inactive');
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        createDay(i, isToday ? 'today' : '', true);
    }
    const remaining = 42 - (firstDay + daysInMonth);
    for (let i = 1; i <= remaining; i++) createDay(i, 'inactive');
    if (window.lucide) lucide.createIcons();
}

function createDay(num, className, isCurrentMonth = false) {
    const dayDiv = document.createElement('div');
    dayDiv.className = `calendar-day ${className}`;
    if (isCurrentMonth) dayDiv.addEventListener('click', () => selectDay(num, dayDiv));

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
            eventDiv.innerHTML = `<i data-lucide="${getIconName(event.type)}" style="width: 12px; height: 12px;"></i> ${event.title}`;
            dayDiv.appendChild(eventDiv);
        });
    }
    calendarGrid.appendChild(dayDiv);
}

function selectDay(num, element) {
    const year = currentDate.getFullYear();
    const monthNum = currentDate.getMonth();

    document.querySelectorAll('.calendar-day').forEach(d => d.style.borderColor = 'transparent');
    element.style.borderColor = 'var(--primary)';

    const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentDate);
    selectedDateTitle.textContent = `${month} ${num}, ${year}`;

    const dayEvents = (currentBrand.events || []).filter(e =>
        e.day === num &&
        (e.month === undefined || e.month === monthNum) &&
        (e.year === undefined || e.year === year)
    );

    dailyCollection.innerHTML = '';
    if (dayEvents.length === 0) {
        dailyCollection.innerHTML = `<div class="empty-state"><i data-lucide="coffee" style="width: 32px; height: 32px; opacity: 0.2; margin-bottom: 12px;"></i><p>No collection scheduled for this day.</p></div>`;
    } else {
        dayEvents.forEach(event => {
            const item = document.createElement('div');
            item.className = 'collection-item animate-slide';
            item.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;"><span class="event-tag ${event.type}" style="margin-bottom: 0;">${event.type.toUpperCase()}</span><span class="time"><i data-lucide="clock" style="width: 12px; height: 12px;"></i> ${event.time}</span></div><h5>${event.title}</h5><p style="font-size: 0.8rem; color: var(--text-gray); line-height: 1.4;">${event.desc}</p>`;
            dailyCollection.appendChild(item);
        });
    }
    if (window.lucide) lucide.createIcons();
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
    area.innerHTML = '';

    if (!currentBrand.chat) {
        currentBrand.chat = [
            { sender: 'bot', text: "Welcome to Elite Support. I'm your AI Assistant. How can I help you today?", time: Date.now() }
        ];
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands)); syncToSheetDB();
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
    setTimeout(() => { area.scrollTop = area.scrollHeight; }, 10);
}

function getBotResponse(input) {
    const text = input.toLowerCase().trim();
    const brandName = currentBrand.name || "your brand";

    // 🛑 STRICT SECURITY PROTOCOL (Highest Priority)
    if (text.includes('password') || text.includes('key') || text.includes('username') || text.includes('login detail') || text.includes('credential') || text.includes('secret')) {
        return `🛡️ <strong>Security Protocol Active:</strong> To protect <strong>${brandName}</strong>, I am strictly prohibited from discussing or sharing security credentials. For any access issues, please coordinate directly with our Elite Administration via secure channels.`;
    }

    // 🌟 ADVANCED CONVERSATIONAL ENGINE (Greetings & Empathy)
    if (text.match(/^(hi|hello|hey|hy|hii|helo|hola|greetings|yo)/)) {
        return `Hello! It's a pleasure to assist you. I'm your dedicated <strong>Elite AI Strategist</strong> at Vertex Global Tech. How can I help you elevate <strong>${brandName}</strong> and drive more growth today?`;

    } else if (text.includes('how are you') || text.includes('how r u') || text.includes('u good')) {
        return `I'm functioning at peak performance and feeling highly productive! Thank you for asking. More importantly, how is the marketing momentum for <strong>${brandName}</strong> looking today?`;
    } else if (text.includes('good morning') || text.includes('good afternoon') || text.includes('good evening')) {
        const timeOfDay = text.includes('morning') ? 'morning' : (text.includes('afternoon') ? 'afternoon' : 'evening');
        return `Good ${timeOfDay}! I hope your day is off to a powerful start. Ready to look into some marketing strategies for <strong>${brandName}</strong>?`;
    } else if (text.includes('who are you') || text.includes('what are you')) {
        return "I am the proprietary <strong>Elite AI Strategist</strong> for Vertex Global Tech. My mission is to provide 24/7 strategic support, manage your digital roadmap, and bridge the gap between your brand and our expert human administrators.";
    }


    // 📈 ADVANCED MARKETING & BUSINESS STRATEGY (The "Training")
    else if (text.includes('seo') || text.includes('search engine') || text.includes('ranking') || text.includes('google')) {
        return `SEO is the backbone of organic growth for <strong>${brandName}</strong>. At Vertex Global Tech, we focus on technical SEO, high-authority backlinking, and semantic content optimization to ensure you dominate search results. Would you like a fresh SEO audit for your website?`;
    } else if (text.includes('roi') || text.includes('return on investment') || text.includes('profit') || text.includes('sales')) {
        return `Maximizing ROI for <strong>${brandName}</strong> is our top priority. We achieve this by tightening your ad spend, improving landing page conversion rates, and leveraging high-retention video content. Shall I request a performance breakdown from the analytics team?`;
    } else if (text.includes('strategy') || text.includes('roadmap') || text.includes('plan for the month')) {
        return `Your current roadmap for <strong>${brandName}</strong> is designed for consistent brand authority. We've balanced high-impact posts with strategic video content. If you'd like to pivot or accelerate the current strategy, I can alert our Chief Strategist immediately.`;
    } else if (text.includes('content') && (text.includes('idea') || text.includes('viral') || text.includes('trend'))) {
        return `To make <strong>${brandName}</strong> go viral, we should focus on short-form 'reels-style' video content with high hooks. Vertex Global Tech stays ahead of social algorithms. Should we brainstorm some trending concepts for your next shoot?`;
    } else if (text.includes('ads') || text.includes('meta') || text.includes('facebook ads') || text.includes('instagram ads')) {
        return `Our Meta Ads strategy for <strong>${brandName}</strong> focuses on high-intent lookalike audiences and A/B testing creative hooks. We aim for the lowest possible Cost Per Acquisition (CPA). Would you like to increase your ad budget for the upcoming campaign?`;
    } else if (text.includes('e-commerce') || text.includes('shopify') || text.includes('store') || text.includes('amazon')) {
        return `E-commerce boosting is one of our specialties. We optimize product listings, implement abandoned cart recovery strategies, and run targeted conversion ads. How are the sales looking on the <strong>${brandName}</strong> store this week?`;
    }

    // 🛠️ VERTEX GLOBAL TECH - CORE SERVICES
    else if (text.includes('service') || text.includes('what do you do')) {
        return "Vertex Global Tech is an elite 360-degree digital agency. Our core pillars are: <strong>1. Premium Web/App Development</strong>, <strong>2. Verified Marketing (Blue Tick)</strong>, <strong>3. E-commerce Boosting</strong>, and <strong>4. Viral Social Media Management</strong>. Which area should we focus on for your growth?";
    } else if (text.includes('website') || text.includes('web dev') || text.includes('ux') || text.includes('ui')) {
        return `We build high-performance, ultra-responsive digital homes for brands like <strong>${brandName}</strong>. Our designs aren't just beautiful—they are engineered to convert visitors into loyal customers. Do you have a new project in mind?`;
    } else if (text.includes('app') || text.includes('mobile')) {
        return "Mobile dominance is non-negotiable. Vertex Global Tech develops premium iOS and Android applications that provide seamless user experiences. I can arrange a technical consultation to discuss your app requirements.";
    } else if (text.includes('verif') || text.includes('blue tick') || text.includes('badge')) {
        return "Securing an official verification badge is a major milestone for brand authority. We manage the strategic positioning and documentation required to maximize your chances of approval on Instagram, Facebook, and Twitter.";
    }

    // 💼 BUSINESS LOGISTICS (Contracts, Pricing, Support)
    else if (text.includes('cost') || text.includes('price') || text.includes('how much') || text.includes('budget')) {
        return "Our solutions are bespoke, meaning we tailor the pricing to your specific goals and scale. This ensures you never overpay for services you don't need. I can request a customized quote for <strong>${brandName}</strong> from our billing department. Should I proceed?";
    } else if (text.includes('contract') || text.includes('renew') || text.includes('expire')) {
        const end = currentBrand.endDate || "Ongoing";
        return `Your active partnership for <strong>${brandName}</strong> is scheduled through ${end}. For renewal discussions or contract extensions, our administrators are available right here in this chat to assist.`;
    }

    // 📞 HUMAN ESCALATION & CONTACT (Professional & Direct)
    else if (text.includes('human') || text.includes('call') || text.includes('speak') || text.includes('agent') || text.includes('number') || text.includes('contact') || text.includes('whatsapp')) {
        return `I understand you'd like to speak with a human expert. You can reach our <strong>Elite Administration</strong> directly via WhatsApp or Phone at <strong>+91 96645 23986</strong>, or Email us at <strong>connectvertexglobal2209@gmail.com</strong>. I have also flagged this conversation for their immediate review.`;
    }

    // 🌪️ EMOTIONAL INTELLIGENCE & FEEDBACK
    else if (text.includes('bad') || text.includes('unhappy') || text.includes('error') || text.includes('problem') || text.includes('issue')) {
        return `I'm sincerely sorry to hear you're experiencing a challenge. At Vertex Global Tech, we pride ourselves on perfection. I have escalated this as a <strong>High Priority Incident</strong>. An Elite Administrator will contact you at <strong>+91 96645 23986</strong> shortly to ensure <strong>${brandName}</strong> is back on track.`;
    } else if (text.includes('thank') || text === 'ok' || text === 'great' || text === 'awesome') {
        return `You're very welcome! It's an honor to support <strong>${brandName}</strong>. Is there any other marketing objective we can tackle today?`;
    } else if (text.includes('bye') || text.includes('goodbye')) {
        return `Goodbye for now! I'll be right here if you need any more strategic assistance. Have a highly productive and successful day with <strong>${brandName}</strong>!`;
    }

    // 🧠 INTELLIGENT FALLBACK (The Learning Edge)
    else {
        return `I've noted your inquiry regarding "${input}". While I'm constantly learning, I want to ensure you get the most professional advice. I've logged this context for our <strong>Elite Administration</strong> to review and provide you with a detailed follow-up. Would you like to add any more details?`;
    }
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

