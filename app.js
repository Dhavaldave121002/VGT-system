// Data Management - Sync with Admin Portal
const SHEETDB_API_URL = "https://sheetdb.io/api/v1/vvutbhezp19tr"; // ✅ LIVE DATABASE CONNECTED

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

// SheetDB Sync Engine (Client-Side) - JSON Blob Architecture
async function syncToSheetDB() {
    if (!SHEETDB_API_URL) return;
    try {
        const payload = { data: [{ id: 1, database_json: JSON.stringify(brands) }] };
        // Try PATCH first (update existing row), fallback to POST
        const patchRes = await fetch(SHEETDB_API_URL + '/id/1', {
            method: 'PATCH',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { database_json: JSON.stringify(brands) } })
        });
        if (!patchRes.ok) {
            // Row doesn't exist yet, create it
            await fetch(SHEETDB_API_URL, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
    } catch (error) {
        console.warn("SheetDB Sync Failed. Using local storage.", error);
    }
}

async function loadFromSheetDB() {
    if (!SHEETDB_API_URL) return false;
    try {
        const res = await fetch(SHEETDB_API_URL, {
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) return false;
        const rows = await res.json();
        
        if (rows && rows.length > 0 && rows[0].database_json) {
            const cloudData = JSON.parse(rows[0].database_json);
            brands = cloudData;
            localStorage.setItem('socialSphere_brands', JSON.stringify(brands));
            console.log("✅ Blob data loaded from SheetDB.");
            return true;
        }
    } catch (error) {
        console.warn("Could not load from SheetDB. Using local data.", error);
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
    const loadingEl = document.getElementById('loginScreen');
    await loadFromSheetDB(); // Pull latest data from cloud
    // Re-run property audit after cloud load
    Object.keys(brands).forEach(key => {
        if (!brands[key].plan) brands[key].plan = 'Plan 1: 3 Posts, 2 Videos';
        if (!brands[key].trial) brands[key].trial = 'Phase 1: Buy 1, Get 1 Free';
        if (brands[key].locked === undefined) brands[key].locked = false;
        if (!brands[key].events) brands[key].events = [];
        if (!brands[key].handle) brands[key].handle = `@${key}`;
    });
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const brandId = document.getElementById('brandId').value.trim().toLowerCase();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    
    // ADMIN SECURE GATEWAY
    if (brandId === 'admin' && (password === 'admin123' || password === 'admin@123')) {
        const loginBtn = loginForm.querySelector('button');
        loginBtn.innerHTML = `<i class="animate-spin" data-lucide="loader-2"></i> Elevating Access...`;
        if (window.lucide) lucide.createIcons();
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 800);
        return;
    }
    
    // Check if brand exists and password matches (or if it's a default brand with any pass for demo)
    if (brands[brandId]) {
        const brand = brands[brandId];
        
        // Visual Feedback
        const loginBtn = loginForm.querySelector('button');
        const originalBtnText = loginBtn.innerHTML;
        
        // Check if account is locked
        if (brand.locked) {
            errorMsg.innerHTML = `<i data-lucide="lock" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 6px;"></i> Account Locked. Please contact your administrator.`;
            errorMsg.style.display = 'block';
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Check if password matches
        if (brand.pass === password || brandId === 'nike' || brandId === 'starbucks' || brandId === 'apple') {
            errorMsg.style.display = 'none';
            loginBtn.innerHTML = `<i class="animate-spin" data-lucide="loader-2"></i> Authenticating...`;
            if (window.lucide) lucide.createIcons();
            
            setTimeout(() => {
                login(brandId);
            }, 800);
        } else {
            errorMsg.textContent = 'Invalid security key.';
            errorMsg.style.display = 'block';
        }
    } else {
        errorMsg.textContent = 'Identity verification failed. Check Brand ID.';
        errorMsg.style.display = 'block';
    }
});

function login(brandId) {
    currentBrand = brands[brandId];
    currentBrandId = brandId;

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
    
    let avatarUrl = '';
    if (gender === 'female') {
        // High-quality Female Professional Cartoon Avatar
        avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Liliana&backgroundColor=ffdfbf';
    } else {
        // High-quality Male Professional Cartoon Avatar
        avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=c0aede';
    }

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

window.dismissMessage = function(time, event) {
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
    dashboard.style.display = 'none';
    document.getElementById('chatWidgetContainer').style.display = 'none';
    loginScreen.style.display = 'flex';
    loginScreen.style.opacity = '1';
    loginForm.reset();
}

function changeOwnPassword() {
    if (!currentBrand || !currentBrandId) return;
    const newPass = prompt(`Update Security Key for ${currentBrand.name}:`);
    if (newPass && newPass.trim().length > 0) {
        if (brands[currentBrandId]) {
            brands[currentBrandId].pass = newPass.trim();
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
    switch(type) {
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
                ${isUser ? 'You' : (msg.sender === 'admin' ? 'Admin Support' : 'AI Assistant')}
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
    
    // 🛑 STRICT SECURITY PROTOCOL (Highest Priority)
    if (text.includes('password') || text.includes('key') || text.includes('username') || text.includes('login detail') || text.includes('credential') || text.includes('secret')) {
        return "🛡️ SECURITY PROTOCOL ACTIVE: I am strictly prohibited from sharing, verifying, or discussing any security credentials, passwords, or personal account details. Please contact your Elite Administrator directly for security concerns.";
    }

    // Pre-trained Greetings (Expanded matching)
    if (text.match(/^(hi|hello|hey|hy|hii|helo|hola|greetings)/)) {
        return "Hello! I'm your AI Marketing Assistant. How can I help you elevate your brand today?";
    } else if (text.includes('how are you') || text.includes('how r u')) {
        return "I'm functioning perfectly and ready to assist you with your marketing goals! What's on your mind?";
    } else if (text.includes('good morning') || text.includes('good afternoon') || text.includes('good evening')) {
        return "Greetings! I hope you're having an excellent day. How can I assist with your dashboard or Vertex Global Tech campaigns today?";
    } else if (text.includes('who are you') || text.includes('what are you') || text.includes('company name')) {
        return "I am the proprietary AI Support Assistant for Vertex Global Tech. I'm engineered to provide instant support, manage your digital ecosystem, and seamlessly connect you with our human administrators.";
    } else if (text.includes('name') && text.includes('your')) {
        return "I am the Vertex Global Tech AI Assistant. You can think of me as your 24/7 digital concierge.";
    } else if (text.includes('human') || text.includes('robot') || text.includes('bot') || text.includes('ai')) {
        return "I am a highly advanced AI system designed specifically for Vertex Global Tech clients. However, I am directly connected to our human Elite Administrators. If you ever need a human, just say 'Call me' or 'Human'.";
    }
    
    // Core Services & Vertex Global Tech Offerings
    else if (text.includes('service') || text.includes('what do you do') || text.includes('what do u do')) {
        return "Vertex Global Tech is an elite digital agency. We specialize in Custom Website Development, Mobile App Creation, Verified Marketing (Blue Tick verification), Product Listing & Boosting (E-commerce), and comprehensive Social Media Marketing.";
    } else if (text.includes('website') || text.includes('web dev') || text.includes('web design')) {
        return "Our Website Development division at Vertex Global Tech builds ultra-responsive, high-conversion websites tailored to your brand. From landing pages to full e-commerce platforms, we handle UI/UX design and backend engineering. Would you like me to connect you with our web team?";
    } else if (text.includes('app') || text.includes('mobile') || text.includes('application')) {
        return "Vertex Global Tech engineers premium Mobile Applications for both iOS and Android. We focus on seamless user experiences and robust performance. Shall I notify a project manager to discuss your app idea?";
    } else if (text.includes('verif') || text.includes('blue tick') || text.includes('badge')) {
        return "We offer Elite Verified Marketing services. We help position your brand strategically to secure official verification badges across major social platforms, elevating your brand authority and trust.";
    } else if (text.includes('product') || text.includes('listing') || text.includes('boosting') || text.includes('e-commerce') || text.includes('ecommerce')) {
        return "Our Product Listing & Boosting services ensure your products dominate search results. We optimize listings with high-converting copy, professional creatives, and algorithmic boosting strategies to maximize your ROI.";
    }
    
    // Plans, Packages, Cost & Portfolio
    else if (text.includes('plan') || text.includes('pricing') || text.includes('upgrade') || text.includes('package')) {
        return `You are currently assigned to the "${currentBrand.plan || 'Standard'}". If you are looking to scale your marketing efforts with Vertex Global Tech, I can notify an Elite Administrator to discuss premium upgrades. Would you like me to do that?`;
    } else if (text.includes('cost') || text.includes('how much') || text.includes('fee') || text.includes('price')) {
        return "Because our solutions at Vertex Global Tech are bespoke and tailored to your specific goals (Website, Apps, Marketing), pricing varies. I can arrange a free consultation with our Elite Administration to provide a precise quote. Should I initiate that?";
    } else if (text.includes('portfolio') || text.includes('client') || text.includes('proof') || text.includes('review')) {
        return "Vertex Global Tech has partnered with elite brands globally to drive massive digital growth. Our administrators would be happy to share our private portfolio and case studies tailored to your industry.";
    }
    
    // Location & Hours
    else if (text.includes('where') || text.includes('location') || text.includes('address')) {
        return "Vertex Global Tech operates globally as a premium digital agency. You can coordinate directly with our Elite Administration at any time via this dashboard.";
    } else if (text.includes('hour') || text.includes('open') || text.includes('time')) {
        return "I am available 24/7. Our human Elite Administrators typically review urgent requests immediately and standard requests within normal business hours.";
    }
    
    // Platform Coverage & Social Networks
    else if (text.includes('platform') || text.includes('coverage') || text.includes('social media') || text.includes('tiktok') || text.includes('instagram')) {
        return `Your current Social Coverage is set to "${currentBrand.coverage?.toUpperCase() || 'ALL'}". We specialize in Meta (IG/FB), LinkedIn, Twitter, and high-retention Video content. If you need a platform added to your roster, let me know!`;
    }

    // Analytics, Reports & Performance
    else if (text.includes('report') || text.includes('analytic') || text.includes('performance') || text.includes('growth') || text.includes('result')) {
        return "Your detailed performance analytics and growth reports are compiled at the end of your billing cycle. If you require an immediate mid-cycle audit, I can request one from your account manager.";
    }

    // Contract, Billing & Renewals
    else if (text.includes('contract') || text.includes('renew') || text.includes('expire') || text.includes('billing')) {
        const start = currentBrand.startDate || 'Ongoing';
        const end = currentBrand.endDate || 'Ongoing';
        return `Your current contract period is set from ${start} to ${end}. For billing inquiries or to initiate an early renewal, please message your administrator directly in this chat.`;
    }

    // Content & Scheduling
    else if (text.includes('post') || text.includes('content') || text.includes('schedule') || text.includes('calendar')) {
        return "You can view all your scheduled content in the Calendar Roadmap on your dashboard. If you need immediate revisions or new content ideation, please specify the details here.";
    } 
    
    // Escalation & Official Contact Details
    else if (text.includes('call') || text.includes('phone') || text.includes('human') || text.includes('agent') || text.includes('speak') || text.includes('contact') || text.includes('email') || text.includes('mobile') || text.includes('whatsapp') || text.includes('number')) {
        return `You can reach our Elite Administration directly via Email at <strong>connectvertexglobal2209@gmail.com</strong> or via Mobile/WhatsApp at <strong>+91 96645 23986</strong>. I have also flagged this chat for immediate human review.`;
    }
    
    // Troubleshooting & Frustration Handling
    else if (text.includes('bad') || text.includes('terrible') || text.includes('worst') || text.includes('unhappy') || text.includes('angry')) {
        return "I am incredibly sorry that you are having a negative experience. I have immediately escalated this chat to the highest priority tier. An Elite Administrator will contact you at +91 96645 23986 shortly to resolve this perfectly.";
    } else if (text.includes('problem') || text.includes('issue') || text.includes('help') || text.includes('error') || text.includes('stuck')) {
        return "I'm sorry you're experiencing an issue. I've logged this as a high-priority technical alert. An Elite Administrator will review our chat and deploy a solution immediately.";
    } 
    
    // Conversational Fillers & Farewells
    else if (text.includes('thank') || text === 'ok' || text === 'okay' || text === 'cool' || text === 'great' || text === 'awesome') {
        return "You're very welcome! Let me know if you need anything else to optimize your digital presence.";
    } else if (text.includes('bye') || text.includes('goodbye') || text.includes('see ya')) {
        return "Goodbye! It was a pleasure assisting you. Have a highly productive day!";
    }
    
    // Fallback Logging
    else {
        return "I understand. I have recorded your inquiry into our secure logs. An Elite Administrator will review this context and follow up with you. Is there any additional information you'd like to provide?";
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
        div.style.cssText = "background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); padding: 16px; border-radius: 12px;";
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; align-items: flex-start;">
                <div>
                    <span style="font-size: 0.7rem; color: #10B981; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Action Required</span>
                    <p style="margin: 4px 0; color: #fff; line-height: 1.5; font-size: 0.95rem;">${task.note}</p>
                </div>
            </div>
            <form onsubmit="submitVideoLink(event, ${realIndex})" style="display: flex; gap: 12px;">
                <input type="url" id="driveLink_${task.id}" placeholder="Paste Google Drive Link here..." required style="flex-grow: 1; background: rgba(0,0,0,0.3); border: 1px solid var(--border-glass); color: white; padding: 10px 16px; border-radius: 8px; font-size: 0.9rem; outline: none;">
                <button type="submit" style="background: #10B981; color: white; border: none; padding: 0 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="upload-cloud" style="width: 16px; height: 16px;"></i> Submit
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
            
            // 1. Add User Message
            currentBrand.chat.push({ sender: 'user', text: text, time: Date.now() });
            localStorage.setItem('socialSphere_brands', JSON.stringify(brands)); syncToSheetDB();
            renderChatMessages();
            inputEl.value = '';
            
            // 2. Simulate Bot Thinking & Responding
            setTimeout(() => {
                const response = getBotResponse(text);
                currentBrand.chat.push({ sender: 'bot', text: response, time: Date.now() });
                localStorage.setItem('socialSphere_brands', JSON.stringify(brands)); syncToSheetDB();
                renderChatMessages();
            }, 800);
        });
    }
});
