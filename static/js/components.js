/**
 * Component System for Baber Admin
 * Includes Input Masking Logic for Time Inputs (HH:MM)
 */

// Expose handlers globally
window.handleTimeInput = handleTimeInput;
window.validateTimeInput = validateTimeInput;
window.handleTimeKeydown = handleTimeKeydown;
window.handleTimeFocus = handleTimeFocus;
window.handleTimeMousedown = handleTimeMousedown; // Changed from Click

/**
 * Returns an HTML string for the time input, suitable for template literals.
 */
function createTimeInput(options = {}) {
    const {
        value = '',
        name = '',
        id = '',
        placeholder = '--:--',
        required = false,
        className = '',
        style = ''
    } = options;

    const safeValue = value ? value : '';
    const safeName = name ? name.replace(/"/g, '&quot;') : '';
    const safeId = id ? id.replace(/"/g, '&quot;') : (safeName || '');
    const safeStyle = style ? `style="${style.replace(/"/g, '&quot;')}"` : '';
    const requiredAttr = required ? 'required' : '';

    return `
        <input type="text" 
               class="time-input-component ${className}"
               name="${safeName}"
               id="${safeId}"
               value="${safeValue}"
               placeholder="${placeholder}"
               ${requiredAttr}
               ${safeStyle}
               oninput="handleTimeInput(event)"
               onfocus="handleTimeFocus(event)"
               onmousedown="handleTimeMousedown(event)"
               onblur="validateTimeInput(event)"
               onkeydown="handleTimeKeydown(event)"
               maxlength="5"
        >
    `.trim();
}

// --- Event Handlers for Masking ---

function handleTimeFocus(e) {
    const input = e.target;
    // We still use a small delay for Focus events (init via Tab)
    // but Mousedown will handle mouse interactions immediately.
    setTimeout(() => {
        if (!input.value) {
            input.value = '--:--';
            setCursorPosition(input, 0);
        } else {
            // Find first dash
            const firstDash = input.value.indexOf('-');
            if (firstDash !== -1) {
                setCursorPosition(input, firstDash);
            }
        }
    }, 0);
}

function handleTimeMousedown(e) {
    const input = e.target;

    // Prevent default browser placement
    // e.preventDefault(); // OLD: This blocked clicks on full inputs!

    // Ensure focus if not already focused
    if (document.activeElement !== input) {
        input.focus();
    }

    // Initialize if empty (Focus handler might race, so do it here too)
    if (!input.value) {
        e.preventDefault(); // Prevent default here to force cursor to 0
        input.value = '--:--';
        setCursorPosition(input, 0);
        return;
    }

    // Logic: If partial, go to first dash.
    const firstDash = input.value.indexOf('-');
    if (firstDash !== -1) {
        // We have empty slots. 
        // Force cursor to first empty slot.
        e.preventDefault(); // Prevent default here to avoid jump
        setCursorPosition(input, firstDash);
    } else {
        // Full value (no dashes).
        // specific requirements: None stated for full value editing except "not bugged".
        // Allow default browser behavior (user can click anywhere to edit).
        // Do NOT prevent default.
    }
}

function handleTimeInput(e) {
    // We handle most logic in keydown. 
    // This is a fallback regarding pasted content or mobile duplication.
    // For now, minimal logic here or we risk fighting the cursor.
    // Let's only ensure length limit.
    const input = e.target;
    if (input.value.length > 5) {
        input.value = input.value.slice(0, 5);
    }
}

function handleTimeKeydown(e) {
    const input = e.target;
    const key = e.key;
    const val = input.value;
    const cursorPos = input.selectionStart;

    // Allowed: 0-9, Backspace, ArrowLeft, ArrowRight, Tab
    if (['Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;

    e.preventDefault(); // Take full control

    if (key === 'Backspace' || key === 'Delete') {
        // Check for selection
        if (input.selectionEnd - input.selectionStart > 0) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            let valArr = val.split('');

            // Loop through selection
            for (let i = start; i < end; i++) {
                if (i === 2) {
                    valArr[i] = ':'; // Keep colon
                } else {
                    valArr[i] = '-'; // Reset digit
                }
            }

            input.value = valArr.join('');
            setCursorPosition(input, start);
            return;
        }

        if (key === 'Delete') return; // Normal delete: do nothing or implement delete forward? 
        // For now, backspace is the main deleter. 
        // If Delete and no selection, maybe clear current char?
        // Let's implement Delete forward for completeness.
        if (key === 'Delete') {
            if (cursorPos < 5) {
                let targetPos = cursorPos;
                if (val[targetPos] === ':') targetPos++;
                if (targetPos < 5) {
                    const chars = val.split('');
                    chars[targetPos] = '-';
                    input.value = chars.join('');
                    setCursorPosition(input, targetPos); // Stay, don't move
                }
            }
            return;
        }

        // Backspace (Single Char)
        if (cursorPos > 0) {
            let targetPos = cursorPos - 1;
            if (val[targetPos] === ':') targetPos--; // Skip colon backwards

            if (targetPos >= 0) {
                const chars = val.split('');
                chars[targetPos] = '-';
                input.value = chars.join('');
                setCursorPosition(input, targetPos);
            }
        }
        return;
    }

    // Numbers
    if (/^\d$/.test(key)) {
        if (cursorPos >= 5) return; // Full

        let targetPos = cursorPos;
        if (val[targetPos] === ':') targetPos++; // Skip colon forwards

        if (targetPos < 5) {
            const chars = val.split('');
            chars[targetPos] = key;
            input.value = chars.join('');

            // Advance cursor (skip colon if next is colon)
            let nextPos = targetPos + 1;
            if (val[nextPos] === ':') nextPos++;

            setCursorPosition(input, nextPos);
        }
    }
}

function validateTimeInput(e) {
    const input = e.target;
    let value = input.value;

    // Clear if empty or full mask
    if (value === '--:--') {
        input.value = '';
        input.style.borderColor = 'var(--border)';
        return;
    }

    // Check validity
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (value && !timeRegex.test(value)) {
        input.style.borderColor = 'var(--danger)';
    } else {
        input.style.borderColor = 'var(--border)';
    }
}

function setCursorPosition(elem, pos) {
    if (elem.setSelectionRange) {
        elem.focus();
        elem.setSelectionRange(pos, pos);
    }
}

/**
 * Creates a DOM Element (legacy support)
 */
function createTimeInputElement(options = {}) {
    const div = document.createElement('div');
    div.innerHTML = createTimeInput(options);
    return div.firstElementChild;
}

// Global Exports
window.createTimeInput = createTimeInput;
window.createTimeInputElement = createTimeInputElement;

// Legacy support (noop or simple wrapper if needed, but we removed usage)
window.initializeTimeInputs = function () { }; 
