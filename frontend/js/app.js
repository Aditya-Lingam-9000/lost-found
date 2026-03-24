// Campus Finder Main JS

if (window.firebase && window.firebaseConfig && !firebase.apps.length) {
    firebase.initializeApp(window.firebaseConfig);
}

const SESSION_KEY = 'lf_session';
const ITEMS_KEY = 'lf_items';

function checkAuth() {
    const user = getSession();
    const isAuthRequired = document.body.getAttribute('data-auth') === 'required';
    const isAuthPage = window.location.pathname.includes('login.html');

    if (!user && isAuthRequired) {
        window.location.href = 'login.html';
        return false;
    }
    if (user && isAuthPage) {
        window.location.href = 'dashboard.html';
        return false;
    }
    return true;
}

function getSession() {
    try {
        const data = localStorage.getItem(SESSION_KEY);
        if (data) return JSON.parse(data);
    } catch(e) { console.error('Error parsing session data'); }
    return null;
}

function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
}

function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if(window.firebase && window.firebase.auth) {
                firebase.auth().signOut().then(clearSession).catch(clearSession);
            } else {
                clearSession();
            }
        });
    }
}

// Router
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    setupLogout();

    const path = window.location.pathname;
    
    // Add event handlers to forms on all pages just in case
    initPageActions();

    if (path.includes('index.html') || path === '/' || path.endsWith('/lost_found/frontend/')) {
        initIndexPage();
    } else if (path.includes('login.html')) {
        initLoginPage();
    } else if (path.includes('dashboard.html')) {
        initDashboardPage();
    } else if (path.includes('match.html')) {
        initMatchPage();
    }
});

function initPageActions() {
    const hamburger = document.getElementById('nav-hamburger');
    const navLinks = document.getElementById('nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
}

function initIndexPage() {
    // Only informational now
}

function initLoginPage() {
    const googleBtn = document.getElementById('google-login-btn');
    
    // Add debugging log to help identify if element is found
    if (!googleBtn) {
        console.error('Error: Could not find google-login-btn element');
        return;
    }

    if (window.firebase && window.firebase.auth) {
        const provider = new firebase.auth.GoogleAuthProvider();
        googleBtn.addEventListener('click', () => {
            console.log("Google button clicked, attempting to sign in...");
            firebase.auth().signInWithPopup(provider).then((result) => {
                const user = result.user;
                setSession({
                    id: user.uid,
                    name: user.displayName,
                    email: user.email,
                    authType: 'google'
                });
                window.location.href = 'dashboard.html';
            }).catch((error) => {
                console.error('Login failed:', error);
                alert('Login failed: ' + error.message);
            });
        });
    } else {
        console.error("Firebase or Firebase Auth is not initialized or available.");
        googleBtn.addEventListener('click', () => alert("System Error: Firebase is not loaded properly."));
    }
}

function initDashboardPage() {
    const user = getSession();
    if (user) {
        const nameEl = document.getElementById('profile-identifier');
        const idEl = document.getElementById('profile-user-id');
        if (nameEl) nameEl.textContent = user.name || 'User';
        if (idEl) idEl.textContent = user.email || user.id || '';
    }

    const lostForm = document.getElementById('lost-form');
    if (lostForm) {
        lostForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(lostForm);
            
            const newItem = {
                id: 'lost_' + Date.now(),
                type: 'lost',
                itemName: formData.get('item_name'),
                description: formData.get('description'),
                location: formData.get('location'),
                date: formData.get('date'),
                status: 'pending',
                reporterId: user ? (user.id || user.email) : 'unknown',
                reporterName: user ? user.name : 'unknown',
                timestamp: new Date().toISOString()
            };

            const items = JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
            items.push(newItem);
            localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
            
            alert('Lost item reported successfully!');
            lostForm.reset();
            const reportContainer = document.getElementById('lost-form-container');
            if (reportContainer) reportContainer.style.display = 'none';
            renderDashboardLists();
        });
    }

    const foundForm = document.getElementById('found-form');
    if (foundForm) {
        foundForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(foundForm);
            
            const newItem = {
                id: 'found_' + Date.now(),
                type: 'found',
                itemName: formData.get('item_name'),
                description: formData.get('description'),
                location: formData.get('location'),
                date: formData.get('date'),
                status: 'pending',
                reporterId: user ? (user.id || user.email) : 'unknown',
                reporterName: user ? user.name : 'unknown',
                timestamp: new Date().toISOString()
            };

            const items = JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
            items.push(newItem);
            localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
            
            alert('Found item reported successfully!');
            foundForm.reset();
            const reportContainer = document.getElementById('found-form-container');
            if (reportContainer) reportContainer.style.display = 'none';
            renderDashboardLists();
        });
    }

    renderDashboardLists();
}

function renderDashboardLists() {
    const user = getSession();
    if (!user) return;
    const userId = user.id || user.email;

    const items = JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
    
    const myLostList = document.getElementById('myLostList');
    const myFoundList = document.getElementById('myFoundList');
    
    if (myLostList) myLostList.innerHTML = '';
    if (myFoundList) myFoundList.innerHTML = '';

    const myItems = items.filter(item => item.reporterId === userId);
    
    const lostItems = myItems.filter(item => item.type === 'lost');
    const foundItems = myItems.filter(item => item.type === 'found');

    if (myLostList) {
        if (lostItems.length === 0) {
            myLostList.innerHTML = '<p style="color:var(--text-muted)">No lost items reported.</p>';
        } else {
            lostItems.forEach(item => {
                const el = document.createElement('div');
                el.className = 'card';
                el.innerHTML = '<h3 style="margin-bottom:8px">' + item.itemName + '</h3>' +
                '<p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:4px">' + item.description + '</p>' +
                '<div style="font-size:0.8rem;color:var(--text-muted)">' +
                    '<span>Lost on: ' + item.date + ' at ' + item.location + '</span>' +
                '</div>' +
                '<div style="margin-top:12px">' +
                '<span class="badge" style="background:var(--danger);color:white">' + item.status + '</span>' +
                '</div>';
                myLostList.appendChild(el);
            });
        }
    }

    if (myFoundList) {
        if (foundItems.length === 0) {
            myFoundList.innerHTML = '<p style="color:var(--text-muted)">No found items reported.</p>';
        } else {
            foundItems.forEach(item => {
                const el = document.createElement('div');
                el.className = 'card';
                el.innerHTML = '<h3 style="margin-bottom:8px">' + item.itemName + '</h3>' +
                '<p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:4px">' + item.description + '</p>' +
                '<div style="font-size:0.8rem;color:var(--text-muted)">' +
                    '<span>Found on: ' + item.date + ' at ' + item.location + '</span>' +
                '</div>' +
                '<div style="margin-top:12px">' +
                '<span class="badge" style="background:var(--secondary);color:white">' + item.status + '</span>' +
                '</div>';
                myFoundList.appendChild(el);
            });
        }
    }
}

function initMatchPage() {
    // Currently Not implemented
}
