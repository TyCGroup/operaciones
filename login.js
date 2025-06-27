// Login functionality using Firebase compat SDK
// Firebase auth is already initialized in firebase-config.js

// DOM Elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');
const errorMessage = document.getElementById('errorMessage');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const loadingIcon = document.getElementById('loadingIcon');

// Toggle password visibility
togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // Toggle eye icon
    if (type === 'password') {
        eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        `;
    } else {
        eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
        `;
    }
});

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    
    // Add shake animation
    errorMessage.classList.add('animate-shake');
    setTimeout(() => {
        errorMessage.classList.remove('animate-shake');
    }, 500);
}

// Hide error message
function hideError() {
    errorMessage.classList.add('hidden');
}

// Show loading state
function showLoading() {
    submitBtn.disabled = true;
    btnText.textContent = 'Iniciando...';
    loadingIcon.classList.remove('hidden');
    submitBtn.classList.add('opacity-75');
}

// Hide loading state
function hideLoading() {
    submitBtn.disabled = false;
    btnText.textContent = 'Iniciar Sesión';
    loadingIcon.classList.add('hidden');
    submitBtn.classList.remove('opacity-75');
}

// Validate form inputs
function validateForm(email, password) {
    const errors = [];
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
        errors.push('El correo electrónico es requerido');
    } else if (!emailRegex.test(email)) {
        errors.push('El formato del correo electrónico no es válido');
    }
    
    // Password validation
    if (!password.trim()) {
        errors.push('La contraseña es requerida');
    } else if (password.length < 6) {
        errors.push('La contraseña debe tener al menos 6 caracteres');
    }
    
    return errors;
}

// Handle form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Hide previous errors
    hideError();
    
    // Validate form
    const validationErrors = validateForm(email, password);
    if (validationErrors.length > 0) {
        showError(validationErrors[0]);
        return;
    }
    
    // Show loading state
    showLoading();
    
    try {
        // Sign in with Firebase using compat SDK
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('Usuario autenticado:', user);
        
        // Success - redirect to menu
        console.log('Redirigiendo al menú...');
        window.location.href = 'menu.html';
        
    } catch (error) {
        console.error('Error de autenticación:', error);
        
        // Handle specific Firebase errors
        let errorMsg = 'Error al iniciar sesión. Inténtalo de nuevo.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMsg = 'No existe una cuenta con este correo electrónico';
                break;
            case 'auth/wrong-password':
                errorMsg = 'Contraseña incorrecta';
                break;
            case 'auth/invalid-email':
                errorMsg = 'El formato del correo electrónico no es válido';
                break;
            case 'auth/user-disabled':
                errorMsg = 'Esta cuenta ha sido deshabilitada';
                break;
            case 'auth/too-many-requests':
                errorMsg = 'Demasiados intentos fallidos. Inténtalo más tarde';
                break;
            case 'auth/network-request-failed':
                errorMsg = 'Error de conexión. Verifica tu internet';
                break;
            case 'auth/invalid-credential':
                errorMsg = 'Credenciales inválidas. Verifica tu correo y contraseña';
                break;
            default:
                errorMsg = 'Error de autenticación: ' + error.message;
        }
        
        showError(errorMsg);
    } finally {
        // Hide loading state
        hideLoading();
    }
});

// Monitor authentication state
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('Usuario ya autenticado, redirigiendo...');
        // User is signed in, redirect to menu
        window.location.href = 'menu.html';
    } else {
        console.log('Usuario no autenticado');
        // User is signed out
    }
});

// Clear error message when user starts typing
emailInput.addEventListener('input', hideError);
passwordInput.addEventListener('input', hideError);

// Add focus and blur effects to inputs
const inputs = [emailInput, passwordInput];
inputs.forEach(input => {
    input.addEventListener('focus', () => {
        input.parentElement.classList.add('input-focused');
    });
    
    input.addEventListener('blur', () => {
        input.parentElement.classList.remove('input-focused');
    });
});

// Prevent form submission on Enter key in specific cases
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && submitBtn.disabled) {
        e.preventDefault();
    }
});

console.log('Login script loaded successfully');