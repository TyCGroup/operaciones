// Firebase Firestore reference
const db = firebase.firestore();

// Global variables
let allEvents = [];
let filteredEvents = [];
let currentPage = 1;
let pageSize = 10;
let editingEventId = null;
let isReadOnly = false;

// DOM Elements
const elements = {
    // Filters
    searchEvent: document.getElementById('searchEvent'),
    searchOperator: document.getElementById('searchOperator'),
    searchFactura: document.getElementById('searchFactura'),
    dateFrom: document.getElementById('dateFrom'),
    dateTo: document.getElementById('dateTo'),
    statusFilter: document.getElementById('statusFilter'),
    
    // Buttons
    refreshBtn: document.getElementById('refreshBtn'),
    clearFilters: document.getElementById('clearFilters'),
    applyFilters: document.getElementById('applyFilters'),
    
    // Table and pagination
    eventsTableBody: document.getElementById('eventsTableBody'),
    pagination: document.getElementById('pagination'),
    pageSize: document.getElementById('pageSize'),
    
    // Stats
    totalEvents: document.getElementById('totalEvents'),

    
    // Modal
    editModal: document.getElementById('editModal'),
    closeModal: document.getElementById('closeModal'),
    cancelEdit: document.getElementById('cancelEdit'),
    saveEvent: document.getElementById('saveEvent'),
    editEventForm: document.getElementById('editEventForm'),
    
    // Loading
    loading: document.getElementById('loading')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        showLoading(true);
        await loadEvents();
        setupEventListeners();
        applyFilters();
        showLoading(false);
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error al inicializar la aplicación', 'error');
        showLoading(false);
    }
    await loadOperatorOptions();

}

// Event Listeners Setup
function setupEventListeners() {
    // Filter events
    elements.searchEvent.addEventListener('input', debounce(applyFilters, 300));
    elements.searchOperator.addEventListener('input', debounce(applyFilters, 300));
    elements.searchFactura.addEventListener('input', debounce(applyFilters, 300));
    elements.dateFrom.addEventListener('change', applyFilters);
    elements.dateTo.addEventListener('change', applyFilters);
    elements.statusFilter.addEventListener('change', applyFilters);
    document.getElementById('editSubtotal').addEventListener('input', recalculateTotal);
    document.getElementById('editIva').addEventListener('input', recalculateTotal);

    
    // Button events
    elements.refreshBtn.addEventListener('click', refreshData);
    elements.clearFilters.addEventListener('click', clearAllFilters);
    elements.applyFilters.addEventListener('click', applyFilters);
    
    // Pagination
    elements.pageSize.addEventListener('change', function() {
        pageSize = parseInt(this.value);
        currentPage = 1;
        renderTable();
        renderPagination();
    });
    
    // Modal events
    elements.closeModal.addEventListener('click', closeEditModal);
    elements.cancelEdit.addEventListener('click', closeEditModal);
    elements.saveEvent.addEventListener('click', saveEventChanges);
    
    // Close modal when clicking outside
    elements.editModal.addEventListener('click', function(e) {
        if (e.target === elements.editModal) {
            closeEditModal();
        }
    });
    
    // Form submit prevention
    elements.editEventForm.addEventListener('submit', function(e) {
        e.preventDefault();
        saveEventChanges();
    });
}

// Load events from Firestore
async function loadEvents() {
    try {
        const snapshot = await db.collection('eventos').orderBy('fechaInicio', 'desc').get();
        allEvents = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            allEvents.push({
                id: doc.id,
                ...data,
                fechaInicio: data.fechaInicio?.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio),
                fechaFinal: data.fechaFinal?.toDate ? data.fechaFinal.toDate() : new Date(data.fechaFinal)
            });
        });
        
        console.log(`Loaded ${allEvents.length} events`);
        updateStats();
        
    } catch (error) {
        console.error('Error loading events:', error);
        showNotification('Error al cargar los eventos', 'error');
    }
}

// Apply filters to events
function applyFilters() {
    const searchEvent = elements.searchEvent.value.toLowerCase().trim();
    const searchOperator = elements.searchOperator.value.toLowerCase().trim();
    const searchFactura = elements.searchFactura.value.toLowerCase().trim();
    const dateFrom = elements.dateFrom.value;
    const dateTo = elements.dateTo.value;
    const statusFilter = elements.statusFilter.value;
    
    filteredEvents = allEvents.filter(event => {
        // Text filters
        if (searchEvent && !event.nombreEvento.toLowerCase().includes(searchEvent)) {
            return false;
        }
        
        if (searchOperator && !event.operador.toLowerCase().includes(searchOperator)) {
            return false;
        }
        
        if (searchFactura && !event.numeroFactura.toLowerCase().includes(searchFactura)) {
            return false;
        }
        
        // Date filters
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            if (event.fechaInicio < fromDate) {
                return false;
            }
        }
        
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // End of day
            if (event.fechaInicio > toDate) {
                return false;
            }
        }
        
        // Status filter
        if (statusFilter !== '') {
            const hasOrder = statusFilter === 'true';
            if (event.tieneOrdenSRE !== hasOrder) {
                return false;
            }
        }
        
        return true;
    });
    
    currentPage = 1;
    renderTable();
    renderPagination();
    updateFilteredStats();
}

// Clear all filters
function clearAllFilters() {
    elements.searchEvent.value = '';
    elements.searchOperator.value = '';
    elements.searchFactura.value = '';
    elements.dateFrom.value = '';
    elements.dateTo.value = '';
    elements.statusFilter.value = '';
    
    applyFilters();
    showNotification('Filtros limpiados', 'success');
}

// Render events table
function renderTable() {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const eventsToShow = filteredEvents.slice(startIndex, endIndex);
    
    elements.eventsTableBody.innerHTML = '';
    
    if (eventsToShow.length === 0) {
        elements.eventsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="no-events">
                    <i class="fas fa-calendar-times"></i>
                    <p>No se encontraron eventos</p>
                </td>
            </tr>
        `;
        return;
    }
    
    eventsToShow.forEach(event => {
        const row = createEventRow(event);
        elements.eventsTableBody.appendChild(row);
    });
}

// Create event row
function createEventRow(event) {
    const row = document.createElement('tr');
    
    // Usar el campo 'total' directamente de Firestore
    const total = event.total || 0;
    
    row.innerHTML = `
        <td>
            <span class="folio">${event.folio || 'N/A'}</span>
        </td>
        <td>
            <div class="event-info">
                <strong>${event.nombreEvento}</strong>
                ${event.zona ? `<small>Zona: ${event.zona}</small>` : ''}
            </div>
        </td>
        <td>${event.operador}</td>
        <td>
            <div class="date-info">
                <div>${formatDate(event.fechaInicio)}</div>
                ${event.fechaFinal && event.fechaFinal.getTime() !== event.fechaInicio.getTime() ? 
                    `<small>hasta ${formatDate(event.fechaFinal)}</small>` : ''
                }
            </div>
        </td>
        <td>
            <span class="factura">${event.numeroFactura}</span>
        </td>
        <td>
            <div class="amount-info">
                <strong>$${formatNumber(total)}</strong>
                ${event.montoPendiente > 0 ? 
                    `<small class="pending">Pendiente: $${formatNumber(event.montoPendiente)}</small>` : ''
                }
            </div>
        </td>
        <td>
            <span class="status ${event.tieneOrdenSRE ? 'status-success' : 'status-warning'}">
                <i class="fas ${event.tieneOrdenSRE ? 'fa-check-circle' : 'fa-clock'}"></i>
                ${event.tieneOrdenSRE ? 'Con Orden SRE' : 'Sin Orden SRE'}
            </span>
        </td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-sm btn-primary" onclick="editEvent('${event.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <<button class="btn btn-sm btn-info" onclick="editEvent('${event.id}', true)" title="Ver detalles">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Render pagination
function renderPagination() {
    const totalPages = Math.ceil(filteredEvents.length / pageSize);
    elements.pagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container';
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = `btn btn-sm ${currentPage === 1 ? 'btn-disabled' : 'btn-secondary'}`;
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(currentPage - 1);
    paginationContainer.appendChild(prevBtn);
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        const firstBtn = createPageButton(1);
        paginationContainer.appendChild(firstBtn);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'pagination-ellipsis';
            paginationContainer.appendChild(ellipsis);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = createPageButton(i);
        paginationContainer.appendChild(pageBtn);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'pagination-ellipsis';
            paginationContainer.appendChild(ellipsis);
        }
        const lastBtn = createPageButton(totalPages);
        paginationContainer.appendChild(lastBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = `btn btn-sm ${currentPage === totalPages ? 'btn-disabled' : 'btn-secondary'}`;
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1);
    paginationContainer.appendChild(nextBtn);
    
    // Page info
    const pageInfo = document.createElement('div');
    pageInfo.className = 'pagination-info';
    pageInfo.innerHTML = `
        Página ${currentPage} de ${totalPages} 
        (${filteredEvents.length} eventos)
    `;
    
    elements.pagination.appendChild(paginationContainer);
    elements.pagination.appendChild(pageInfo);
}

// Create page button
function createPageButton(pageNum) {
    const btn = document.createElement('button');
    btn.className = `btn btn-sm ${pageNum === currentPage ? 'btn-primary' : 'btn-secondary'}`;
    btn.textContent = pageNum;
    btn.onclick = () => changePage(pageNum);
    return btn;
}

// Change page
function changePage(newPage) {
    const totalPages = Math.ceil(filteredEvents.length / pageSize);
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTable();
        renderPagination();
        
        // Scroll to top of table
        document.querySelector('.table-section').scrollIntoView({ behavior: 'smooth' });
    }
}


// Update statistics
function updateStats() {
    const totalEvents = allEvents.length;
    // Usar el campo 'total' en lugar de sumar montoPagado + montoNoPagado
    const totalRevenue = allEvents.reduce((sum, event) => {
        return sum + (event.total || 0);
    }, 0);
    const pendingEvents = allEvents.filter(event => !event.tieneOrdenSRE).length;
    
    // Solo actualizar elementos que existen
    if (elements.totalEvents) {
        elements.totalEvents.textContent = totalEvents;
    }
}

// Update filtered statistics
function updateFilteredStats() {
    const totalEvents = filteredEvents.length;
    // Usar el campo 'total' en lugar de sumar montoPagado + montoNoPagado
    const totalRevenue = filteredEvents.reduce((sum, event) => {
        return sum + (event.total || 0);
    }, 0);
    const pendingEvents = filteredEvents.filter(event => !event.tieneOrdenSRE).length;
    
    // Solo actualizar elementos que existen
    if (elements.totalEvents) {
        elements.totalEvents.textContent = totalEvents;
    }
}

// Edit event
function editEvent(eventId, readOnly = false) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) {
        showNotification('Evento no encontrado', 'error');
        return;
    }

    editingEventId = eventId;
    isReadOnly = readOnly;
    document.querySelector('#editModal .modal-header h2').innerHTML = `
    <i class="fas fa-${readOnly ? 'eye' : 'edit'}"></i> ${readOnly ? 'Ver Detalles del Evento' : 'Editar Evento'}
`;


    // Rellenar campos como ya lo haces
    document.getElementById('editFolio').value = event.folio || '';
    document.getElementById('editNombreEvento').value = event.nombreEvento || '';
    document.getElementById('editOperador').value = event.operador || '';
    document.getElementById('editNumeroFactura').value = event.numeroFactura || '';
    document.getElementById('editFechaInicio').value = formatDateForInput(event.fechaInicio);
    document.getElementById('editFechaFinal').value = formatDateForInput(event.fechaFinal);
    document.getElementById('editIva').value = event.iva || 0;
    document.getElementById('editMontoPendiente').value = event.montoPendienteFacturar || 0;
    document.getElementById('editMontoNoPagado').value = event.montoFacturadoNoPagado || 0;
    document.getElementById('editMontoPagado').value = event.montoFacturadoPagado || 0;
    document.getElementById('editSubtotal').value = event.subtotal || 0;
    document.getElementById('editTotal').value = event.total || 0;
    document.getElementById('editZona').value = event.zona || '';
    document.getElementById('editTieneOrdenSRE').value = event.tieneOrdenSRE ? 'true' : 'false';
    document.getElementById('editCarpetaAuditoria').value = event.carpetaAuditoria || '';
    document.getElementById('editObservaciones').value = event.observaciones || '';

    // Deshabilitar campos si es modo solo lectura
    const inputs = elements.editModal.querySelectorAll('input, select, textarea');
    inputs.forEach(input => input.disabled = readOnly);

    // Mostrar/ocultar botones según modo
    elements.saveEvent.style.display = readOnly ? 'none' : 'inline-block';
    elements.cancelEdit.textContent = readOnly ? 'Cerrar' : 'Cancelar';

    // Mostrar modal
    elements.editModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// View event details - VERSIÓN CORREGIDA
function viewEventDetails(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) {
        showNotification('Evento no encontrado', 'error');
        return;
    }
    
    // Usar el campo 'total' directamente
    alert(`Detalles del evento:\n\nNombre: ${event.nombreEvento}\nOperador: ${event.operador}\nFactura: ${event.numeroFactura}\nTotal: $${formatNumber(event.total || 0)}`);
}

// Save event changes
async function saveEventChanges() {
    if (!editingEventId) return;
    
    try {
        const formData = {
            folio: document.getElementById('editFolio').value.trim(),
            nombreEvento: document.getElementById('editNombreEvento').value.trim(),
            operador: document.getElementById('editOperador').value.trim(),
            numeroFactura: document.getElementById('editNumeroFactura').value.trim(),
            fechaInicio: new Date(document.getElementById('editFechaInicio').value),
            fechaFinal: new Date(document.getElementById('editFechaFinal').value),
            iva: parseFloat(document.getElementById('editIva').value) || 0,
            montoPendienteFacturar: parseFloat(document.getElementById('editMontoPendiente').value) || 0,
            montoFacturadoNoPagado: parseFloat(document.getElementById('editMontoNoPagado').value) || 0,
            montoFacturadoPagado: parseFloat(document.getElementById('editMontoPagado').value) || 0,
            subtotal: parseFloat(document.getElementById('editSubtotal').value) || 0,
            total: parseFloat(document.getElementById('editTotal').value) || 0,
            carpetaAuditoria: document.getElementById('editCarpetaAuditoria').value.trim(),
            zona: document.getElementById('editZona').value.trim(),
            tieneOrdenSRE: document.getElementById('editTieneOrdenSRE').value === 'true',
            observaciones: document.getElementById('editObservaciones').value.trim(),
            fechaModificacion: new Date()
        };
        
        // Validate required fields
        if (!formData.nombreEvento || !formData.operador || !formData.numeroFactura) {
            showNotification('Por favor complete todos los campos requeridos', 'error');
            return;
        }
        
        // Show loading
        elements.saveEvent.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        elements.saveEvent.disabled = true;
        
        // Update in Firestore
        await db.collection('eventos').doc(editingEventId).update(formData);
        
        // Update local data
        const eventIndex = allEvents.findIndex(e => e.id === editingEventId);
        if (eventIndex !== -1) {
            allEvents[eventIndex] = { ...allEvents[eventIndex], ...formData };
        }
        
        // Refresh display
        applyFilters();
        updateStats();
        closeEditModal();
        
        showNotification('Evento actualizado correctamente', 'success');
        
    } catch (error) {
        console.error('Error updating event:', error);
        showNotification('Error al actualizar el evento', 'error');
    } finally {
        elements.saveEvent.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        elements.saveEvent.disabled = false;
    }
}

// Close edit modal
function closeEditModal() {
    elements.editModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    editingEventId = null;
    elements.editEventForm.reset();
}

// Refresh data
async function refreshData() {
    try {
        elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
        elements.refreshBtn.disabled = true;
        
        await loadEvents();
        applyFilters();
        
        showNotification('Datos actualizados correctamente', 'success');
        
    } catch (error) {
        console.error('Error refreshing data:', error);
        showNotification('Error al actualizar los datos', 'error');
    } finally {
        elements.refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
        elements.refreshBtn.disabled = false;
    }
}

// Utility functions
function formatDate(date) {
    if (!date) return 'N/A';
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateForInput(date) {
    if (!date) return '';
    return date.toISOString().split('T')[0];
}

function formatNumber(number) {
    return new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
}

function showLoading(show) {
    elements.loading.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                        type === 'error' ? 'fa-exclamation-circle' : 
                        type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
    
    // Close button
    notification.querySelector('.notification-close').onclick = () => {
        notification.remove();
    };
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Global functions for onclick events
window.editEvent = editEvent;
window.viewEventDetails = viewEventDetails;

async function loadOperatorOptions() {
    const select = document.getElementById('editOperador');
    try {
        const snapshot = await db.collection('usuarios').get();
        const options = [];

        snapshot.forEach(doc => {
            const nombre = doc.data().Nombre;
            if (nombre) {
                options.push(nombre);
            }
        });

        // Limpiar y agregar opciones
        select.innerHTML = '<option value="">Seleccione un operador</option>';
        options.sort().forEach(nombre => {
            const option = document.createElement('option');
            option.value = nombre;
            option.textContent = nombre;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error cargando operadores:', error);
        select.innerHTML = '<option value="">Error al cargar operadores</option>';
    }
}

function recalculateTotal() {
    const subtotal = parseFloat(document.getElementById('editSubtotal').value) || 0;
    const iva = parseFloat(document.getElementById('editIva').value) || 0;
    const total = subtotal + (subtotal * iva / 100);
    document.getElementById('editTotal').value = total.toFixed(2);
}
