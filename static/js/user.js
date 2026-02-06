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
    if (dropdown) dropdown.classList.toggle('show');
}

function closeUserMenu() {
    const dropdown = document.getElementById('user-menu-dropdown');
    if (dropdown) dropdown.classList.remove('show');
}

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
    const container = document.getElementById('user-menu-container');
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
    const menuCustomerUsername = document.getElementById('menu-customer-username');

    if (isCustomerLoggedIn() && currentCustomer) {
        if (guestMenu) guestMenu.style.display = 'none';
        if (loggedMenu) loggedMenu.style.display = 'block';
        if (menuIcon) menuIcon.className = 'fa-solid fa-user-check';
        if (menuCustomerUsername) menuCustomerUsername.textContent = currentCustomer.username;

        if (loggedInfo) {
            loggedInfo.style.display = 'block';
            document.getElementById('logged-customer-username').textContent = currentCustomer.username;
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

// =========== Auth Step Functions ===========

let previousStep = null; // Track which step we came from

function showAuthStep() {
    // Hide all other steps including history
    const allSteps = ['step-1', 'step-2', 'step-3', 'step-4', 'step-success', 'step-history'];
    allSteps.forEach(id => {
        const step = document.getElementById(id);
        if (step && step.style.display !== 'none') {
            previousStep = id;
        }
        if (step) step.style.display = 'none';
    });
    
    // Show auth step
    const authStep = document.getElementById('step-auth');
    if (authStep) {
        authStep.style.display = 'block';
        // Reset form
        document.getElementById('auth-form').reset();
        document.getElementById('register-fields').classList.remove('show');
        document.getElementById('auth-btn-text').textContent = 'Entrar';
        document.getElementById('auth-title').innerHTML = '<i class="fa-solid fa-user"></i> Entrar';
        clearAuthErrors();
    }
    // Show back button
    const backBtn = document.getElementById('global-back-btn');
    if (backBtn) backBtn.classList.add('show');
    closeUserMenu();
}

function hideAuthStep() {
    const authStep = document.getElementById('step-auth');
    if (authStep) authStep.style.display = 'none';
}

function toggleRegisterMode(checkbox) {
    const registerFields = document.getElementById('register-fields');
    const btnText = document.getElementById('auth-btn-text');
    const title = document.getElementById('auth-title');
    
    if (checkbox.checked) {
        registerFields.classList.add('show');
        btnText.textContent = 'Criar Conta';
        title.innerHTML = '<i class="fa-solid fa-user-plus"></i> Criar Conta';
    } else {
        registerFields.classList.remove('show');
        btnText.textContent = 'Entrar';
        title.innerHTML = '<i class="fa-solid fa-user"></i> Entrar';
    }
}

// =========== Validation Functions ===========

function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorSpan = document.getElementById(inputId + '-error');
    if (input) {
        input.classList.add('has-error');
    }
    if (errorSpan) {
        errorSpan.textContent = message;
    }
}

function clearFieldError(inputId) {
    const input = document.getElementById(inputId);
    const errorSpan = document.getElementById(inputId + '-error');
    if (input) {
        input.classList.remove('has-error');
    }
    if (errorSpan) {
        errorSpan.textContent = '';
    }
}

function clearAuthErrors() {
    ['auth-username', 'auth-password', 'auth-phone'].forEach(id => clearFieldError(id));
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) errorDiv.style.display = 'none';
}

function showAuthError(message) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'flex';
    }
}

function validateAuthForm(isRegister) {
    clearAuthErrors();
    let isValid = true;
    
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    
    // Username validation
    if (!username) {
        showFieldError('auth-username', 'Username é obrigatório');
        isValid = false;
    } else if (username.length < 3) {
        showFieldError('auth-username', 'Username deve ter pelo menos 3 caracteres');
        isValid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showFieldError('auth-username', 'Apenas letras, números e _');
        isValid = false;
    }
    
    // Password validation
    if (!password) {
        showFieldError('auth-password', 'Senha é obrigatória');
        isValid = false;
    } else if (isRegister && password.length < 6) {
        showFieldError('auth-password', 'Mínimo 6 caracteres');
        isValid = false;
    }
    
    return isValid;
}

// =========== Auth Submit Handler ===========

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const isRegister = document.getElementById('auth-is-register').checked;
    
    if (!validateAuthForm(isRegister)) {
        return;
    }
    
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const phone = document.getElementById('auth-phone').value || null;
    
    const btn = document.getElementById('auth-submit-btn');
    const btnText = document.getElementById('auth-btn-text');
    const spinner = document.getElementById('auth-btn-spinner');
    
    // Show loading state
    btn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    
    try {
        const endpoint = isRegister ? '/customer/register' : '/customer/login';
        const body = isRegister 
            ? { username, password, phone }
            : { username, password };
        
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (!res.ok) {
            const error = await res.json();
            if (res.status === 429) {
                showAuthError(error.detail || 'Muitas tentativas. Aguarde um momento.');
            } else {
                showAuthError(error.detail || 'Erro ao processar requisição');
            }
            return;
        }
        
        const data = await res.json();
        localStorage.setItem(CUSTOMER_TOKEN_KEY, data.access_token);
        currentCustomer = data.customer;

        hideAuthStep();
        updateCustomerUI();
        
    } catch (e) {
        showAuthError('Erro de conexão. Tente novamente.');
    } finally {
        btn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
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

let previousHistoryStep = null;

async function showHistoryStep() {
    const token = getCustomerToken();
    if (!token) return;

    // Hide all other steps and track previous
    const allSteps = ['step-1', 'step-2', 'step-3', 'step-4', 'step-success', 'step-auth'];
    allSteps.forEach(id => {
        const step = document.getElementById(id);
        if (step && step.style.display !== 'none') {
            previousHistoryStep = id;
        }
        if (step) step.style.display = 'none';
    });

    // Show history step
    const historyStep = document.getElementById('step-history');
    if (historyStep) historyStep.style.display = 'block';
    
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '<p style="color: var(--text-secondary);">Carregando...</p>';

    // Show back button
    const backBtn = document.getElementById('global-back-btn');
    if (backBtn) backBtn.classList.add('show');

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
        historyList.innerHTML = `
            <div class="history-empty-state">
                <i class="fa-solid fa-calendar-xmark"></i>
                <h3>Nenhum agendamento encontrado</h3>
                <p>Você ainda não possui agendamentos para esta data.</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = list.map((h, index) => {
        const isFuture = new Date(h.start_time) > new Date();
        const canCancel = isFuture && h.status === 'scheduled';
        const statusMap = {
            'scheduled': { label: 'Agendado', color: 'var(--success)', bg: 'rgba(34, 197, 94, 0.1)' },
            'completed': { label: 'Concluído', color: 'var(--accent)', bg: 'var(--accent-light)' },
            'no_show': { label: 'Não Compareceu', color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.1)' },
            'cancelled': { label: 'Cancelado', color: 'var(--text-secondary)', bg: 'rgba(128, 128, 128, 0.1)' }
        };
        const st = statusMap[h.status] || { label: h.status, color: 'var(--text-secondary)', bg: 'var(--bg-secondary)' };

        // Format date and time
        const date = new Date(h.start_time);
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const weekDay = date.toLocaleDateString('pt-BR', { weekday: 'long' });

        // Build rating stars HTML
        let ratingStarsHtml = '';
        if (h.rating) {
            for (let i = 1; i <= 5; i++) {
                ratingStarsHtml += i <= h.rating
                    ? '<i class="fa-solid fa-star"></i>'
                    : '<i class="fa-regular fa-star"></i>';
            }
        }

        // Build media preview HTML
        let mediaPreviewHtml = '';
        if (h.media_url) {
            const mediaTag = h.media_type === 'video'
                ? `<video src="${h.media_url}" style="width: 100%; height: auto; display: block;"></video>`
                : `<img src="${h.media_url}" alt="Foto do corte">`;

            mediaPreviewHtml = `
                <div class="history-media-preview" onclick="openSingleStoryViewer('${h.media_url}', '${h.media_type}', '${h.barber_name}', '${h.start_time}', '${h.barber_avatar || ''}')">
                    ${mediaTag}
                    <div class="history-media-overlay">
                        <i class="fa-solid fa-expand"></i>
                    </div>
                </div>
            `;
        }

        // Build rating/feedback section (always visible for completed appointments)
        let ratingFeedbackHtml = '';
        if (h.status === 'completed') {
            // Small media thumbnail
            let mediaThumbnailHtml = '';
            if (h.media_url) {
                const mediaTag = h.media_type === 'video'
                    ? `<video src="${h.media_url}"></video>`
                    : `<img src="${h.media_url}" alt="Foto do corte">`;

                mediaThumbnailHtml = `
                    <div class="thumb-image" onclick="openSingleStoryViewer('${h.media_url}', '${h.media_type}', '${h.barber_name}', '${h.start_time}', '${h.barber_avatar || ''}')" title="Clique para ver em tela cheia">
                        ${mediaTag}
                        <div class="thumb-overlay">
                            <i class="fa-solid fa-expand"></i>
                        </div>
                    </div>
                `;
            }

            ratingFeedbackHtml = `
                <div class="card-section">
                    <div class="row-start gap-lg">
                        ${mediaThumbnailHtml}
                        
                        <div class="row-start gap-md" style="flex: 1; min-width: 0;">
                            <div class="column gap-md" style="flex: 0 0 auto;">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label>Avaliação</label>
                                    <div class="star-rating-input" style="justify-content: flex-start;">
                                        <i class="fa-regular fa-star" onclick="setInlineRating(${h.id}, 1)" id="inline-star-${h.id}-1"></i>
                                        <i class="fa-regular fa-star" onclick="setInlineRating(${h.id}, 2)" id="inline-star-${h.id}-2"></i>
                                        <i class="fa-regular fa-star" onclick="setInlineRating(${h.id}, 3)" id="inline-star-${h.id}-3"></i>
                                        <i class="fa-regular fa-star" onclick="setInlineRating(${h.id}, 4)" id="inline-star-${h.id}-4"></i>
                                        <i class="fa-regular fa-star" onclick="setInlineRating(${h.id}, 5)" id="inline-star-${h.id}-5"></i>
                                    </div>
                                </div>

                                ${h.media_url ? `
                                <div class="privacy-toggle-wrapper" onclick="document.getElementById('inline-feedback-public-${h.id}').click()" style="margin: 0; justify-content: flex-start;">
                                    <input type="checkbox" id="inline-feedback-public-${h.id}" class="privacy-checkbox" ${h.story_is_public !== false ? 'checked' : ''} onchange="updateInlinePrivacyEmote(${h.id})">
                                    <label class="privacy-label" for="inline-feedback-public-${h.id}">
                                        <i id="inline-privacy-emote-${h.id}" class="privacy-emote fa-solid fa-earth-americas"></i>
                                        <span id="inline-privacy-text-${h.id}" class="privacy-text" style="font-size: 0.8rem;">Visível para todos</span>
                                    </label>
                                </div>
                                ` : ''}
                            </div>
                            
                            <div class="form-group textarea-column" style="margin-bottom: 0; flex: 1; min-width: 200px;">
                                <label for="inline-feedback-notes-${h.id}">Comentário</label>
                                <textarea 
                                    id="inline-feedback-notes-${h.id}" 
                                    placeholder="Deixe um comentário sobre o atendimento (opcional)..." 
                                    style="height: 100%; min-height: 80px;"
                                >${h.feedback_notes || ''}</textarea>
                            </div>
                        </div>
                        
                        ${canCancel ? `
                        <div class="actions-column">
                            <button class="btn btn-primary" onclick="rescheduleAppointment(${h.id})">
                                <i class="fa-solid fa-calendar-days"></i> Reagendar
                            </button>
                            <button class="btn" style="background: var(--danger); color: white;" onclick="cancelMyAppointment(${h.id})">
                                <i class="fa-solid fa-xmark"></i> Cancelar
                            </button>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; margin-top: 0.75rem;">
                        <button class="btn btn-primary" onclick="submitInlineFeedback(${h.id})" style="min-width: 120px;">
                            <i class="fa-solid fa-check"></i> Salvar
                        </button>
                    </div>
                </div>
            `;
        }

        // Build actions HTML for non-completed appointments
        let actionsHtml = '';
        if (canCancel && h.status !== 'completed') {
            actionsHtml = `
                <div class="history-actions">
                    <button class="btn btn-primary" onclick="rescheduleAppointment(${h.id})">
                        <i class="fa-solid fa-calendar-days"></i> Reagendar
                    </button>
                    <button class="btn" style="background: var(--danger); color: white;" onclick="cancelMyAppointment(${h.id})">
                        <i class="fa-solid fa-xmark"></i> Cancelar
                    </button>
                </div>
            `;
        }

        return `
            <div class="history-card" id="history-card-${h.id}">
                <div class="history-card-header" onclick="toggleHistoryCard(${h.id})">
                    <div class="history-summary-left">
                        <div class="history-icon">
                            <i class="fa-solid fa-scissors"></i>
                        </div>
                        <div class="history-summary-info">
                            <h4>${dateStr} • ${timeStr}</h4>
                            <p>
                                <i class="fa-solid fa-user-tie"></i> ${h.barber_name || 'Barbeiro'}
                                <span>•</span>
                                <i class="fa-solid fa-cut"></i> ${h.service_name || 'Serviço'}
                            </p>
                        </div>
                    </div>
                    <div class="history-summary-right">
                        <span class="history-status-badge" style="color: ${st.color}; background: ${st.bg};">
                            ${st.label}
                        </span>
                        <div class="history-expand-icon">
                            <i class="fa-solid fa-chevron-down"></i>
                        </div>
                    </div>
                </div>
                
                <div class="history-card-body">
                    ${ratingFeedbackHtml}
                    
                    <!-- Toggle Details Button -->
                    <div class="details-toggle-btn" onclick="toggleHistoryDetails(${h.id})">
                        <span>Mais detalhes</span>
                        <i class="fa-solid fa-chevron-down" id="details-arrow-${h.id}"></i>
                    </div>
                    
                    <!-- Collapsible Details Section -->
                    <div class="history-details-section" id="details-section-${h.id}">
                        <div class="history-details-grid">
                            <div class="history-detail-item">
                                <span class="history-detail-label">Data</span>
                                <span class="history-detail-value">${dateStr}</span>
                            </div>
                            <div class="history-detail-item">
                                <span class="history-detail-label">Horário</span>
                                <span class="history-detail-value">${timeStr}</span>
                            </div>
                            <div class="history-detail-item">
                                <span class="history-detail-label">Dia da Semana</span>
                                <span class="history-detail-value" style="text-transform: capitalize;">${weekDay}</span>
                            </div>
                            <div class="history-detail-item">
                                <span class="history-detail-label">Profissional</span>
                                <span class="history-detail-value">${h.barber_name || 'Barbeiro'}</span>
                            </div>
                            <div class="history-detail-item">
                                <span class="history-detail-label">Serviço</span>
                                <span class="history-detail-value">${h.service_name || 'Serviço'}</span>
                            </div>
                            <div class="history-detail-item">
                                <span class="history-detail-label">Duração</span>
                                <span class="history-detail-value">${h.duration_minutes || 30} min</span>
                            </div>
                            ${h.price ? `
                            <div class="history-detail-item">
                                <span class="history-detail-label">Valor</span>
                                <span class="history-detail-value">R$ ${parseFloat(h.price).toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div class="history-detail-item">
                                <span class="history-detail-label">Status</span>
                                <span class="history-detail-value" style="color: ${st.color};">${st.label}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');
}

// Toggle history card expansion
function toggleHistoryCard(id) {
    const card = document.getElementById(`history-card-${id}`);
    if (!card) return;

    const wasExpanded = card.classList.contains('expanded');
    card.classList.toggle('expanded');

    // Initialize rating when expanding for the first time
    if (!wasExpanded && card.classList.contains('expanded')) {
        const appointment = currentHistory.find(h => h.id === id);
        if (appointment && appointment.status === 'completed') {
            // Set existing rating
            setInlineRating(id, appointment.rating || 0);

            // Update privacy toggle if media exists
            if (appointment.media_url) {
                updateInlinePrivacyEmote(id);
            }
        }
    }
}

// Toggle history details section
function toggleHistoryDetails(id) {
    const detailsSection = document.getElementById(`details-section-${id}`);
    const arrow = document.getElementById(`details-arrow-${id}`);

    if (!detailsSection || !arrow) return;

    const isExpanding = !detailsSection.classList.contains('expanded');

    detailsSection.classList.toggle('expanded');
    arrow.classList.toggle('rotated');

    // Scroll suave para mostrar o conteúdo expandido
    if (isExpanding) {
        // Aguarda animação de 400ms + 50ms de margem
        setTimeout(() => {
            const card = document.getElementById(`history-card-${id}`);
            if (card) {
                const cardBody = card.querySelector('.history-card-body');

                if (cardBody && detailsSection) {
                    // Scroll para a seção de detalhes dentro do card-body
                    const detailsRect = detailsSection.getBoundingClientRect();
                    const bodyRect = cardBody.getBoundingClientRect();

                    // Calcula o offset relativo ao card-body
                    const scrollOffset = detailsRect.top - bodyRect.top + cardBody.scrollTop - 20;

                    cardBody.scrollTo({
                        top: scrollOffset,
                        behavior: 'smooth'
                    });
                }
            }
        }, 100); // Aguarda animação de 400ms + 50ms de margem
    }
}

// Toggle inline feedback form
function toggleFeedbackForm(apptId, show) {
    const feedbackSection = document.getElementById(`feedback-section-${apptId}`);
    const ratingDisplay = document.getElementById(`rating-display-${apptId}`);
    const actionsDiv = document.getElementById(`rating-actions-${apptId}`);

    if (!feedbackSection) return;

    if (show) {
        // Show form, hide display and actions
        feedbackSection.style.display = 'block';
        if (ratingDisplay) ratingDisplay.style.display = 'none';
        if (actionsDiv) actionsDiv.style.display = 'none';

        // Get current appointment data
        const appointment = currentHistory.find(h => h.id === apptId);
        if (appointment) {
            // Set existing rating
            setInlineRating(apptId, appointment.rating || 0);

            // Update privacy toggle if media exists
            if (appointment.media_url) {
                updateInlinePrivacyEmote(apptId);
            }
        }
    } else {
        // Hide form, show display and actions
        feedbackSection.style.display = 'none';
        if (ratingDisplay) ratingDisplay.style.display = 'flex';
        if (actionsDiv) actionsDiv.style.display = 'flex';
    }
}

// Set inline rating stars
let inlineRatings = {}; // Store ratings per appointment

function setInlineRating(apptId, rating) {
    inlineRatings[apptId] = rating;

    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`inline-star-${apptId}-${i}`);
        if (star) {
            if (i <= rating) {
                star.className = 'fa-solid fa-star active';
            } else {
                star.className = 'fa-regular fa-star';
            }
        }
    }
}

// Update inline privacy emote
function updateInlinePrivacyEmote(apptId) {
    const checkbox = document.getElementById(`inline-feedback-public-${apptId}`);
    const emoteSpan = document.getElementById(`inline-privacy-emote-${apptId}`);
    const textSpan = document.getElementById(`inline-privacy-text-${apptId}`);

    if (!checkbox || !emoteSpan || !textSpan) return;

    if (checkbox.checked) {
        emoteSpan.className = 'privacy-emote fa-solid fa-earth-americas';
        textSpan.textContent = 'Visível para todos';
        textSpan.style.color = 'var(--success)';
    } else {
        emoteSpan.className = 'privacy-emote fa-solid fa-lock';
        textSpan.textContent = 'Oculto (somente para você)';
        textSpan.style.color = 'var(--text-secondary)';
    }
}

// Submit inline feedback
async function submitInlineFeedback(apptId) {
    const rating = inlineRatings[apptId] || 0;

    if (rating === 0) {
        await showAlertModal('Por favor, selecione uma nota de 1 a 5 estrelas.');
        return;
    }

    const notesTextarea = document.getElementById(`inline-feedback-notes-${apptId}`);
    const notes = notesTextarea ? notesTextarea.value : '';

    // Check if media exists for privacy toggle
    const publicCheckbox = document.getElementById(`inline-feedback-public-${apptId}`);
    const isPublic = publicCheckbox ? publicCheckbox.checked : true;

    const token = getCustomerToken();
    if (!token) {
        await showAlertModal('Você precisa estar logado para avaliar.');
        return;
    }

    try {
        const res = await fetch(`/customer/feedback?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appointment_id: apptId,
                rating: rating,
                notes: notes,
                is_public: isPublic
            })
        });

        if (res.ok) {
            await showAlertModal('Avaliação salva com sucesso!');
            // Refresh history to show updated rating
            openHistoryModal();
        } else {
            const error = await res.json();
            await showAlertModal('Erro ao salvar avaliação: ' + (error.detail || 'Erro desconhecido'));
        }
    } catch (e) {
        console.error('Error submitting feedback:', e);
        await showAlertModal('Erro de conexão ao salvar avaliação.');
    }
}
// =========== History Calendar Functions ===========

let historyCalendarMonth = new Date().getMonth();
let historyCalendarYear = new Date().getFullYear();
let historySelectedDate = null;

function toggleHistoryCalendarDropdown() {
    const dropdown = document.getElementById('history-calendar-dropdown');
    if (dropdown.classList.contains('show')) {
        closeHistoryCalendarDropdown();
    } else {
        dropdown.classList.add('show');
        renderHistoryCalendar();
    }
}

function closeHistoryCalendarDropdown() {
    const dropdown = document.getElementById('history-calendar-dropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// Close history calendar when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('history-calendar-dropdown');
    const calendarBtn = e.target.closest('.icon-btn[onclick*="toggleHistoryCalendarDropdown"]');
    const calendarDropdown = e.target.closest('#history-calendar-dropdown');
    const quickBtn = e.target.closest('.quick-date-btn');
    
    if (dropdown && dropdown.classList.contains('show') && !calendarBtn && !calendarDropdown && !quickBtn) {
        closeHistoryCalendarDropdown();
    }
});

function getAppointmentDates() {
    // Get unique dates from history that have appointments
    if (!currentHistory || currentHistory.length === 0) return new Set();
    
    const dates = new Set();
    currentHistory.forEach(h => {
        const dateStr = h.start_time.split('T')[0];
        dates.add(dateStr);
    });
    return dates;
}

function renderHistoryCalendar() {
    const daysContainer = document.getElementById('history-calendar-days');
    const monthYearLabel = document.getElementById('history-calendar-month-year');
    
    if (!daysContainer || !monthYearLabel) return;
    
    // Update month/year label
    const monthNames = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    monthYearLabel.textContent = `${monthNames[historyCalendarMonth]} de ${historyCalendarYear}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(historyCalendarYear, historyCalendarMonth, 1);
    const lastDay = new Date(historyCalendarYear, historyCalendarMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    // Get today's date and appointment dates
    const today = new Date();
    const todayStr = getFormattedDate(today);
    const appointmentDates = getAppointmentDates();
    
    // Build calendar HTML
    let html = '';
    
    // Empty cells for days before the first day of month
    for (let i = 0; i < startingDay; i++) {
        html += '<div class="calendar-day other-month"></div>';
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(historyCalendarYear, historyCalendarMonth, day);
        const dateStr = getFormattedDate(date);
        const dayOfWeek = date.getDay();
        
        let classes = ['calendar-day'];
        const hasAppointment = appointmentDates.has(dateStr);
        
        // Check if weekend
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            classes.push('weekend');
        }
        
        // Check if today
        if (dateStr === todayStr) {
            classes.push('today');
        }
        
        // Check if selected
        if (dateStr === historySelectedDate) {
            classes.push('selected');
        }
        
        // Check if has appointment
        if (hasAppointment) {
            classes.push('has-appointment');
        } else {
            // Disable days without appointments
            classes.push('disabled');
        }
        
        const clickHandler = hasAppointment ? `onclick="selectHistoryDate('${dateStr}')"` : '';
        
        html += `<div class="${classes.join(' ')}" ${clickHandler}>${day}</div>`;
    }
    
    daysContainer.innerHTML = html;
}

function navigateHistoryMonth(direction) {
    historyCalendarMonth += direction;
    
    if (historyCalendarMonth > 11) {
        historyCalendarMonth = 0;
        historyCalendarYear++;
    } else if (historyCalendarMonth < 0) {
        historyCalendarMonth = 11;
        historyCalendarYear--;
    }
    
    renderHistoryCalendar();
}

function selectHistoryDate(dateStr) {
    historySelectedDate = dateStr;
    document.getElementById('history-date-filter').value = dateStr;
    
    renderHistoryCalendar();
    closeHistoryCalendarDropdown();
    filterHistory();
}

function filterHistoryToday() {
    const today = new Date();
    const dateStr = getFormattedDate(today);
    
    historyCalendarMonth = today.getMonth();
    historyCalendarYear = today.getFullYear();
    historySelectedDate = dateStr;
    
    document.getElementById('history-date-filter').value = dateStr;
    renderHistoryCalendar();
    filterHistory();
}

function filterHistoryTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = getFormattedDate(tomorrow);
    
    historyCalendarMonth = tomorrow.getMonth();
    historyCalendarYear = tomorrow.getFullYear();
    historySelectedDate = dateStr;
    
    document.getElementById('history-date-filter').value = dateStr;
    renderHistoryCalendar();
    filterHistory();
}

function clearHistoryFilter() {
    historySelectedDate = null;
    document.getElementById('history-date-filter').value = '';
    
    renderHistoryCalendar();
    closeHistoryCalendarDropdown();
    renderHistory(currentHistory);
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
        const token = getCustomerToken();
        const url = token ? `/stories?token=${token}` : '/stories';
        const res = await fetch(url);

        if (res.ok) {
            const data = await res.json();
            // Process stories
            data.forEach(group => {
                storiesData[group.barber_id] = {
                    ...group,
                    viewed: false
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

    // Refresh stories to update counts if we reopen
    fetchStories();
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
        currentStoryIndex = 0;
        return;
    }

    currentStoryIndex = index;
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

    // Render Stats and Reactions
    renderStoryStats(story);

    // Mark as viewed
    markStoryAsViewed(story.id);

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
        video.onloadedmetadata = () => {
            startProgress(video.duration * 1000);
        };
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

function renderStoryStats(story) {
    const viewCountEl = document.getElementById('story-view-count');
    if (viewCountEl) viewCountEl.innerText = story.view_count || 0;

    // Update buttons
    const reactions = ['like', 'dislike', 'love'];
    const emojis = { 'like': '👍', 'dislike': '👎', 'love': '❤️' };
    const icons = { 'like': 'fa-thumbs-up', 'dislike': 'fa-thumbs-down', 'love': 'fa-heart' };

    reactions.forEach(type => {
        const btn = document.getElementById(`btn-react-${type}`);
        if (!btn) return;

        const countSpan = btn.querySelector('.count');
        const count = story.reaction_counts ? (story.reaction_counts[type] || 0) : 0;
        countSpan.innerText = count;

        // Active state
        if (story.user_reaction === type) {
            btn.classList.add('active', type);
            // Replace icon with solid if needed, but fontawesome handles it
        } else {
            btn.classList.remove('active', 'like', 'dislike', 'love'); // remove all specific active classes
        }

        // Bind click with closure to capture story
        btn.onclick = (e) => {
            e.stopPropagation(); // prevent pause toggle
            reactToStory(story.id, type, e);
        };
    });
}

// Debounce view tracking
// Debounce view tracking
let viewTimeout = null;
function markStoryAsViewed(storyId) {
    const token = getCustomerToken();

    // Optimistic Update: Increment view count immediately
    const story = storiesData[currentStoryBarberId].stories.find(s => s.id === storyId);
    if (story) {
        // Increment local data
        story.view_count = (story.view_count || 0) + 1;
        // Update UI
        const viewCountEl = document.getElementById('story-view-count');
        if (viewCountEl) viewCountEl.innerText = story.view_count;
    }

    // Use token if available, else standard IP tracking backend logic works.

    // Avoid double counting in same session ideally, but backend handles inserts.
    // Frontend optimization: check if we just sent it.

    setTimeout(async () => {
        try {
            let url = `/stories/${storyId}/view`;
            if (token) url += `?token=${token}`;
            await fetch(url, { method: 'POST' });
        } catch (e) { }
    }, 500);
}

async function reactToStory(storyId, type) {
    if (!isCustomerLoggedIn()) {
        alert("Você precisa estar logado para reagir!");
        return;
    }

    const story = storiesData[currentStoryBarberId].stories[currentStoryIndex];
    if (story.id !== storyId) return; // Safety check

    // Optimistic Update
    const oldReaction = story.user_reaction;
    let newReaction = type;

    if (oldReaction === type) {
        // Toggle OFF
        newReaction = null;
        story.reaction_counts[type]--;
    } else {
        // Switch or Add
        if (oldReaction) {
            story.reaction_counts[oldReaction]--;
        }
        story.reaction_counts[type] = (story.reaction_counts[type] || 0) + 1;
    }
    story.user_reaction = newReaction;

    renderStoryStats(story);

    if (newReaction) {
        showFloatingReaction(type);
    }

    // Send to API
    const token = getCustomerToken();
    try {
        const res = await fetch(`/stories/${storyId}/react?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction: type })
        });
        if (!res.ok) {
            // Revert on error
            // (Simplified: just alert or silent fail)
        }
    } catch (e) { }
}

function showFloatingReaction(type, event) {
    const container = document.getElementById('reaction-animation-container');
    if (!container) return;

    const emojis = { 'like': '👍', 'dislike': '👎', 'love': '❤️' };
    const emojiChar = emojis[type] || '👍';

    // Spawn Burst
    const count = 8; // Number of particles

    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'floating-reaction';
        el.innerText = emojiChar;

        // Randomize
        const duration = 1000 + Math.random() * 800; // 1s to 1.8s
        const scale = 0.5 + Math.random() * 1.0; // 0.5 to 1.5

        el.style.animationDuration = `${duration}ms`;
        el.style.fontSize = `${1.5 + Math.random()}rem`;
        el.style.zIndex = Math.floor(2020 + i);

        if (event) {
            const rect = container.getBoundingClientRect();
            // Origin
            const baseX = event.clientX - rect.left;
            const baseY = event.clientY - rect.top;

            // Random Spread (-40px to +40px)
            const spreadX = (Math.random() - 0.5) * 60;
            const spreadY = (Math.random() - 0.5) * 60;

            el.style.left = `${baseX + spreadX}px`;
            el.style.top = `${baseY + spreadY}px`;
        } else {
            // Fallback
            const randomX = Math.random() * 80 + 10;
            el.style.left = `${randomX}%`;
            el.style.bottom = '100px';
        }

        container.appendChild(el);

        setTimeout(() => el.remove(), duration);
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
        window.allBarbers = barbers; // Store for lookup
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
            const innerAvatar = b.avatar_url
                ? `<img src="${b.avatar_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`
                : `<div style="width: 100%; height: 100%; border-radius: 50%; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: var(--text-secondary);">
                        <i class="fa-solid fa-user-tie"></i>
                   </div>`;

            const avatarHtml = `
                <div class="${ringClass}" ${hasStories ? `onclick="event.stopPropagation(); openStoryViewer(${b.id})"` : ''} 
                     style="width: 100px; height: 100px; min-width: 100px;">
                    ${innerAvatar}
                </div>
             `;

            // Service list preview (first 3)
            const serviceList = b.services ? b.services.slice(0, 3).map(s => `
                <span style="font-size: 0.75rem; background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary);">
                    <i class="fa-solid ${s.icon || 'fa-scissors'}"></i> ${s.name}
                </span>
            `).join('') : '';
            const moreServices = b.services && b.services.length > 3 ? `<span style="font-size: 0.75rem; color: var(--text-secondary);">+${b.services.length - 3}</span>` : '';

            const instaLink = b.instagram ? `https://instagram.com/${b.instagram.replace('@', '')}` : null;
            const twitterLink = b.twitter ? `https://twitter.com/${b.twitter.replace('@', '')}` : null;
            const emailLink = b.email ? `mailto:${b.email}` : null;
            const phoneDigits = b.phone ? b.phone.replace(/\D/g, '') : '';
            const whatsappLink = (phoneDigits.length >= 10) ? `https://wa.me/55${phoneDigits}` : null;

            return `
            <div class="card barber-card" onclick="selectBarber('${b.id}')" 
                 style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.5rem; padding: 1.5rem; min-width: 100px; max-width: 300px;">
                 ${avatarHtml}
                <div>
                    <h3 style="font-size: 1.1rem; margin-bottom: 0.25rem;">${b.name}</h3>
                    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 0.25rem;">
                        ${serviceList} ${moreServices}
                    </div>
                    
                    <div class="social-links" onclick="event.stopPropagation()">
                        <a href="${instaLink || 'javascript:void(0)'}" target="_blank" class="icon-btn social-btn ${!instaLink ? 'disabled' : ''}">
                            <i class="fa-brands fa-instagram"></i>
                        </a>
                        <a href="${twitterLink || 'javascript:void(0)'}" target="_blank" class="icon-btn social-btn ${!twitterLink ? 'disabled' : ''}">
                            <i class="fa-brands fa-x-twitter"></i>
                        </a>
                        <a href="${emailLink || 'javascript:void(0)'}" target="_blank" class="icon-btn social-btn ${!emailLink ? 'disabled' : ''}">
                            <i class="fa-solid fa-envelope"></i>
                        </a>
                        <a href="${whatsappLink || 'javascript:void(0)'}" target="_blank" class="icon-btn social-btn ${!whatsappLink ? 'disabled' : ''}">
                            <i class="fa-brands fa-whatsapp"></i>
                        </a>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        // CSS Grid adjustment for the new card style (simulated via inline style logic or CSS update)
        // Ideally we update CSS, but we can rely on existing grid.
    } catch (e) {
        container.innerHTML = '<p style="color: var(--danger);">Erro ao carregar profissionais.</p>';
    }
}

function selectBarber(id) {
    const barber = window.allBarbers.find(b => b.id === id);
    if (!barber) return;

    selectedBarber = { 
        id: barber.id, 
        name: barber.name,
        avatar_url: barber.avatar_url
    };
    
    // Update step-4 avatar with image or keep icon
    const avatarEl = document.getElementById('confirm-barber-avatar');
    if (avatarEl && barber.avatar_url) {
        avatarEl.innerHTML = `<img src="${barber.avatar_url}" alt="${barber.name}">`;
    } else if (avatarEl) {
        avatarEl.innerHTML = '<i class="fa-solid fa-user-tie"></i>';
    }
    
    goToStep(2);
    loadServicesUser();
}

async function loadServicesUser() {
    const container = document.getElementById("user-services-list");
    if (!container || !selectedBarber) return;

    container.innerHTML = '<p>Carregando serviços...</p>';

    try {
        const services = await fetchAPI(`/barbers/${selectedBarber.id}/services`);
        window.currentBarberServices = services;

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
            <div class="card service-card" onclick="selectService('${s.id}')" 
                 style="cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3><i class="fa-solid ${s.icon || 'fa-scissors'}"></i> ${s.name}</h3>
                    <div>${displayPrice}</div>
                </div>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;"><i class="fa-regular fa-clock"></i> ${s.duration_minutes} min</p>
            </div>
        `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p style="color: var(--danger);">Erro ao carregar serviços.</p>';
    }
}

function selectService(id) {
    const s = window.currentBarberServices.find(x => x.id === id);
    if (!s) return;

    // Determine price (check discount)
    const hasDiscount = s.discount_price && s.discount_price < s.price;
    const price = hasDiscount ? s.discount_price : s.price;

    selectedService = {
        id: s.id,
        name: s.name,
        duration: s.duration_minutes,
        price: price,
        isBarberService: true
    };
    goToStep(3);
    loadSlots();
}


let currentStep = 1;

function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
    const nextStep = document.getElementById(`step-${step}`);
    nextStep.style.display = 'block';

    const backBtn = document.getElementById('global-back-btn');
    if (backBtn) {
        if (step > 1) {
            backBtn.classList.add('show');
        } else {
            backBtn.classList.remove('show');
        }
    }

    if (step === 3) {
        // Initialize date label when entering step 3
        initializeDateLabel();
    }

    if (step === 4) {
        updateCustomerUI();
        document.getElementById("confirm-barber-name").innerText = selectedBarber ? `${selectedBarber.name}` : '';
        document.getElementById("confirm-service-name").innerText = `${selectedService.name} (R$ ${typeof selectedService.price === 'number' ? selectedService.price.toFixed(2) : selectedService.price})`;
        document.getElementById("confirm-date-time").innerText = `${formatDateBR(selectedDate)} às ${selectedSlot}`;
    }
}

function goBack() {
    // Check if we're on auth step
    const authStep = document.getElementById('step-auth');
    if (authStep && authStep.style.display !== 'none') {
        hideAuthStep();
        document.getElementById(previousStep).style.display = 'block';
        return;
    }
    
    // Check if we're on history step
    const historyStep = document.getElementById('step-history');
    if (historyStep && historyStep.style.display !== 'none') {
        const historyStep = document.getElementById('step-history');
        if (historyStep) historyStep.style.display = 'none';
    }
    
    // If going back from Confirm (Step 4) to Slots (Step 3), clear the selection
    if (currentStep === 4) {
        selectedSlot = null;
        // Reload slots to refresh UI (remove selected state)
        loadSlots();
    }

    if (currentStep > 1) {
        goToStep(currentStep - 1);
        return;
    }

    goToStep(1)
}

function formatDateBR(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

let slotsPollInterval = null;
let lastLoadedSlotsJSON = '';
let lastSelectedSlot = null;

// Helper to get formatted date string (YYYY-MM-DD) in local time
function getFormattedDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    
    // Block past dates - only allow today or future dates
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0); // Start of today
    const selectedDateObj = new Date(dateStr + 'T00:00:00'); // Parse as local time
    
    if (selectedDateObj < todayDate) {
        const container = document.getElementById("slots-container");
        container.innerHTML = `
            <div class="history-empty-state">
                <i class="fa-solid fa-calendar-xmark"></i>
                <h3>Não é possível agendar em datas passadas</h3>
                <p>Por favor, selecione a data de hoje ou uma data futura.</p>
            </div>
        `;
        // Clear any polling
        if (slotsPollInterval) clearInterval(slotsPollInterval);
        lastLoadedSlotsJSON = ''; // Reset cache to force reload on next valid date
        return;
    }
    
    selectedDate = dateStr;

    const container = document.getElementById("slots-container");
    // Show loading only if container is empty (first load)
    if (!container.innerHTML.trim() || container.innerHTML.includes('Carregando')) {
        container.innerHTML = '<i class="fa-solid fa-spinner fa-spin-pulse"></i>';
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
                newHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary); grid-column: 1/-1;">
                        <i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        <p>Nenhum horário disponível para esta data.</p>
                    </div>
                `;
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
    
    // Update step 4 summary with barber avatar
    if (selectedBarber && selectedBarber.avatar) {
        const avatarEl = document.getElementById('confirm-barber-avatar');
        if (avatarEl) avatarEl.src = selectedBarber.avatar;
    }
    
    goToStep(4);
}

// Show field error for booking form
function showBookingFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorSpan = document.getElementById(inputId + '-error');
    if (input) input.classList.add('has-error');
    if (errorSpan) errorSpan.textContent = message;
}

// Clear field error for booking form
function clearBookingFieldError(inputId) {
    const input = document.getElementById(inputId);
    const errorSpan = document.getElementById(inputId + '-error');
    if (input) input.classList.remove('has-error');
    if (errorSpan) errorSpan.textContent = '';
}

// Clear all booking errors
function clearBookingErrors() {
    clearBookingFieldError('customer-name');
    clearBookingFieldError('customer-phone');
    clearBookingFieldError('customer-password');
}

async function confirmBooking() {
    clearBookingErrors();

    let name, phone, customerToken = getCustomerToken();
    let accountCreated = false;

    if (isCustomerLoggedIn() && currentCustomer) {
        name = currentCustomer.name;
        phone = currentCustomer.phone;
    } else {
        name = document.getElementById("customer-name").value.trim();
        phone = document.getElementById("customer-phone").value.trim();
        const password = document.getElementById("customer-password").value;

        // Validation
        let hasError = false;
        
        if (!name || name.length < 3) {
            showBookingFieldError('customer-name', 'Nome deve ter pelo menos 3 caracteres');
            hasError = true;
        }
        
        if (!password || password.length < 6) {
            showBookingFieldError('customer-password', 'Senha deve ter pelo menos 6 caracteres');
            hasError = true;
        }
        
        if (hasError) return;

        // Try to register the user
        try {
            const regRes = await fetch('/customer/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone: phone || null, password })
            });
            
            if (regRes.ok) {
                const data = await regRes.json();
                customerToken = data.access_token;
                localStorage.setItem(CUSTOMER_TOKEN_KEY, customerToken);
                currentCustomer = data.customer;
                accountCreated = true;
            } else {
                const err = await regRes.json();
                if (err.detail && err.detail.includes('username')) {
                    showBookingFieldError('customer-name', 'Este nome já está em uso');
                } else if (err.detail && err.detail.includes('phone')) {
                    showBookingFieldError('customer-phone', 'Este telefone já está cadastrado');
                } else {
                    showBookingFieldError('customer-name', err.detail || 'Erro ao criar conta');
                }
                return;
            }
        } catch (e) {
            showBookingFieldError('customer-name', 'Erro de conexão');
            return;
        }
    }

    const start_time = `${selectedDate}T${selectedSlot}:00`;

    const bookingData = {
        customer_name: name,
        customer_phone: phone || null,
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
            await showAlertModal('Este horário foi reservado. Escolha outro horário.');
            goToStep(3);
            loadSlots();
            return;
        }

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Erro ao agendar');
        }

        // Handle Reschedule: Cancel Old Appointment
        if (typeof rescheduleAppointmentId !== 'undefined' && rescheduleAppointmentId) {
            try {
                const token = customerToken || getCustomerToken();
                await fetch(`/customer/appointments/${rescheduleAppointmentId}/cancel?token=${token}`, { method: 'POST' });
            } catch (e) {
                console.error("Failed to cancel old appointment during reschedule", e);
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
        if (typeof showAlertModal === 'function') {
            await showAlertModal('Erro: ' + e.message);
        } else {
            alert('Erro: ' + e.message);
        }
    }
}

// =========== Custom Calendar Functions ===========

let calendarCurrentMonth = new Date().getMonth();
let calendarCurrentYear = new Date().getFullYear();
let calendarSelectedDate = null;

function toggleCalendarDropdown() {
    const dropdown = document.getElementById('calendar-dropdown');
    if (dropdown.classList.contains('show')) {
        closeCalendarDropdown();
    } else {
        dropdown.classList.add('show');
        renderCalendar(); // Ensure calendar is rendered when opened
    }
}

function closeCalendarDropdown() {
    const dropdown = document.getElementById('calendar-dropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// Close calendar when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('calendar-dropdown');
    const calendarBtn = e.target.closest('.icon-btn[onclick*="toggleCalendarDropdown"]');
    const calendarDropdown = e.target.closest('.calendar-dropdown');
    
    if (dropdown && dropdown.classList.contains('show') && !calendarBtn && !calendarDropdown) {
        closeCalendarDropdown();
    }
});

function initializeCalendar() {
    const today = new Date();
    calendarCurrentMonth = today.getMonth();
    calendarCurrentYear = today.getFullYear();
    
    // Select today by default
    calendarSelectedDate = getFormattedDate(today);
    document.getElementById('booking-date').value = calendarSelectedDate;
    
    renderCalendar();
    updateDateRelativeLabel(today);
}

function renderCalendar() {
    const daysContainer = document.getElementById('calendar-days');
    const monthYearLabel = document.getElementById('calendar-month-year');
    const prevBtn = document.getElementById('prev-month-btn');
    
    if (!daysContainer || !monthYearLabel) return;
    
    // Update month/year label
    const monthNames = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    monthYearLabel.textContent = `${monthNames[calendarCurrentMonth]} de ${calendarCurrentYear}`;
    
    // Disable prev button if we're at current month
    const today = new Date();
    if (calendarCurrentYear === today.getFullYear() && calendarCurrentMonth === today.getMonth()) {
        prevBtn.disabled = true;
    } else {
        prevBtn.disabled = false;
    }
    
    // Get first day of month and number of days
    const firstDay = new Date(calendarCurrentYear, calendarCurrentMonth, 1);
    const lastDay = new Date(calendarCurrentYear, calendarCurrentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday
    
    // Get today's date for comparison
    const todayStr = getFormattedDate(today);
    today.setHours(0, 0, 0, 0);
    
    // Build calendar HTML
    let html = '';
    
    // Empty cells for days before the first day of month
    for (let i = 0; i < startingDay; i++) {
        html += '<div class="calendar-day other-month"></div>';
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(calendarCurrentYear, calendarCurrentMonth, day);
        const dateStr = getFormattedDate(date);
        const dayOfWeek = date.getDay();
        
        let classes = ['calendar-day'];
        
        // Check if weekend (Sunday = 0, Saturday = 6)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            classes.push('weekend');
        }
        
        // Check if today
        if (dateStr === todayStr) {
            classes.push('today');
        }
        
        // Check if selected
        if (dateStr === calendarSelectedDate) {
            classes.push('selected');
        }
        
        // Check if past (disabled)
        if (date < today) {
            classes.push('disabled');
        }
        
        const clickHandler = date >= today ? `onclick="selectCalendarDate('${dateStr}')"` : '';
        
        html += `<div class="${classes.join(' ')}" ${clickHandler}>${day}</div>`;
    }
    
    daysContainer.innerHTML = html;
}

function navigateMonth(direction) {
    const today = new Date();
    const currentMonthYear = today.getFullYear() * 12 + today.getMonth();
    const targetMonthYear = calendarCurrentYear * 12 + calendarCurrentMonth + direction;
    
    // Don't go before current month
    if (targetMonthYear < currentMonthYear) {
        return;
    }
    
    calendarCurrentMonth += direction;
    
    if (calendarCurrentMonth > 11) {
        calendarCurrentMonth = 0;
        calendarCurrentYear++;
    } else if (calendarCurrentMonth < 0) {
        calendarCurrentMonth = 11;
        calendarCurrentYear--;
    }
    
    renderCalendar();
}

function selectCalendarDate(dateStr) {
    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dateStr + 'T00:00:00');
    
    if (selectedDate < today) {
        // Don't allow past dates - validation to prevent backend submission
        return;
    }
    
    calendarSelectedDate = dateStr;
    document.getElementById('booking-date').value = dateStr;
    
    renderCalendar();
    updateDateRelativeLabel(selectedDate);
    closeCalendarDropdown(); // Close dropdown after selection
    loadSlots();
}

function selectToday() {
    const today = new Date();
    const dateStr = getFormattedDate(today);
    
    // Navigate to current month if not there
    calendarCurrentMonth = today.getMonth();
    calendarCurrentYear = today.getFullYear();
    
    selectCalendarDate(dateStr);
}

function clearCalendarSelection() {
    calendarSelectedDate = null;
    document.getElementById('booking-date').value = '';
    renderCalendar();
    
    // Clear slots container
    const container = document.getElementById('slots-container');
    if (container) {
        container.innerHTML = `
            <div class="history-empty-state">
                <i class="fa-solid fa-calendar"></i>
                <h3>Selecione uma data</h3>
                <p>Escolha uma data no calendário para ver os horários disponíveis.</p>
            </div>
        `;
    }
    
    // Hide the relative label
    const label = document.getElementById('date-relative-label');
    if (label) label.classList.add('hidden');
}

// Keep for backward compatibility
function onDateInputChange() {
    const dateInput = document.getElementById('booking-date');
    if (!dateInput || !dateInput.value) return;
    
    const selectedDate = new Date(dateInput.value + 'T00:00:00');
    
    // Validate: don't allow past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        // Reset to today
        const todayStr = getFormattedDate(today);
        dateInput.value = todayStr;
        calendarSelectedDate = todayStr;
        renderCalendar();
        return;
    }
    
    calendarSelectedDate = dateInput.value;
    calendarCurrentMonth = selectedDate.getMonth();
    calendarCurrentYear = selectedDate.getFullYear();
    
    renderCalendar();
    updateDateRelativeLabel(selectedDate);
    loadSlots();
}

function updateDateRelativeLabel(selectedDate) {
    const label = document.getElementById('date-relative-label');
    if (!label) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    
    const diffDays = Math.round((selected - today) / (1000 * 60 * 60 * 24));
    
    let labelText = '';
    let showLabel = true;
    
    if (diffDays === 0) {
        labelText = 'Hoje';
    } else if (diffDays === 1) {
        labelText = 'Amanhã';
    } else if (diffDays >= 2) {
        labelText = `Em ${diffDays} dias`;
    } else {
        // Past dates - hide label
        showLabel = false;
    }
    
    if (showLabel && labelText) {
        label.classList.remove('hidden');
    } else {
        label.classList.add('hidden');
    }
    label.textContent = labelText;
}

// Initialize date label on step 3 entry
function initializeDateLabel() {
    const dateInput = document.getElementById('booking-date');
    if (dateInput && dateInput.value) {
        const selectedDate = new Date(dateInput.value + 'T00:00:00');
        updateDateRelativeLabel(selectedDate);
    }
}

// =========== Initialization ===========

document.addEventListener("DOMContentLoaded", () => {
    // Load barbers list
    loadBarbers();

    // Load customer profile if logged in
    loadCustomerProfile();

    // Initialize custom calendar
    initializeCalendar();
});
