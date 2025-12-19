/* ============================================
   GLOBAL JavaScript - Shared utilities
   ============================================ */

const API_URL = "";

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

// Admin Authentication
function getAuthToken() {
    return localStorage.getItem('access_token');
}

function isAuthenticated() {
    return !!getAuthToken();
}

async function logout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
    } catch (e) { console.error(e); }
    localStorage.removeItem('access_token');
    window.location.href = '/login';
}

// API Fetch Helper
async function fetchAPI(endpoint, options = {}, toLogin = false) {
    const token = getAuthToken();
    if (token && !options.headers?.['Authorization']) {
        options.headers = {
            ...options.headers,
            'Authorization': 'Bearer ' + token
        };
    }

    const res = await fetch(API_URL + endpoint, options);

    if (!res.ok) {
        let errorMessage = 'Erro na requisição';
        try {
            const error = await res.json();
            errorMessage = error.detail || errorMessage;
        } catch { }

        if (res.status === 401 && toLogin) {
            window.location.href = '/login';
        }

        alert(errorMessage);
        throw new Error(errorMessage);
    }

    return res.json();
}

// Phone Formatting
function formatPhoneInput(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length > 0) {
        if (value.length <= 2) {
            value = `(${value}`;
        } else if (value.length <= 6) {
            value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
        } else if (value.length <= 10) {
            value = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
        } else {
            value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
        }
    }

    input.value = value;
}

// Initialize theme on load
document.addEventListener('DOMContentLoaded', function () {
    initTheme();
});

// Global Modal Helpers
function showConfirmModal(message, title = 'Confirmação') {
    return new Promise((resolve) => {
        // Create modal elements
        const modalId = 'custom-confirm-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); z-index: 1000;
                display: none; align-items: center; justify-content: center;
            `;

            modal.innerHTML = `
                <div class="card" style="width: 400px; max-width: 90%; text-align: center; padding: 2rem;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: var(--accent); margin-bottom: 1rem;"></i>
                    <h3 id="${modalId}-title" style="margin-bottom: 0.5rem; font-size: 1.5rem;"></h3>
                    <p id="${modalId}-message" style="color: var(--text-secondary); margin-bottom: 1.5rem;"></p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button id="${modalId}-cancel" class="btn">Cancelar</button>
                        <button id="${modalId}-confirm" class="btn btn-primary">Confirmar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Update content
        document.getElementById(`${modalId}-title`).textContent = title;
        document.getElementById(`${modalId}-message`).textContent = message;

        // Handlers
        const close = (result) => {
            modal.style.display = 'none';
            resolve(result);
        };

        const confirmBtn = document.getElementById(`${modalId}-confirm`);
        const cancelBtn = document.getElementById(`${modalId}-cancel`);

        // Cloning to remove old listeners
        const newConfirm = confirmBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);

        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newConfirm.addEventListener('click', () => close(true));
        newCancel.addEventListener('click', () => close(false));

        // Show
        modal.style.display = 'flex';
    });
}

function showAlertModal(message, title = 'Aviso') {
    const modalId = 'custom-alert-modal';
    let modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 1001;
            display: none; align-items: center; justify-content: center;
        `;
        modal.innerHTML = `
            <div class="card" style="width: 350px; max-width: 90%; text-align: center; padding: 2rem;">
                <i class="fa-solid fa-bell" style="font-size: 3rem; color: var(--accent); margin-bottom: 1rem;"></i>
                <h3 id="${modalId}-title" style="margin-bottom: 0.5rem;"></h3>
                <p id="${modalId}-message" style="color: var(--text-secondary); margin-bottom: 1.5rem;"></p>
                <div style="display: flex; justify-content: center;">
                    <button id="${modalId}-ok" class="btn btn-primary" style="width:100px;">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById(`${modalId}-title`).textContent = title;
    document.getElementById(`${modalId}-message`).textContent = message;

    // Handler
    return new Promise(resolve => {
        const btn = document.getElementById(`${modalId}-ok`);
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            resolve();
        });

        modal.style.display = 'flex';
    });
}
