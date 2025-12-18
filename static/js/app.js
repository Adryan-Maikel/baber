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

// Authentication Management
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

// Check if user is authenticated for admin pages
function checkAuth() {
    if (window.location.pathname.includes('/admin')) {
        if (!isAuthenticated()) {
            window.location.href = '/login';
            return false;
        }
    }
    return true;
}

// Utils - Enhanced with auth
async function fetchAPI(endpoint, options = {}) {
    // Add auth token for admin routes
    if (endpoint.startsWith('/admin')) {
        const token = getAuthToken();
        if (token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }
    }

    const res = await fetch(`${API_URL}${endpoint}`, options);

    // Handle 401 Unauthorized
    if (res.status === 401) {
        if (window.location.pathname.includes('/admin')) {
            alert('Sessão expirada. Faça login novamente.');
            logout();
        }
        throw new Error('Unauthorized');
    }

    if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Erro na requisição");
        throw new Error(err.detail);
    }
    return res.json();
}

// Global state
let selectedService = null;
let selectedDate = null;
let selectedSlot = null;

document.addEventListener("DOMContentLoaded", () => {
    // Initialize theme
    initTheme();

    // Check authentication for admin pages
    checkAuth();

    // Determine page
    if (document.getElementById("services-list")) {
        loadServicesAdmin();
    }
    if (document.getElementById("user-services-list")) {
        loadServicesUser();
    }
    if (document.getElementById("appointment-list")) {
        loadAppointmentsAdmin();
    }

    // Set default date to today for booking
    const dateInput = document.getElementById("booking-date");
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        dateInput.min = today;
    }
});

// Admin Functions
function showSection(id) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    // Update active menu
    document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));
    // Simple logic to find link
    // In real app, add IDs to links
}

function openServiceModal() {
    document.getElementById('service-modal').style.display = 'flex';
}

async function createService(e) {
    e.preventDefault();
    const form = e.target;
    const body = {
        name: form.name.value,
        duration_minutes: parseInt(form.duration.value),
        price: form.price.value
    };

    await fetchAPI('/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    document.getElementById('service-modal').style.display = 'none';
    form.reset();
    loadServicesAdmin();
}

async function loadServicesAdmin() {
    const container = document.getElementById("services-list");
    if (!container) return;

    const services = await fetchAPI('/admin/services');
    container.innerHTML = services.map(s => `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3>${s.name}</h3>
                <p style="color: var(--text-secondary);">${s.duration_minutes} min • ${s.price}</p>
            </div>
            <button class="btn btn-danger" onclick="deleteService(${s.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

async function deleteService(id) {
    if (!confirm("Tem certeza?")) return;
    await fetchAPI(`/admin/services/${id}`, { method: 'DELETE' });
    loadServicesAdmin();
}

async function saveSchedule(e) {
    e.preventDefault();
    const form = e.target;
    // Hardcoding day for MVP or loop all days?
    // Let's sets generic active schedule for "Monday" as a test or similar.
    // Ideally UI allows selecting day.

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Create for all days for MVP simplicity
    for (const day of days) {
        await fetchAPI('/admin/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                day_of_week: day,
                start_time: form.start_time.value,
                end_time: form.end_time.value,
                is_active: true
            })
        });
    }
    alert("Horários salvos com sucesso!");
}

async function loadAppointmentsAdmin() {
    const container = document.getElementById("appointment-list");
    const countEl = document.getElementById("count-today");
    if (!container) return;

    const apps = await fetchAPI('/admin/appointments');
    // Filter/Count today
    const today = new Date().toISOString().split('T')[0];
    const todayApps = apps.filter(a => a.start_time.startsWith(today));
    if (countEl) countEl.innerText = todayApps.length;

    container.innerHTML = apps.map(a => `
        <li class="card" style="margin-bottom: 0.5rem;">
            <strong>${new Date(a.start_time).toLocaleString()}</strong> - ${a.customer_name} (${a.customer_phone})
        </li>
    `).join('');
}

// User Functions
async function loadServicesUser() {
    const container = document.getElementById("user-services-list");
    if (!container) return;

    const services = await fetchAPI('/admin/services');
    container.innerHTML = services.map(s => `
        <div class="card" style="cursor: pointer; transition: transform 0.2s;" onclick="selectService(${s.id}, '${s.name}', '${s.duration_minutes}', '${s.price}')">
            <div style="display: flex; justify-content: space-between;">
                <h3>${s.name}</h3>
                <span style="color: var(--accent); font-weight: bold;">${s.price}</span>
            </div>
            <p style="color: var(--text-secondary); margin-top: 0.5rem;"><i class="fa-regular fa-clock"></i> ${s.duration_minutes} min</p>
        </div>
    `).join('');
}

function selectService(id, name, duration, price) {
    selectedService = { id, name, duration, price };
    goToStep(2);
    loadSlots();
}

function goToStep(step) {
    document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
    document.getElementById(`step-${step}`).style.display = 'block';

    if (step === 3) {
        document.getElementById("confirm-service-name").innerText = `${selectedService.name} (${selectedService.price})`;
        document.getElementById("confirm-date-time").innerText = `${selectedDate} às ${selectedSlot}`;
    }
}

async function loadSlots() {
    if (!selectedService) return;
    const date = document.getElementById("booking-date").value;
    selectedDate = date;

    const container = document.getElementById("slots-container");
    container.innerHTML = '<p>Carregando...</p>';

    try {
        const data = await fetchAPI(`/availability?date_str=${date}&service_id=${selectedService.id}`);

        if (data.slots.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Nenhum horário disponível.</p>';
            return;
        }

        container.innerHTML = data.slots.map(slot => `
            <button class="btn" style="background-color: var(--card-bg); border: 1px solid var(--accent); width: 100%; justify-content: center;" onclick="selectSlot('${slot}')">
                ${slot}
            </button>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p style="color: var(--danger);">Erro ao carregar horários. Verifique se a barbearia está aberta.</p>';
    }
}

function selectSlot(time) {
    selectedSlot = time;
    goToStep(3);
}

async function confirmBooking(e) {
    e.preventDefault();
    const name = document.getElementById("customer-name").value;
    const phone = document.getElementById("customer-phone").value;

    // Construct datetime
    // selectedDate is YYYY-MM-DD, selectedSlot is HH:MM
    const start_time = `${selectedDate}T${selectedSlot}:00`;

    await fetchAPI('/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customer_name: name,
            customer_phone: phone,
            service_id: selectedService.id,
            start_time: start_time
        })
    });

    document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
    document.getElementById('step-success').style.display = 'block';
}
