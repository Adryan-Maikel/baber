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
        const style = window.getComputedStyle(dropdown);
        const isHidden = style.display === 'none';
        dropdown.style.display = isHidden ? 'block' : 'none';
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

    // Use new standard class toggle
    document.getElementById('history-modal').classList.add('active');

    closeUserMenu();

    // Reset filter
    const dateInput = document.getElementById('history-date-filter');
    if (dateInput) dateInput.value = '';

    try {
        const res = await fetch(`/customer/history?token=${token}`);
        if (res.ok) {
            currentHistory = await res.json();
            renderHistory(currentHistory);
        }
    } catch (e) {
        historyList.innerHTML = '<p style="color: var(--danger);">Erro ao carregar histórico.</p>';
    }
}

function renderHistory(list) {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    if (!list || list.length === 0) {
        historyList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">Nenhum agendamento encontrado para esta data.</p>';
        return;
    }

    historyList.innerHTML = list.map(h => {
        const isFuture = new Date(h.start_time) > new Date();
        const canCancel = isFuture && h.status === 'scheduled';
        const statusMap = {
            'scheduled': { label: 'Agendado', color: 'var(--success)' },
            'completed': { label: 'Concluído', color: 'var(--accent)' },
            'no_show': { label: 'Não Compareceu', color: 'var(--danger)' },
            'cancelled': { label: 'Cancelado', color: 'var(--text-secondary)' }
        };
        const st = statusMap[h.status] || { label: h.status, color: 'var(--text-secondary)' };

        // Show existing rating
        let existingRatingHtml = '';
        if (h.rating) {
            existingRatingHtml += '<div style="margin-top:0.25rem; color: #fbbf24;">';
            for (let i = 1; i <= 5; i++) {
                existingRatingHtml += i <= h.rating ? '<i class="fa-solid fa-star" style="font-size:0.8rem"></i>' : '<i class="fa-regular fa-star" style="font-size:0.8rem"></i>';
            }
            if (h.feedback_notes) {
                existingRatingHtml += `<span style="color:var(--text-secondary); margin-left:0.5rem; font-size:0.8rem;">"${h.feedback_notes}"</span>`;
            }
            existingRatingHtml += '</div>';
        }

        // Check for story logic - make card clickable if media exists
        const storyOnClick = h.media_url ? `openSingleStoryViewer('${h.media_url}', '${h.media_type}', '${h.barber_name}', '${h.start_time}', '${h.barber_avatar || ''}')` : '';

        return `
    <div class="card" style="margin-bottom: 0.5rem; padding: 1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 1rem;">
        <div style="flex: 1; min-width: 200px;">
            <div style="display:flex; justify-content:space-between;">
                 <strong>${new Date(h.start_time).toLocaleDateString('pt-BR')}</strong>
            </div>
            <span style="color: var(--accent);">${new Date(h.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            <p style="color: var(--text-secondary); margin-top: 0.25rem;">${h.service_name || 'Serviço'} - ${h.barber_name || 'Barbeiro'}</p>
            <p style="font-size: 0.8rem; color: ${st.color}; margin-top: 0.25rem;">
                Status: ${st.label}
            </p>
            ${existingRatingHtml}
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
        
        ${h.status === 'completed' ? `
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <button class="btn btn-primary" style="padding: 0.25rem 0.6rem; font-size: 0.85rem;" 
                        onclick="openFeedbackModal(${h.id}, ${h.rating || 0}, '${(h.feedback_notes || '').replace(/'/g, "\\'")}', ${h.story_is_public !== undefined ? h.story_is_public : true}, '${h.media_url || ''}', '${h.media_type || ''}', '${h.barber_name || ''}', '${h.start_time || ''}', '${h.barber_avatar || ''}')">
                   <i class="fa-regular fa-star"></i> ${h.rating ? 'Editar Avaliação' : 'Avaliar / Ver Storie'}
                </button>
            </div>
        ` : ''}
        </div>
    `}).join('');
}

function filterHistory() {
    const dateInput = document.getElementById('history-date-filter');
    if (!dateInput || !dateInput.value) {
        renderHistory(currentHistory);
        return;
    }
    const selectedDate = dateInput.value; // YYYY-MM-DD format
    // Filter history
    const filtered = currentHistory.filter(h => h.start_time.startsWith(selectedDate));
    renderHistory(filtered);
}

// Close History Modal Standard
function closeHistoryModal() {
    document.getElementById('history-modal').classList.remove('active');
}

// Ensure global scope access if needed by onclick in HTML
window.closeHistoryModal = closeHistoryModal;

// Feedback Functions
let currentFeedbackApptId = null;
let currentRating = 0;

function openFeedbackModal(apptId, existingRating, existingNotes, isPublic = true, mediaUrl = null, mediaType = null, barberName = '', startTime = '', barberAvatar = '') {
    currentFeedbackApptId = apptId;
    currentRating = existingRating || 0;

    let modal = document.getElementById('feedback-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.className = 'custom-modal-overlay'; // Standard Overlay
        modal.innerHTML = `
            <div class="custom-modal">
                <div class="custom-modal-header">
                    <h3 id="feedback-modal-title">Avaliar Atendimento</h3>
                    <!-- Close button in header (optional, usually title is enough but standard has it) -->
                    <!-- But previously we didn't have one here, user relied on Cancel button or backdrop? -->
                    <!-- We will add standard close X for consistency -->
                    <button class="custom-modal-close" onclick="closeFeedbackModal()">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                
                <div class="custom-modal-body">
                    <div class="custom-modal-content">
                        <p style="color: var(--text-secondary); margin-bottom: 1rem; text-align: center;">Como foi sua experiência?</p>
                        
                        <div class="star-rating-input" style="text-align: center;">
                            <i class="fa-regular fa-star" onclick="setRating(1)" id="star-1"></i>
                            <i class="fa-regular fa-star" onclick="setRating(2)" id="star-2"></i>
                            <i class="fa-regular fa-star" onclick="setRating(3)" id="star-3"></i>
                            <i class="fa-regular fa-star" onclick="setRating(4)" id="star-4"></i>
                            <i class="fa-regular fa-star" onclick="setRating(5)" id="star-5"></i>
                        </div>
                        
                        <textarea id="feedback-notes" placeholder="Deixe um comentário (opcional)..." rows="3" style="width: 100%; margin-bottom: 1rem;"></textarea>
                        
                        <div id="feedback-media-section"></div>
                    </div>
                </div>

                <div class="custom-modal-footer">
                     <button class="btn" onclick="closeFeedbackModal()" style="border: 1px solid var(--border);">Cancelar</button>
                     <button class="btn btn-primary" onclick="submitFeedback()">Enviar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Update Media Section
    const mediaContainer = document.getElementById('feedback-media-section');
    if (mediaUrl) {
        let mediaHtml = '';
        if (mediaType === 'video') {
            mediaHtml = `
                <div style="position: relative; width: 100%; padding-top: 100%; margin-bottom: 1rem; background: #000; border-radius: 8px; overflow: hidden;">
                    <video src="${mediaUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" controls></video>
                </div>`;
        } else {
            mediaHtml = `
                <div style="position: relative; width: 100%; padding-top: 100%; margin-bottom: 1rem; background: #000; border-radius: 8px; overflow: hidden;">
                    <img src="${mediaUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" onclick="openSingleStoryViewer('${mediaUrl}', '${mediaType}', '${barberName}', '${startTime}', '${barberAvatar}')">
                </div>`;
        }

        mediaContainer.innerHTML = `
            <fieldset style="border: 1px solid var(--border); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <legend style="padding: 0 0.5rem; color: var(--accent); font-size: 0.9rem;">Fotos do Corte</legend>
                ${mediaHtml}
                <div style="display: flex; gap: 1rem; justify-content: space-between; align-items: center;">
                    <button class="btn btn-primary" style="padding: 0.5rem 1rem; width: fit-content; height: fit-content;" 
                            onclick="openSingleStoryViewer('${mediaUrl}', '${mediaType}', '${barberName}', '${startTime}', '${barberAvatar}')" title="Tela Cheia">
                        <i class="fa-solid fa-expand"></i>
                    </button>
                    <div class="privacy-toggle-wrapper" onclick="document.getElementById('feedback-public').click()" style="margin-bottom: 0;">
                         <input type="checkbox" id="feedback-public" class="privacy-checkbox" onchange="updatePrivacyEmote()">
                         <div class="privacy-label">
                             <i id="privacy-emote-display" class="privacy-emote fa-solid fa-earth-americas"></i>
                             <span id="privacy-text-display" class="privacy-text"></span>
                         </div>
                    </div>
                </div>
            </fieldset>
        `;
        // We need to re-bind the checkbox state logic after injecting HTML
        setTimeout(() => {
            const checkbox = document.getElementById('feedback-public');
            if (checkbox) {
                checkbox.checked = isPublic;
                updatePrivacyEmote();
            }
        }, 0);
    } else {
        mediaContainer.innerHTML = '';
    }

    const title = document.getElementById('feedback-modal-title');
    if (title) title.innerText = existingRating ? 'Editar Avaliação' : 'Avaliar Atendimento';

    // Reset fields
    setTimeout(() => {
        setRating(currentRating);
        document.getElementById('feedback-notes').value = existingNotes || '';
        modal.classList.add('active'); // Use CSS class for transition
        modal.style.display = 'flex';
    }, 10);
}

function updatePrivacyEmote() {
    const checkbox = document.getElementById('feedback-public');
    const emoteSpan = document.getElementById('privacy-emote-display');
    const textSpan = document.getElementById('privacy-text-display');

    if (checkbox.checked) {
        emoteSpan.className = 'privacy-emote fa-solid fa-earth-americas'; // Earth for public
        emoteSpan.textContent = ''; // Clear emoji text
        textSpan.textContent = 'Visível para todos.';
        textSpan.style.color = 'var(--success)';
    } else {
        emoteSpan.className = 'privacy-emote fa-solid fa-lock'; // Lock for private
        emoteSpan.textContent = ''; // Clear emoji text
        textSpan.textContent = 'Oculto (somente para você)';
        textSpan.style.color = 'var(--text-secondary)';
    }
}

// New helper to view single story from history
function openSingleStoryViewer(url, type, barberName, dateStr, barberAvatar) {
    if (!url) return;

    // Mock a story group structure for the showStory function logic, or just display directly
    // Let's reuse existing modal structure
    const modal = document.getElementById('story-viewer-modal');
    modal.style.display = 'flex';

    document.getElementById('story-barber-name').textContent = barberName || 'Barbeiro';
    document.getElementById('story-barber-avatar').src = barberAvatar || '/static/img/default-avatar.png';
    document.getElementById('story-time').textContent = new Date(dateStr).toLocaleDateString();

    const container = document.getElementById('story-media-container');
    container.innerHTML = '';

    // Hide progress bars since it's single view
    document.getElementById('story-progress-bars').innerHTML = '';

    if (type === 'video') {
        const video = document.createElement('video');
        video.src = url;
        video.autoplay = true;
        video.playsInline = true;
        video.controls = true; // Allow controls for history view
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        container.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = url;
        container.appendChild(img);
    }
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function setRating(rating) {
    currentRating = rating;
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-${i}`);
        if (i <= rating) {
            star.className = 'fa-solid fa-star active';
        } else {
            star.className = 'fa-regular fa-star';
        }
    }
}

async function submitFeedback() {
    if (!currentFeedbackApptId) return;
    if (currentRating === 0) {
        alert("Por favor, selecione uma nota.");
        return;
    }

    const notes = document.getElementById('feedback-notes').value;
    const isPublic = document.getElementById('feedback-public').checked;
    const token = getCustomerToken();

    try {
        const res = await fetch(`/customer/feedback?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appointment_id: currentFeedbackApptId,
                rating: currentRating,
                notes: notes,
                is_public: isPublic
            })
        });

        if (res.ok) {
            closeFeedbackModal();
            // Refresh history
            openHistoryModal();
            // Optional: show thank you
            await showAlertModal('Obrigado pela sua avaliação!');
        } else {
            alert('Erro ao enviar avaliação.');
        }
    } catch (e) {
        alert('Erro de conexão.');
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
let isStoryPaused = false;
let storyRemainingTime = 0;

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
    isStoryPaused = false;
    updatePauseButtonIcon();

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
    isStoryPaused = false;
}

function toggleStoryPause() {
    const btn = document.getElementById('story-pause-btn');
    const video = document.querySelector('#story-content video');
    const progressBar = document.querySelectorAll('.story-progress-fill')[currentStoryIndex];

    if (isStoryPaused) {
        // RESUME
        isStoryPaused = false;
        if (video) {
            video.play();
        } else {
            // Resume image timer
            storyStartTime = Date.now();
            storyTimer = setTimeout(nextStory, storyRemainingTime);

            // Resume animation
            if (progressBar) {
                progressBar.style.transition = `width ${storyRemainingTime}ms linear`;
                progressBar.style.width = '100%';
            }
        }
    } else {
        // PAUSE
        isStoryPaused = true;
        if (video) {
            video.pause();
        } else {
            // Pause image timer
            clearTimeout(storyTimer);
            const elapsed = Date.now() - storyStartTime;
            storyRemainingTime = Math.max(0, storyRemainingTime - elapsed);

            // Pause animation
            if (progressBar) {
                const computedStyle = window.getComputedStyle(progressBar);
                const width = computedStyle.getPropertyValue('width');
                progressBar.style.transition = 'none';
                progressBar.style.width = width;
            }
        }
    }
    updatePauseButtonIcon();
}

function updatePauseButtonIcon() {
    const btnIcon = document.querySelector('#story-pause-btn i');
    if (btnIcon) {
        btnIcon.className = isStoryPaused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
    }
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
    // Reset pause state on new story
    isStoryPaused = false;
    updatePauseButtonIcon();

    const story = stories[index];
    const container = document.getElementById('story-media-container');
    const timeLabel = document.getElementById('story-time');

    // Update progress bars
    renderProgressBars(stories.length, index);

    // Format relative time (simple)
    const date = new Date(story.created_at);
    timeLabel.textContent = date.toLocaleDateString();

    container.innerHTML = '';

    // Add Feedback Overlay if data exists
    if (story.customer_name && (story.feedback || story.rating)) {
        const overlay = document.createElement('div');
        overlay.className = 'story-feedback-overlay';

        let starsHtml = '';
        if (story.rating) {
            starsHtml = '<div>';
            for (let i = 1; i <= 5; i++) {
                if (i <= story.rating) starsHtml += '<i class="fa-solid fa-star feedback-stars"></i>';
                else starsHtml += '<i class="fa-regular fa-star feedback-stars"></i>';
            }
            starsHtml += '</div>';
        }

        overlay.innerHTML = `
            <div class="feedback-user">
                <span>${story.customer_name}</span>
                ${starsHtml}
            </div>
            ${story.feedback ? `<p class="feedback-text">"${story.feedback}"</p>` : ''}
        `;
        container.appendChild(overlay);
    }

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
        // Handle video metadata for precise progress
        video.onloadedmetadata = () => {
            startProgress(video.duration * 1000);
        };
        // Fallback if metadata already loaded or oncanplay
        if (video.readyState >= 1) {
            startProgress(video.duration * 1000);
        }

        container.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = story.media_url;
        container.appendChild(img);

        storyRemainingTime = STORY_DURATION;
        storyStartTime = Date.now();
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


let currentStep = 1;

function goToStep(step) {
    currentStep = step; // Track current step
    document.querySelectorAll('.step').forEach(el => el.style.display = 'none');

    // Add fade-in animation reset (optional, but good for UX)
    const nextStep = document.getElementById(`step-${step}`);
    nextStep.style.display = 'block';

    // Global Back Button Logic
    const backBtn = document.getElementById('global-back-btn');
    if (backBtn) {
        if (step > 1) {
            backBtn.style.display = 'flex'; // Use flex to center icon
        } else {
            backBtn.style.display = 'none';
        }
    }

    if (step === 4) {
        updateCustomerUI();
        document.getElementById("confirm-barber-name").innerText = selectedBarber ? `✂️ ${selectedBarber.name}` : '';
        document.getElementById("confirm-service-name").innerText = `${selectedService.name} (R$ ${typeof selectedService.price === 'number' ? selectedService.price.toFixed(2) : selectedService.price})`;
        document.getElementById("confirm-date-time").innerText = `📅 ${formatDateBR(selectedDate)} às ${selectedSlot}`;
    }
}

function goBack() {
    // If going back from Confirm (Step 4) to Slots (Step 3), clear the selection
    if (currentStep === 4) {
        selectedSlot = null;
        // Reload slots to refresh UI (remove selected state)
        loadSlots();
    }

    if (currentStep > 1) {
        goToStep(currentStep - 1);
    }
}

function formatDateBR(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

let slotsPollInterval = null;
let lastLoadedSlotsJSON = '';
let lastSelectedSlot = null;

// Helper to get formatted date string (YYYY-MM-DD)
function getFormattedDate(date) {
    return date.toISOString().split('T')[0];
}

async function loadSlots() {
    if (!selectedService) return;
    let dateInput = document.getElementById("booking-date");
    let dateStr = dateInput.value;

    // Initial validation (if empty, set to today)
    if (!dateStr) {
        const today = getFormattedDate(new Date());
        dateInput.value = today;
        dateStr = today;
    }
    selectedDate = dateStr;

    const container = document.getElementById("slots-container");
    // Show loading only if container is empty (first load)
    if (!container.innerHTML.trim() || container.innerHTML.includes('Carregando')) {
        container.innerHTML = '<p>Carregando...</p>';
    }

    // Clear previous poll
    if (slotsPollInterval) clearInterval(slotsPollInterval);

    const fetchSlots = async () => {
        try {
            let endpoint = `/availability?date_str=${dateStr}&barber_id=${selectedBarber.id}`;
            if (selectedService.isBarberService) {
                endpoint += `&barber_service_id=${selectedService.id}`;
            } else {
                endpoint += `&service_id=${selectedService.id}`;
            }

            const res = await fetch(endpoint);
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();

            // Logic to disable "Today" if empty and we are looking at today for the first time?
            // User requested: "quando não tiver horarios disponiveis, desabilite do calendario o dia atual também."
            // We can check if dateStr is today, and slots are empty.
            // But if we disable it, we must switch to tomorrow.

            const todayStr = getFormattedDate(new Date());
            if (dateStr === todayStr && data.slots.length === 0) {
                // Check if we haven't already disabled it (to avoid loop)
                const tomorrowElement = new Date();
                tomorrowElement.setDate(tomorrowElement.getDate() + 1);
                const tomorrowStr = getFormattedDate(tomorrowElement);

                // Update min to tomorrow
                dateInput.min = tomorrowStr;

                // If the user currently selected today, switch to tomorrow and reload
                if (dateInput.value === todayStr) {
                    dateInput.value = tomorrowStr;
                    // Recursive call to load slots for tomorrow immediately
                    // But we must update dateStr variable for THIS execution or just return unique recall
                    selectedDate = tomorrowStr;
                    loadSlots();
                    return false; // Signal to abort this execution's polling
                }
            } else if (dateStr === todayStr && data.slots.length > 0) {
                // Ensure min is today if slots exist
                dateInput.min = todayStr;
            }

            // Optimization: Data-based comparison to avoid DOM thrashing
            // Comparing HTML strings against browser DOM is unreliable (browser changes quotes/specs).
            const currentSlotsJSON = JSON.stringify(data.slots);

            // Check if we can skip render
            // We need to verify if slots changed OR if selection state changed
            if (lastLoadedSlotsJSON === currentSlotsJSON && lastSelectedSlot === selectedSlot) {
                return true; // No visual change needed
            }

            let newHTML = '';
            if (data.slots.length === 0) {
                newHTML = '<p style="grid-column: 1/-1; text-align: center;">Nenhum horário disponível para esta data.</p>';
            } else {
                newHTML = data.slots.map(slot => `
                    <button class="btn slot-btn ${slot === selectedSlot ? 'selected-slot' : ''}" 
                            style="${slot === selectedSlot ? 'background: var(--accent); color: var(--text-primary);' : ''}"
                            onclick="selectSlot('${slot}')">${slot}</button>
                `).join('');
            }

            container.innerHTML = newHTML;

            // Update cache
            lastLoadedSlotsJSON = currentSlotsJSON;
            lastSelectedSlot = selectedSlot;

            return true; // Execution successful (didn't redirect)

        } catch (e) {
            container.innerHTML = '<p style="color: var(--danger);">Erro ao carregar horários.</p>';
            return false;
        }
    };

    const success = await fetchSlots();
    // Only start polling if this execution was successful and didn't redirect
    if (success) {
        // Poll every 5 seconds to keep fresh
        slotsPollInterval = setInterval(fetchSlots, 5000);
    }
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
