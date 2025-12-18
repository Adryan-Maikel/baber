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

// =========== Customer Authentication ===========

let currentCustomer = null;
const CUSTOMER_TOKEN_KEY = 'customer_token';
let phoneCheckTimeout = null;
let phoneExists = false;

function getCustomerToken() {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

function isCustomerLoggedIn() {
    return !!getCustomerToken() && !!currentCustomer;
}

function logoutCustomer() {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    currentCustomer = null;
    updateCustomerUI();
    closeUserMenu();
}

// Toggle user menu dropdown
function toggleUserMenu() {
    const dropdown = document.getElementById('user-menu-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

function closeUserMenu() {
    const dropdown = document.getElementById('user-menu-dropdown');
    if (dropdown) dropdown.style.display = 'none';
}

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
    const container = document.querySelector('.user-menu-container');
    if (container && !container.contains(e.target)) {
        closeUserMenu();
    }
});

function updateCustomerUI() {
    const guestMenu = document.getElementById('guest-menu-items');
    const loggedMenu = document.getElementById('logged-menu-items');
    const loggedInfo = document.getElementById('customer-logged-info');
    const guestFields = document.getElementById('guest-fields');
    const menuIcon = document.getElementById('user-menu-icon');
    const menuCustomerName = document.getElementById('menu-customer-name');
    const menuCustomerPhone = document.getElementById('menu-customer-phone');

    if (isCustomerLoggedIn() && currentCustomer) {
        // Show logged in state
        if (guestMenu) guestMenu.style.display = 'none';
        if (loggedMenu) loggedMenu.style.display = 'block';
        if (menuIcon) menuIcon.className = 'fa-solid fa-user-check';
        if (menuCustomerName) menuCustomerName.textContent = currentCustomer.name;
        if (menuCustomerPhone) menuCustomerPhone.textContent = currentCustomer.phone;

        if (loggedInfo) {
            loggedInfo.style.display = 'block';
            document.getElementById('logged-customer-name').textContent = currentCustomer.name;
            document.getElementById('logged-customer-phone').textContent = currentCustomer.phone;
        }
        if (guestFields) {
            guestFields.style.display = 'none';
            const nameInput = document.getElementById('customer-name');
            const phoneInput = document.getElementById('customer-phone');
            if (nameInput) nameInput.removeAttribute('required');
            if (phoneInput) phoneInput.removeAttribute('required');
        }
    } else {
        // Show guest state
        if (guestMenu) guestMenu.style.display = 'block';
        if (loggedMenu) loggedMenu.style.display = 'none';
        if (menuIcon) menuIcon.className = 'fa-solid fa-user';

        if (loggedInfo) loggedInfo.style.display = 'none';
        if (guestFields) {
            guestFields.style.display = 'block';
            const nameInput = document.getElementById('customer-name');
            const phoneInput = document.getElementById('customer-phone');
            if (nameInput) nameInput.setAttribute('required', '');
            if (phoneInput) phoneInput.setAttribute('required', '');
        }
    }
}

// Check if phone already exists when user types
async function checkPhoneExists() {
    const phoneInput = document.getElementById('customer-phone');
    const msg = document.getElementById('phone-check-msg');
    const passwordSection = document.getElementById('password-section');
    const loginSection = document.getElementById('login-section');

    if (!phoneInput || !msg) return;

    const phone = phoneInput.value.replace(/\D/g, '');

    // Only check if phone has enough digits
    if (phone.length < 10) {
        msg.style.display = 'none';
        if (passwordSection) passwordSection.style.display = 'none';
        if (loginSection) loginSection.style.display = 'none';
        phoneExists = false;
        return;
    }

    // Debounce the check
    clearTimeout(phoneCheckTimeout);
    phoneCheckTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`/customer/check-phone?phone=${encodeURIComponent(phoneInput.value)}`);
            if (res.ok) {
                const data = await res.json();
                phoneExists = data.exists;

                if (data.exists) {
                    msg.style.display = 'block';
                    msg.style.color = 'var(--accent)';
                    msg.innerHTML = '<i class="fa-solid fa-user"></i> Telefone já cadastrado';
                    if (passwordSection) passwordSection.style.display = 'none';
                    if (loginSection) loginSection.style.display = 'block';
                } else {
                    msg.style.display = 'block';
                    msg.style.color = 'var(--success)';
                    msg.innerHTML = '<i class="fa-solid fa-check"></i> Telefone disponível';
                    if (passwordSection) passwordSection.style.display = 'block';
                    if (loginSection) loginSection.style.display = 'none';
                }
            }
        } catch (e) {
            // Silently fail
        }
    }, 500);
}

function openAuthModal(type) {
    showAuthForm(type || 'login');
    document.getElementById('auth-modal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

function showAuthForm(type) {
    const loginForm = document.getElementById('auth-login-form');
    const registerForm = document.getElementById('auth-register-form');
    if (type === 'login') {
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
    } else {
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
    }
}

async function customerLogin(e) {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/customer/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password })
        });

        if (!res.ok) {
            const error = await res.json();
            alert(error.detail || 'Erro ao fazer login');
            return;
        }

        const data = await res.json();
        localStorage.setItem(CUSTOMER_TOKEN_KEY, data.access_token);
        currentCustomer = data.customer;
        closeAuthModal();
        updateCustomerUI();
    } catch (e) {
        alert('Erro de conexão');
    }
}

async function customerRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;

    try {
        const res = await fetch('/customer/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, password })
        });

        if (!res.ok) {
            const error = await res.json();
            alert(error.detail || 'Erro ao cadastrar');
            return;
        }

        const data = await res.json();
        localStorage.setItem(CUSTOMER_TOKEN_KEY, data.access_token);
        currentCustomer = data.customer;
        closeAuthModal();
        updateCustomerUI();
        alert('Cadastro realizado com sucesso!');
    } catch (e) {
        alert('Erro de conexão');
    }
}

async function loadCustomerProfile() {
    const token = getCustomerToken();
    if (!token) return;

    try {
        const res = await fetch(`/customer/profile?token=${token}`);
        if (res.ok) {
            currentCustomer = await res.json();
            updateCustomerUI();
        }
    } catch (e) { }
}

async function openHistoryModal() {
    const token = getCustomerToken();
    if (!token) return;

    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '<p style="color: var(--text-secondary);">Carregando...</p>';
    document.getElementById('history-modal').style.display = 'flex';

    try {
        const res = await fetch(`/customer/history?token=${token}`);
        if (res.ok) {
            const history = await res.json();
            if (history.length === 0) {
                historyList.innerHTML = '<p style="color: var(--text-secondary);">Nenhum agendamento encontrado.</p>';
            } else {
                historyList.innerHTML = history.map(h => `
                    <div class="card" style="margin-bottom: 0.5rem; padding: 1rem;">
                        <strong>${new Date(h.start_time).toLocaleDateString('pt-BR')}</strong>
                        <span style="color: var(--accent);">${new Date(h.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <p style="color: var(--text-secondary);">${h.service_name || 'Serviço'} - ${h.barber_name || 'Barbeiro'}</p>
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        historyList.innerHTML = '<p style="color: var(--danger);">Erro ao carregar histórico.</p>';
    }
}

// Prefill booking form with customer data (for logged in users)
function prefillBookingForm() {
    if (isCustomerLoggedIn() && currentCustomer) {
        const nameInput = document.getElementById('customer-name');
        const phoneInput = document.getElementById('customer-phone');
        if (nameInput) nameInput.value = currentCustomer.name;
        if (phoneInput) phoneInput.value = currentCustomer.phone;
    }
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

    // Get customer data - from logged in customer or form
    let name, phone, customerToken = getCustomerToken();
    let accountCreated = false;

    if (isCustomerLoggedIn() && currentCustomer) {
        name = currentCustomer.name;
        phone = currentCustomer.phone;
    } else {
        name = document.getElementById("customer-name").value;
        phone = document.getElementById("customer-phone").value;

        // Check if we need to create account or login
        const password = document.getElementById("customer-password")?.value;
        const existingPassword = document.getElementById("existing-password")?.value;

        if (phoneExists && existingPassword) {
            // Login existing user
            try {
                const loginRes = await fetch('/customer/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, password: existingPassword })
                });
                if (loginRes.ok) {
                    const data = await loginRes.json();
                    customerToken = data.access_token;
                    localStorage.setItem(CUSTOMER_TOKEN_KEY, customerToken);
                    currentCustomer = data.customer;
                }
            } catch (e) { }
        } else if (!phoneExists && password && password.length >= 6) {
            // Create new account
            try {
                const regRes = await fetch('/customer/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, phone, password })
                });
                if (regRes.ok) {
                    const data = await regRes.json();
                    customerToken = data.access_token;
                    localStorage.setItem(CUSTOMER_TOKEN_KEY, customerToken);
                    currentCustomer = data.customer;
                    accountCreated = true;
                }
            } catch (e) { }
        }
    }

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

    // Build URL with customer token if available
    let url = '/book';
    if (customerToken) {
        url += `?customer_token=${customerToken}`;
    }

    try {
        await fetchAPI(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });

        document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
        document.getElementById('step-success').style.display = 'block';

        // Show account created message
        if (accountCreated) {
            const msg = document.getElementById('account-created-msg');
            if (msg) msg.style.display = 'block';
        }

        updateCustomerUI();
    } catch (e) {
        // Error already shown by fetchAPI
    }
}

// Initialize customer profile on page load
document.addEventListener('DOMContentLoaded', function () {
    loadCustomerProfile();
});
