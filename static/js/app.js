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

// =========== User Profile Management ===========

function getUserProfile() {
    const profile = localStorage.getItem('user_profile');
    return profile ? JSON.parse(profile) : { name: '', phone: '' };
}

function saveUserProfile(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('profile-name').value;
    const phone = document.getElementById('profile-phone').value;

    localStorage.setItem('user_profile', JSON.stringify({ name, phone }));
    document.getElementById('profile-modal').style.display = 'none';

    // Show success feedback
    alert('Perfil salvo com sucesso!');
}

function loadUserProfileToForm() {
    const profile = getUserProfile();
    const nameInput = document.getElementById('profile-name');
    const phoneInput = document.getElementById('profile-phone');

    if (nameInput) nameInput.value = profile.name || '';
    if (phoneInput) phoneInput.value = profile.phone || '';
}

function openProfileModal() {
    loadUserProfileToForm();
    document.getElementById('profile-modal').style.display = 'flex';
}

// Prefill booking form with profile data
function prefillBookingForm() {
    const profile = getUserProfile();
    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');

    if (nameInput && !nameInput.value) nameInput.value = profile.name || '';
    if (phoneInput && !phoneInput.value) phoneInput.value = profile.phone || '';
}

// =========== Phone Formatting ===========

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

// =========== Booking State ===========

let selectedBarber = null;
let selectedService = null;
let selectedDate = null;
let selectedSlot = null;

// =========== Initialization ===========

document.addEventListener("DOMContentLoaded", () => {
    // Initialize theme
    initTheme();

    // Check authentication for admin pages
    checkAuth();

    // Determine page and load appropriate data
    if (document.getElementById("services-list")) {
        loadServicesAdmin();
    }
    if (document.getElementById("barbers-list")) {
        loadBarbers();
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

// =========== Admin Functions ===========

// showSection is defined in admin.html with full implementation

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

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    const today = new Date().toISOString().split('T')[0];
    const todayApps = apps.filter(a => a.start_time.startsWith(today));
    if (countEl) countEl.innerText = todayApps.length;

    container.innerHTML = apps.map(a => `
        <li class="card" style="margin-bottom: 0.5rem;">
            <strong>${new Date(a.start_time).toLocaleString()}</strong> - ${a.customer_name} (${a.customer_phone})
            ${a.barber ? `<br><span style="color: var(--accent);">Profissional: ${a.barber.name}</span>` : ''}
        </li>
    `).join('');
}

// =========== User Functions ===========

async function loadBarbers() {
    const container = document.getElementById("barbers-list");
    if (!container) return;

    try {
        const barbers = await fetchAPI('/barbers');

        if (barbers.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 2rem;">
                    <i class="fa-solid fa-user-slash" style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary);">Nenhum profissional disponível no momento.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = barbers.map(b => `
            <div class="card barber-card" style="cursor: pointer; transition: transform 0.2s;" onclick="selectBarber(${b.id}, '${b.name}')">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div class="barber-avatar">
                        ${b.avatar_url
                ? `<img src="${b.avatar_url}" alt="${b.name}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;">`
                : `<i class="fa-solid fa-user-tie" style="font-size: 2rem; color: var(--accent);"></i>`
            }
                    </div>
                    <div>
                        <h3>${b.name}</h3>
                        <p style="color: var(--text-secondary);"><i class="fa-solid fa-circle" style="color: var(--success); font-size: 0.5rem;"></i> Disponível</p>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = `<p style="color: var(--danger);">Erro ao carregar profissionais.</p>`;
    }
}

function selectBarber(id, name) {
    selectedBarber = { id, name };
    goToStep(2);
    loadServicesUser();
}

async function loadServicesUser() {
    const container = document.getElementById("user-services-list");
    if (!container || !selectedBarber) return;

    try {
        // Load services for the selected barber
        const services = await fetchAPI(`/barbers/${selectedBarber.id}/services`);

        if (services.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 2rem;">
                    <p style="color: var(--text-secondary);">Este profissional ainda não possui serviços cadastrados.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = services.map(s => {
            const hasDiscount = s.discount_price && s.discount_price < s.price;
            const displayPrice = hasDiscount
                ? `<span style="text-decoration: line-through; color: var(--text-secondary); font-size: 0.875rem;">R$ ${s.price.toFixed(2)}</span> <span style="color: var(--success); font-weight: bold;">R$ ${s.discount_price.toFixed(2)}</span>`
                : `<span style="color: var(--accent); font-weight: bold;">R$ ${s.price.toFixed(2)}</span>`;

            return `
            <div class="card" style="cursor: pointer; transition: transform 0.2s;" onclick="selectService(${s.id}, '${s.name.replace(/'/g, "\\'")}', ${s.duration_minutes}, ${s.discount_price || s.price}, true)">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>${s.name}</h3>
                    <div>${displayPrice}</div>
                </div>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;"><i class="fa-regular fa-clock"></i> ${s.duration_minutes} min</p>
            </div>
        `}).join('');
    } catch (e) {
        container.innerHTML = `<p style="color: var(--danger);">Erro ao carregar serviços.</p>`;
    }
}

function selectService(id, name, duration, price, isBarberService = false) {
    selectedService = { id, name, duration, price, isBarberService };
    goToStep(3);
    loadSlots();
}

function goToStep(step) {
    document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
    document.getElementById(`step-${step}`).style.display = 'block';

    if (step === 4) {
        // Prefill with saved profile
        prefillBookingForm();

        // Update confirmation display
        document.getElementById("confirm-barber-name").innerText = selectedBarber ? `✂️ ${selectedBarber.name}` : '';
        document.getElementById("confirm-service-name").innerText = `${selectedService.name} (R$ ${typeof selectedService.price === 'number' ? selectedService.price.toFixed(2) : selectedService.price})`;
        document.getElementById("confirm-date-time").innerText = `📅 ${formatDateBR(selectedDate)} às ${selectedSlot}`;
    }
}

function formatDateBR(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

async function loadSlots() {
    if (!selectedService) return;
    const date = document.getElementById("booking-date").value;
    selectedDate = date;

    const container = document.getElementById("slots-container");
    container.innerHTML = '<p>Carregando...</p>';

    try {
        let endpoint = `/availability?date_str=${date}&barber_id=${selectedBarber.id}`;
        if (selectedService.isBarberService) {
            endpoint += `&barber_service_id=${selectedService.id}`;
        } else {
            endpoint += `&service_id=${selectedService.id}`;
        }

        const data = await fetchAPI(endpoint);

        if (data.slots.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Nenhum horário disponível para esta data.</p>';
            return;
        }

        container.innerHTML = data.slots.map(slot => `
            <button class="btn" style="background-color: var(--card-bg); border: 1px solid var(--accent); width: 100%; justify-content: center;" onclick="selectSlot('${slot}')">
                ${slot}
            </button>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p style="color: var(--danger);">Erro ao carregar horários. Verifique se a barbearia está aberta neste dia.</p>';
    }
}

function selectSlot(time) {
    selectedSlot = time;
    goToStep(4);
}

async function confirmBooking(e) {
    e.preventDefault();
    const name = document.getElementById("customer-name").value;
    const phone = document.getElementById("customer-phone").value;

    // Construct datetime
    const start_time = `${selectedDate}T${selectedSlot}:00`;

    const bookingData = {
        customer_name: name,
        customer_phone: phone,
        barber_id: selectedBarber.id,
        start_time: start_time
    };

    // Add service ID based on type
    if (selectedService.isBarberService) {
        bookingData.barber_service_id = selectedService.id;
    } else {
        bookingData.service_id = selectedService.id;
    }

    try {
        await fetchAPI('/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });

        document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
        document.getElementById('step-success').style.display = 'block';
    } catch (e) {
        // Error already shown by fetchAPI
    }
}
