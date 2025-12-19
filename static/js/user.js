/* ============================================
   USER/PUBLIC PAGE JavaScript
   Booking flow and customer authentication
   ============================================ */

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

// Check if phone already exists
async function checkPhoneExists() {
    const phoneInput = document.getElementById('customer-phone');
    const msg = document.getElementById('phone-check-msg');
    const passwordSection = document.getElementById('password-section');
    const loginSection = document.getElementById('login-section');

    if (!phoneInput || !msg) return;

    const phone = phoneInput.value.replace(/\D/g, '');

    if (phone.length < 10) {
        msg.style.display = 'none';
        if (passwordSection) passwordSection.style.display = 'none';
        if (loginSection) loginSection.style.display = 'none';
        phoneExists = false;
        return;
    }

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
        } catch (e) { }
    }, 500);
}

// Auth Modal Functions
function openAuthModal(type) {
    showAuthForm(type || 'login');
    document.getElementById('auth-modal').style.display = 'flex';
    closeUserMenu();
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
    closeUserMenu();

    try {
        const res = await fetch(`/customer/history?token=${token}`);
        if (res.ok) {
            currentHistory = await res.json();
            if (currentHistory.length === 0) {
                historyList.innerHTML = '<p style="color: var(--text-secondary);">Nenhum agendamento encontrado.</p>';
            } else {
                historyList.innerHTML = currentHistory.map(h => {
                    const isFuture = new Date(h.start_time) > new Date();
                    const canCancel = isFuture && h.status === 'scheduled';
                    const statusMap = {
                        'scheduled': { label: 'Agendado', color: 'var(--success)' },
                        'completed': { label: 'Concluído', color: 'var(--accent)' },
                        'no_show': { label: 'Não Compareceu', color: 'var(--danger)' },
                        'cancelled': { label: 'Cancelado', color: 'var(--text-secondary)' }
                    };
                    const st = statusMap[h.status] || { label: h.status, color: 'var(--text-secondary)' };

                    return `
                <div class="card" style="margin-bottom: 0.5rem; padding: 1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 1rem;">
                    <div style="flex: 1; min-width: 200px;">
                        <strong>${new Date(h.start_time).toLocaleDateString('pt-BR')}</strong>
                        <span style="color: var(--accent); margin-left: 0.5rem;">${new Date(h.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <p style="color: var(--text-secondary); margin-top: 0.25rem;">${h.service_name || 'Serviço'} - ${h.barber_name || 'Barbeiro'}</p>
                        <p style="font-size: 0.8rem; color: ${st.color}; margin-top: 0.25rem;">
                            Status: ${st.label}
                        </p>
                    </div>
                    ${canCancel ? `
                        <div style="display: flex; gap: 0.5rem;">
                             <button class="btn btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="rescheduleAppointment(${h.id})">
                                <i class="fa-solid fa-calendar-days"></i> Alterar
                            </button>
                            <button class="btn" style="background:var(--danger); padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="cancelMyAppointment(${h.id})">
                                Cancelar
                            </button>
                        </div>` : ''}
                    </div>
                `}).join('');
            }
        }
    } catch (e) {
        historyList.innerHTML = '<p style="color: var(--danger);">Erro ao carregar histórico.</p>';
    }
}

// Global Modal Helpers
// Modal helpers moved to global.js

let currentHistory = [];

async function cancelMyAppointment(id) {
    const confirmed = await showConfirmModal('Deseja realmente cancelar este agendamento?', 'Cancelar Agendamento');
    if (!confirmed) return;

    const token = getCustomerToken();
    try {
        const res = await fetch(`/customer/appointments/${id}/cancel?token=${token}`, {
            method: 'POST'
        });

        if (res.ok) {
            await showAlertModal('Agendamento cancelado com sucesso!');
            openHistoryModal();
        } else {
            const err = await res.json();
            let msg = err.detail || 'Falha ao cancelar';
            if (typeof msg === 'object') {
                msg = JSON.stringify(msg);
            }
            await showAlertModal('Erro: ' + msg);
        }
    } catch (e) {
        await showAlertModal('Erro de conexão');
    }
}

let rescheduleAppointmentId = null;

async function rescheduleAppointment(id) {
    const appt = currentHistory.find(h => h.id === id);
    if (!appt) return;

    // Just close modal and prepare booking flow
    document.getElementById('history-modal').style.display = 'none';

    rescheduleAppointmentId = id; // Set pending reschedule

    // Pre-fill booking state
    selectedBarber = { id: appt.barber_id, name: appt.barber_name };

    const isBarberService = !!appt.barber_service_id;
    const sId = isBarberService ? appt.barber_service_id : appt.service_id;

    selectedService = {
        id: sId,
        name: appt.service_name,
        duration: appt.duration_minutes,
        price: appt.price,
        isBarberService: isBarberService
    };

    // Pre-fill date
    const dateStr = appt.start_time.split('T')[0];
    document.getElementById("booking-date").value = dateStr;
    selectedDate = dateStr;

    // Go to slots and load them
    goToStep(3);

    // Trigger load immediately
    await loadSlots();

    // Scroll to booking section
    document.getElementById("booking").scrollIntoView({ behavior: 'smooth' });

    // Notify user they are rescheduling
    await showAlertModal('Escolha o novo horário para o agendamento.', 'Alterando Agendamento');
}



// =========== Booking State ===========

let selectedBarber = null;
let selectedService = null;
let selectedDate = null;
let selectedSlot = null;

// =========== Stories State ===========
let storiesData = {}; // barberId -> { stories: [], viewed: boolean }
let currentStoryBarberId = null;
let currentStoryIndex = 0;
let storyTimer = null;
let storyStartTime = 0;
let STORY_DURATION = 5000; // 5 seconds for images

// =========== Stories Functions ===========

async function fetchStories() {
    try {
        const res = await fetch('/stories');
        if (res.ok) {
            const data = await res.json();
            // Process stories
            data.forEach(group => {
                storiesData[group.barber_id] = {
                    ...group,
                    viewed: false // simplified viewed state (in-memory)
                };
            });
        }
    } catch (e) { console.error("Error fetching stories", e); }
}

function openStoryViewer(barberId) {
    if (!storiesData[barberId]) return;

    currentStoryBarberId = barberId;
    currentStoryIndex = 0;

    const group = storiesData[barberId];

    document.getElementById('story-barber-name').textContent = group.barber_name;
    document.getElementById('story-barber-avatar').src = group.barber_avatar || '/static/img/default-avatar.png';
    const modal = document.getElementById('story-viewer-modal');
    modal.style.display = 'flex';

    showStory(currentStoryIndex);
}

function closeStoryViewer() {
    document.getElementById('story-viewer-modal').style.display = 'none';
    clearTimeout(storyTimer);
    const video = document.querySelector('#story-content video');
    if (video) video.pause();
    currentStoryBarberId = null;
}

function showStory(index) {
    if (!currentStoryBarberId || !storiesData[currentStoryBarberId]) return;

    const stories = storiesData[currentStoryBarberId].stories;
    if (index >= stories.length) {
        closeStoryViewer();
        return;
    }
    if (index < 0) {
        // Option: go to previous barber? For now just stay at 0
        currentStoryIndex = 0;
        return;
    }

    currentStoryIndex = index;
    const story = stories[index];
    const container = document.getElementById('story-media-container');
    const timeLabel = document.getElementById('story-time');

    // Update progress bars
    renderProgressBars(stories.length, index);

    // Format relative time (simple)
    const date = new Date(story.created_at);
    timeLabel.textContent = date.toLocaleDateString();

    container.innerHTML = '';
    clearTimeout(storyTimer);

    if (story.media_type === 'video') {
        const video = document.createElement('video');
        video.src = story.media_url;
        video.autoplay = true;
        video.playsInline = true;
        video.controls = false;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';

        video.onended = () => nextStory();
        video.oncanplay = () => {
            // Progress bar handling for video would require update loop, using css animation for now
            startProgress(video.duration * 1000);
        };
        container.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = story.media_url;
        container.appendChild(img);
        startProgress(STORY_DURATION);
        storyTimer = setTimeout(nextStory, STORY_DURATION);
    }
}

function nextStory() {
    showStory(currentStoryIndex + 1);
}

function prevStory() {
    showStory(currentStoryIndex - 1);
}

function startProgress(duration) {
    const bars = document.querySelectorAll('.story-progress-fill');
    if (bars[currentStoryIndex]) {
        // Reset current
        bars[currentStoryIndex].style.transition = 'none';
        bars[currentStoryIndex].style.width = '0%';

        // Force reflow
        void bars[currentStoryIndex].offsetWidth;

        // Start animation
        bars[currentStoryIndex].style.transition = `width ${duration}ms linear`;
        bars[currentStoryIndex].style.width = '100%';
    }
}

function renderProgressBars(count, activeIndex) {
    const container = document.getElementById('story-progress-bars');
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const bar = document.createElement('div');
        bar.className = 'story-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'story-progress-fill';

        if (i < activeIndex) {
            fill.style.width = '100%';
        } else if (i > activeIndex) {
            fill.style.width = '0%';
        }

        bar.appendChild(fill);
        container.appendChild(bar);
    }
}

// =========== Booking Functions ===========

async function loadBarbers() {
    const container = document.getElementById("barbers-list");
    if (!container) return;

    try {
        const barbers = await fetchAPI('/barbers');
        if (barbers.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Nenhum profissional disponível no momento.</p>';
            return;
        }

        // Fetch stories first
        await fetchStories();

        container.innerHTML = barbers.map(b => {
            const hasStories = storiesData[b.id] && storiesData[b.id].stories.length > 0;
            const ringClass = hasStories ? 'story-ring' : '';

            // New smaller avatar layout
            const avatarHtml = `
                <div class="${ringClass}" ${hasStories ? `onclick="event.stopPropagation(); openStoryViewer(${b.id})"` : ''} 
                     style="width: 100px; height: 100px; min-width: 100px;">
                    <img src="${b.avatar_url || '/static/img/default-avatar.png'}" 
                         style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">
                </div>
             `;

            // Service list preview (first 3)
            const serviceList = b.services ? b.services.slice(0, 3).map(s => `
                <span style="font-size: 0.75rem; background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary);">
                    ${s.name}
                </span>
            `).join('') : '';
            const moreServices = b.services && b.services.length > 3 ? `<span style="font-size: 0.75rem; color: var(--text-secondary);">+${b.services.length - 3}</span>` : '';

            return `
            <div class="card barber-card" onclick="selectBarber(${b.id}, '${b.name}')" 
                 style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.5rem; padding: 1.5rem; min-width: 100px; max-width: 300px;">
                 ${avatarHtml}
                <div>
                    <h3 style="font-size: 1.1rem; margin-bottom: 0.25rem;">${b.name}</h3>
                    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 0.25rem;">
                        ${serviceList} ${moreServices}
                    </div>
                </div>
            </div>
        `}).join('');

        // CSS Grid adjustment for the new card style (simulated via inline style logic or CSS update)
        // Ideally we update CSS, but we can rely on existing grid.
    } catch (e) {
        container.innerHTML = '<p style="color: var(--danger);">Erro ao carregar profissionais.</p>';
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

    container.innerHTML = '<p>Carregando serviços...</p>';

    try {
        const services = await fetchAPI(`/barbers/${selectedBarber.id}/services`);

        if (services.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Nenhum serviço disponível para este profissional.</p>';
            return;
        }

        container.innerHTML = services.map(s => {
            const hasDiscount = s.discount_price && s.discount_price < s.price;
            const displayPrice = hasDiscount
                ? `<span style="text-decoration: line-through; color: var(--text-secondary);">R$ ${s.price.toFixed(2)}</span> <span style="color: var(--success); font-weight: bold;">R$ ${s.discount_price.toFixed(2)}</span>`
                : `<span style="font-weight: bold;">R$ ${s.price.toFixed(2)}</span>`;
            const priceValue = hasDiscount ? s.discount_price : s.price;

            return `
            <div class="card service-card" onclick="selectService(${s.id}, '${s.name}', ${s.duration_minutes}, ${priceValue}, true)" 
                 style="cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>${s.name}</h3>
                    <div>${displayPrice}</div>
                </div>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;"><i class="fa-regular fa-clock"></i> ${s.duration_minutes} min</p>
            </div>
        `}).join('');
    } catch (e) {
        container.innerHTML = '<p style="color: var(--danger);">Erro ao carregar serviços.</p>';
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
        updateCustomerUI();
        document.getElementById("confirm-barber-name").innerText = selectedBarber ? `✂️ ${selectedBarber.name}` : '';
        document.getElementById("confirm-service-name").innerText = `${selectedService.name} (R$ ${typeof selectedService.price === 'number' ? selectedService.price.toFixed(2) : selectedService.price})`;
        document.getElementById("confirm-date-time").innerText = `📅 ${formatDateBR(selectedDate)} às ${selectedSlot}`;
    }
}

function formatDateBR(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

let slotsPollInterval = null;

async function loadSlots() {
    if (!selectedService) return;
    const date = document.getElementById("booking-date").value;
    selectedDate = date;

    const container = document.getElementById("slots-container");
    container.innerHTML = '<p>Carregando...</p>';

    // Clear previous poll
    if (slotsPollInterval) clearInterval(slotsPollInterval);

    const fetchSlots = async () => {
        try {
            let endpoint = `/availability?date_str=${date}&barber_id=${selectedBarber.id}`;
            if (selectedService.isBarberService) {
                endpoint += `&barber_service_id=${selectedService.id}`;
            } else {
                endpoint += `&service_id=${selectedService.id}`;
            }

            // Here we use fetch directly to avoid fetchAPI missing issue
            const res = await fetch(endpoint);
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();

            if (data.slots.length === 0) {
                container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Nenhum horário disponível para esta data.</p>';
                return;
            }

            // If selectedSlot is still in the new list, keep it selected style
            const currentSelection = selectedSlot;

            container.innerHTML = data.slots.map(slot => `
                <button class="btn slot-btn ${slot === currentSelection ? 'selected-slot' : ''}" 
                        style="${slot === currentSelection ? 'background: var(--accent); color: var(--text-primary);' : ''}"
                        onclick="selectSlot('${slot}')">${slot}</button>
            `).join('');
        } catch (e) {
            container.innerHTML = '<p style="color: var(--danger);">Erro ao carregar horários.</p>';
        }
    };

    await fetchSlots();
    // Poll every 5 seconds to keep fresh
    slotsPollInterval = setInterval(fetchSlots, 5000);
}


function selectSlot(time) {
    selectedSlot = time;
    goToStep(4);
}

async function confirmBooking(e) {
    e.preventDefault();

    let name, phone, customerToken = getCustomerToken();
    let accountCreated = false;

    if (isCustomerLoggedIn() && currentCustomer) {
        name = currentCustomer.name;
        phone = currentCustomer.phone;
    } else {
        name = document.getElementById("customer-name").value;
        phone = document.getElementById("customer-phone").value;

        const password = document.getElementById("customer-password")?.value;
        const existingPassword = document.getElementById("existing-password")?.value;

        if (phoneExists && existingPassword) {
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

    const start_time = `${selectedDate}T${selectedSlot}:00`;

    const bookingData = {
        customer_name: name,
        customer_phone: phone,
        barber_id: selectedBarber.id,
        start_time: start_time
    };

    if (selectedService.isBarberService) {
        bookingData.barber_service_id = selectedService.id;
    } else {
        bookingData.service_id = selectedService.id;
    }

    let url = '/book';
    if (customerToken) {
        url += `?customer_token=${customerToken}`;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });

        if (response.status === 409) {
            alert('Ops! Este horário acabou de ser reservado por outra pessoa. A lista de horários será atualizada.');
            goToStep(3); // Go back to slots
            loadSlots(); // Refresh
            return;
        }

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Erro ao agendar');
        }

        // Handle Reschedule: Cancel Old Appointment
        if (typeof rescheduleAppointmentId !== 'undefined' && rescheduleAppointmentId) {
            try {
                // We use the same token as booking if available, or fetch current
                const token = customerToken || getCustomerToken();
                await fetch(`/customer/appointments/${rescheduleAppointmentId}/cancel?token=${token}`, { method: 'POST' });
                // We could show a specific message
            } catch (e) {
                console.error("Failed to cancel old appointment during reschedule", e);
                alert('Novo agendamento criado, mas falha ao cancelar o anterior. Por favor cancele manualmente.');
            }
            rescheduleAppointmentId = null;
        }

        document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
        document.getElementById('step-success').style.display = 'block';

        if (accountCreated) {
            const msg = document.getElementById('account-created-msg');
            if (msg) msg.style.display = 'block';
        }

        updateCustomerUI();
    } catch (e) {
        // Handle specific modal alert if we want consistency, but here sticking to what was there or upgrading
        // The user.js seems to use alert() in this function predominantly, let's switch to proper modal if possible or stick to alert
        // The catch block uses alert('Erro: ' + e.message), I will stick to that to minimize diff risk or upgrade it?
        // Let's stick to alert for now as per this function's style, or better:
        // Use showAlertModal if available (global.js)
        if (typeof showAlertModal === 'function') {
            await showAlertModal('Erro: ' + e.message);
        } else {
            alert('Erro: ' + e.message);
        }
    }
}

// =========== Initialization ===========

document.addEventListener("DOMContentLoaded", () => {
    // Load barbers list
    loadBarbers();

    // Load customer profile if logged in
    loadCustomerProfile();

    // Set default date to today
    const dateInput = document.getElementById("booking-date");
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        dateInput.min = today;
    }
});
