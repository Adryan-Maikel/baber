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

function logout() {
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
