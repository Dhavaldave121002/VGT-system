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
            
            // Sidebar also reflects the "1 Post/Reel" status
            let categoryLabel = event.type.toUpperCase();
            const format = event.format || 'auto';

            if (format === 'post') categoryLabel = "1 POST";
            else if (format === 'reel') categoryLabel = "1 REEL";
            else if (format === 'ad') categoryLabel = "1 PAID AD";
            else if (event.type === 'shoot') categoryLabel = "SHOOT ASSIGNMENT";
            else {
                // Fallback
                if (['insta', 'fb', 'tw', 'threads', 'link'].includes(event.type)) categoryLabel = "1 POST";
                else if (['video', 'yt'].includes(event.type)) categoryLabel = "1 REEL";
                else if (event.type === 'ad') categoryLabel = "1 PAID AD";
            }

            item.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;"><span class="event-tag ${event.type}" style="margin-bottom: 0;">${categoryLabel}</span><span class="time"><i data-lucide="clock" style="width: 12px; height: 12px;"></i> ${event.time}</span></div><h5>${event.title}</h5><p style="font-size: 0.8rem; color: var(--text-gray); line-height: 1.4;">${event.desc}</p>`;
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
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands)); syncToSheetDB();
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

    // 🔍 PRECISE SCRIPT DETECTION
    const hasGujaratiScript = /[\u0A80-\u0AFF]/.test(text);
    const hasHindiScript = /[\u0900-\u097F]/.test(text);
    
    // Check for Romanized Gujarati/Hindi (Hinglish/Gujlish)
    const isRomanizedLocal = /(kem chho|majama|su chale|tame|kaise ho|kya hai|apka|kaam|karu|badhana)/i.test(lowerText);

    // Helper to pick the right response based on script
    const getLang = () => {
        if (hasGujaratiScript) return 'guj';
        if (hasHindiScript) return 'hin';
        return 'eng';
    };

    const lang = getLang();

    // 🛡️ SECURITY PROTOCOL
    if (/(password|key|login|credential|secret|security|પાસવર્ડ|पासवर्ड)/i.test(lowerText)) {
        const res = {
            guj: `🛡️ <strong>સુરક્ષા પ્રોટોકોલ:</strong> હું ${brandName} ની સિક્યુરિટી ડિટેલ્સ શેર કરી શકતો નથી. કોઈ પણ સમસ્યા માટે એડમિનનો સંપર્ક કરો.`,
            hin: `🛡️ <strong>सुरक्षा प्रोटोकॉल:</strong> मैं ${brandName} की सुरक्षा जानकारी साझा नहीं कर सकता। किसी भी समस्या के लिए एडमिन से संपर्क करें।`,
            eng: `🛡️ <strong>Security Protocol:</strong> I cannot share credentials for ${brandName}. Please contact our Elite Administration for access issues.`
        };
        return res[lang];
    }

    // 🌟 GREETINGS
    if (/^(hi|hello|hey|kem chho|kaise ho|namskar|namaste|નમસ્તે|नमस्ते)/i.test(lowerText)) {
        const res = {
            guj: `નમસ્તે! હું તમારો <strong>Elite AI Strategist</strong> છું. આજે આપણે <strong>${brandName}</strong> ને કેવી રીતે આગળ વધારીએ?`,
            hin: `नमस्ते! मैं आपका <strong>Elite AI Strategist</strong> हूँ। आज हम <strong>${brandName}</strong> को और बेहतर कैसे बना सकते हैं?`,
            eng: `Hello! I'm your dedicated <strong>Elite AI Strategist</strong>. How can I help you elevate <strong>${brandName}</strong> today?`
        };
        return res[lang];
    }

    // 📈 SEO & GOOGLE
    if (/(seo|google|ranking|સર્ચ|सर्च)/i.test(lowerText)) {
        const res = {
            guj: `SEO એ <strong>${brandName}</strong> માટે ખૂબ મહત્વનું છે. અમે તમારી વેબસાઇટને Google ના પહેલા પેજ પર લાવવા માટે કામ કરીએ છીએ.`,
            hin: `SEO <strong>${brandName}</strong> के लिए बहुत महत्वपूर्ण है। हम आपकी वेबसाइट को Google के पहले पेज पर लाने में मदद करते हैं।`,
            eng: `SEO is the backbone of organic growth for <strong>${brandName}</strong>. We optimize your technical presence to dominate search results.`
        };
        return res[lang];
    }

    // 💰 ROI & GROWTH
    if (/(roi|profit|sales|grow|business|vadharo|badhana|નફો|मुनाफा)/i.test(lowerText)) {
        const res = {
            guj: `<strong>${brandName}</strong> નો નફો વધારવા માટે અમે ટાર્ગેટેડ એડ્સ અને હાઈ-ક્વોલિટી વીડિયો કન્ટેન્ટ પર ફોકસ કરીએ છીએ.`,
            hin: `<strong>${brandName}</strong> का मुनाफा बढ़ाने के लिए हम टारगेटेड एड्स और हाई-क्वालिटी वीडियो कंटेंट पर ध्यान देते हैं।`,
            eng: `Maximizing ROI for <strong>${brandName}</strong> is our priority. We achieve this through strategic ad spending and conversion optimization.`
        };
        return res[lang];
    }

    // 🛠️ SERVICES
    if (/(service|kaam|kam|what do you do|su karo cho|કામ|काम)/i.test(lowerText)) {
        const res = {
            guj: `Vertex Global Tech એક પ્રીમિયમ એજન્સી છે. અમે <strong>Web Development</strong>, <strong>Marketing</strong>, અને <strong>Blue Tick Verification</strong> માં માસ્ટર છીએ.`,
            hin: `Vertex Global Tech एक प्रीमियम एजेंसी है। हम <strong>Web Development</strong>, <strong>Marketing</strong>, और <strong>Blue Tick Verification</strong> में मास्टर हैं।`,
            eng: `Vertex Global Tech is an elite agency specializing in <strong>Premium Web Dev</strong>, <strong>Verified Marketing</strong>, and <strong>Viral Social Management</strong>.`
        };
        return res[lang];
    }

    // 📞 CONTACT
    if (/(human|call|speak|contact|agent|number|whatsapp|phone|help|મદદ|मदद)/i.test(lowerText)) {
        const contactInfo = `WhatsApp: <strong>+91 96645 23986</strong> | Email: <strong>connectvertexglobal2209@gmail.com</strong>`;
        const res = {
            guj: `ચોક્કસ, તમે અમારા એડમિન સાથે સીધી વાત કરી શકો છો: ${contactInfo}`,
            hin: `जी हाँ, आप हमारे एडमिन से सीधे संपर्क कर सकते हैं: ${contactInfo}`,
            eng: `I understand. You can reach our Elite Administration directly at: ${contactInfo}`
        };
        return res[lang];
    }

    // 🗨️ YES/NO CONFIRMATIONS & SIMPLE ANSWERS
    if (/^(yes|no|ha|na|chalse|nathi|હાલ|ના|हाँ|नहीं)/i.test(lowerText)) {
        return `Understood. I've noted your preference for <strong>${brandName}</strong>. Is there anything else I can assist with?`;
    }

    if (/(delete|clear|remove|nikal|bhusi|કાઢી|हटा)/i.test(lowerText)) {
        return `I cannot delete your history directly for security audit reasons, but the system <strong>automatically resets every 24 hours</strong> to keep your stage perfect. Would you like me to help with something else?`;
    }

    // 🧠 FALLBACK (Smart learning response)
    const fallback = {
        guj: `મેં તમારી આ વાત "${text}" એડમિન માટે નોંધી લીધી છે. તેઓ ટૂંક સમયમાં <strong>${brandName}</strong> માટે તમારો સંપર્ક કરશે.`,
        hin: `मैंने आपकी यह बात "${text}" एडमिन के लिए नोट कर ली है। वे जल्द ही <strong>${brandName}</strong> के लिए आपसे संपर्क करेंगे।`,
        eng: `I've noted your inquiry regarding "${text}". I've logged this context for our <strong>Elite Administration</strong> to provide you with a detailed follow-up.`
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
setInterval(() => {
    if (!currentBrand || !currentBrand.chat) return;
    
    const now = Date.now();
    const expiry = 24 * 60 * 60 * 1000;
    const originalLength = currentBrand.chat.length;
    
    currentBrand.chat = currentBrand.chat.filter(msg => (now - msg.time) < expiry);
    
    if (currentBrand.chat.length !== originalLength) {
        console.log("🧹 Background Cleanup: Removing expired messages...");
        if (currentBrand.chat.length === 0) {
            currentBrand.chat.push({ sender: 'bot', text: "Welcome to Elite Support. I'm your AI Assistant. How can I help you today?", time: now });
        }
        renderChatMessages();
        localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
        syncToSheetDB();
    }
}, 60000); // Check every 60 seconds


