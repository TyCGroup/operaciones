// Initialize Firestore
const db = firebase.firestore();

// DOM Elements
const form = document.getElementById('eventForm');
const tieneOrdenSRECheckbox = document.getElementById('tieneOrdenSRE');
const folioContainer = document.getElementById('folioContainer');
const subtotalInput = document.getElementById('subtotal');
const ivaInput = document.getElementById('iva');
const totalInput = document.getElementById('total');
const operadorSelect = document.getElementById('operador');

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    loadUsuarios();
});

function initializeForm() {
    // Toggle folio field based on checkbox
    tieneOrdenSRECheckbox.addEventListener('change', function() {
        if (this.checked) {
            folioContainer.classList.remove('hidden');
            folioContainer.classList.add('fade-in');
            document.getElementById('folio').setAttribute('required', '');
        } else {
            folioContainer.classList.add('hidden');
            document.getElementById('folio').removeAttribute('required');
            document.getElementById('folio').value = '';
        }
    });

    // Auto-calculate total when subtotal or IVA changes
    subtotalInput.addEventListener('input', calculateTotal);
    ivaInput.addEventListener('input', calculateTotal);

    // Form submission
    form.addEventListener('submit', handleFormSubmit);

    // Auto-calculate IVA when subtotal changes (16% IVA)
    subtotalInput.addEventListener('input', function() {
        const subtotal = parseFloat(this.value) || 0;
        const iva = subtotal * 0.16;
        ivaInput.value = iva.toFixed(2);
        calculateTotal();
    });
}

// Load usuarios from Firebase
async function loadUsuarios() {
    try {
        // Show loading state in select
        operadorSelect.innerHTML = '<option value="">Cargando usuarios...</option>';
        
        const usuariosSnapshot = await db.collection('usuarios').orderBy('Nombre').get();
        
        // Clear loading option
        operadorSelect.innerHTML = '<option value="">Seleccione un operador</option>';
        
        usuariosSnapshot.forEach((doc) => {
            const usuario = doc.data();
            const option = document.createElement('option');
            option.value = usuario.Nombre || doc.id;
            option.textContent = usuario.Nombre || 'Usuario sin nombre';
            
            operadorSelect.appendChild(option);
        });
        
        // If no users found
        if (usuariosSnapshot.empty) {
            operadorSelect.innerHTML = '<option value="">No hay usuarios registrados</option>';
        }
        
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        operadorSelect.innerHTML = '<option value="">Error al cargar usuarios</option>';
        showMessage('Error al cargar la lista de usuarios: ' + error.message, 'error');
    }
}

function calculateTotal() {
    const subtotal = parseFloat(subtotalInput.value) || 0;
    const iva = parseFloat(ivaInput.value) || 0;
    const total = subtotal + iva;
    
    totalInput.value = total.toFixed(2);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<svg class="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Guardando...';
    submitButton.disabled = true;
    form.classList.add('loading');

    try {
        // Collect form data
        const formData = new FormData(form);
        const eventData = {
            // Información General
            numeroEvento: formData.get('numeroEvento'),
            fechaInicio: formData.get('fechaInicio'),
            fechaFinal: formData.get('fechaFinal'),
            nombreEvento: formData.get('nombreEvento'),
            zona: formData.get('zona'),
            operador: formData.get('operador'),
            tieneOrdenSRE: formData.get('tieneOrdenSRE') === 'on',
            folio: formData.get('folio') || null,
            
            
            // Datos Financieros
            subtotal: parseFloat(formData.get('subtotal')) || 0,
            iva: parseFloat(formData.get('iva')) || 0,
            total: parseFloat(formData.get('total')) || 0,
            
            // Información de Facturación
            numeroFactura: formData.get('numeroFactura') || null,
            montoPendienteFacturar: parseFloat(formData.get('montoPendienteFacturar')) || 0,
            montoFacturadoNoPagado: parseFloat(formData.get('montoFacturadoNoPagado')) || 0,
            montoFacturadoPagado: parseFloat(formData.get('montoFacturadoPagado')) || 0,
            
            // Información Administrativa
            carpetaAuditoria: formData.get('carpetaAuditoria') || null,
            observaciones: formData.get('observaciones') || null,
            
            // Metadata
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Validate required fields
        if (!validateForm(eventData)) {
            throw new Error('Por favor complete todos los campos requeridos');
        }

        // Save to Firestore
        const docRef = await db.collection('eventos').add(eventData);
        
        // Show success message
        showMessage('Evento guardado exitosamente', 'success');
        
        // Reset form
        form.reset();
        folioContainer.classList.add('hidden');
        document.getElementById('folio').removeAttribute('required');
        
        console.log('Evento guardado con ID:', docRef.id);
        
    } catch (error) {
        console.error('Error al guardar evento:', error);
        showMessage('Error al guardar el evento: ' + error.message, 'error');
    } finally {
        // Reset button state
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
        form.classList.remove('loading');
    }
}

function validateForm(data) {
    const requiredFields = ['numeroEvento', 'fechaInicio', 'nombreEvento', 'zona', 'operador'];
    
    for (let field of requiredFields) {
        if (!data[field] || data[field].toString().trim() === '') {
            highlightError(field);
            return false;
        }
    }
    
    // Validate folio if SRE order is checked
    if (data.tieneOrdenSRE && (!data.folio || data.folio.trim() === '')) {
        highlightError('folio');
        return false;
    }
    
    return true;
}

function highlightError(fieldName) {
    const field = document.getElementById(fieldName);
    if (field) {
        field.classList.add('error');
        field.focus();
        
        // Remove error class after a few seconds
        setTimeout(() => {
            field.classList.remove('error');
        }, 3000);
    }
}

function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
    messageDiv.textContent = message;
    
    // Insert message at the top of the form
    const formContainer = document.querySelector('.bg-white.rounded-xl');
    formContainer.insertBefore(messageDiv, form);
    
    // Auto-remove message after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function resetForm() {
    if (confirm('¿Está seguro de que desea limpiar todos los campos?')) {
        form.reset();
        folioContainer.classList.add('hidden');
        document.getElementById('folio').removeAttribute('required');
        
        // Clear any error states
        const errorFields = document.querySelectorAll('.error');
        errorFields.forEach(field => field.classList.remove('error'));
        
        // Remove any messages
        const messages = document.querySelectorAll('.success-message, .error-message');
        messages.forEach(msg => msg.remove());
    }
}

// Utility function to format currency
function formatCurrency(value) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(value);
}

// Function to load event data (for editing)
async function loadEventData(eventId) {
    try {
        const doc = await db.collection('eventos').doc(eventId).get();
        
        if (doc.exists) {
            const data = doc.data();
            
            // Populate form fields
            Object.keys(data).forEach(key => {
                const field = document.getElementById(key);
                if (field) {
                    if (field.type === 'checkbox') {
                        field.checked = data[key];
                    } else if (field.type === 'date' && data[key]) {
                        // Convert Firestore timestamp to date string
                        const date = data[key].toDate ? data[key].toDate() : new Date(data[key]);
                        field.value = date.toISOString().split('T')[0];
                    } else {
                        field.value = data[key] || '';
                    }
                }
            });
            
            // Handle special cases
            if (data.tieneOrdenSRE) {
                folioContainer.classList.remove('hidden');
                document.getElementById('folio').setAttribute('required', '');
            }
            
            calculateTotal();
            
        } else {
            showMessage('Evento no encontrado', 'error');
        }
    } catch (error) {
        console.error('Error al cargar evento:', error);
        showMessage('Error al cargar los datos del evento', 'error');
    }
}

// Function to refresh usuarios list
function refreshUsuarios() {
    loadUsuarios();
}

// Export functions for external use
window.loadEventData = loadEventData;
window.resetForm = resetForm;
window.refreshUsuarios = refreshUsuarios;