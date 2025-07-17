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
    dateFrom: document.getElementById('dateFrom'),
    dateTo: document.getElementById('dateTo'),
    
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
    elements.dateFrom.addEventListener('change', applyFilters);
    elements.dateTo.addEventListener('change', applyFilters);
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
    const dateFrom = elements.dateFrom.value;
    const dateTo = elements.dateTo.value;
    
    filteredEvents = allEvents.filter(event => {
        // Text filters
        if (searchEvent && !event.nombreEvento.toLowerCase().includes(searchEvent)) {
            return false;
        }
        
        if (searchOperator && !event.operador.toLowerCase().includes(searchOperator)) {
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
    elements.dateFrom.value = '';
    elements.dateTo.value = '';
    
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
                <button class="btn btn-sm btn-info" onclick="editEvent('${event.id}', true)" title="Ver detalles">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteEvent('${event.id}')" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Delete event function
async function deleteEvent(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) {
        showNotification('Evento no encontrado', 'error');
        return;
    }

    // Crear modal de confirmación personalizado
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal';
    confirmModal.style.display = 'flex';
    confirmModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2><i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i> Confirmar Eliminación</h2>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 16px;">¿Está seguro de que desea eliminar este evento?</p>
                <div style="background: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid var(--danger-color);">
                    <strong>Evento:</strong> ${event.nombreEvento}<br>
                    <strong>Operador:</strong> ${event.operador}<br>
                    <strong>Fecha:</strong> ${formatDate(event.fechaInicio)}
                </div>
                <p style="margin-top: 16px; color: var(--danger-color); font-weight: 500;">
                    <i class="fas fa-warning"></i> Esta acción no se puede deshacer.
                </p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" id="cancelDelete">Cancelar</button>
                <button type="button" class="btn btn-danger" id="confirmDelete">
                    <i class="fas fa-trash"></i> Eliminar Evento
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(confirmModal);
    document.body.style.overflow = 'hidden';

    // Event listeners para el modal de confirmación
    const cancelBtn = confirmModal.querySelector('#cancelDelete');
    const confirmBtn = confirmModal.querySelector('#confirmDelete');

    cancelBtn.onclick = () => {
        document.body.removeChild(confirmModal);
        document.body.style.overflow = 'auto';
    };

    confirmBtn.onclick = async () => {
        try {
            // Mostrar estado de carga
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;

            // Eliminar de Firestore
            await db.collection('eventos').doc(eventId).delete();

            // Actualizar datos locales
            const eventIndex = allEvents.findIndex(e => e.id === eventId);
            if (eventIndex !== -1) {
                allEvents.splice(eventIndex, 1);
            }

            // Actualizar vista
            applyFilters();
            updateStats();

            // Cerrar modal
            document.body.removeChild(confirmModal);
            document.body.style.overflow = 'auto';

            showNotification('Evento eliminado correctamente', 'success');

            console.log('Evento eliminado:', eventId);

        } catch (error) {
            console.error('Error al eliminar evento:', error);
            showNotification('Error al eliminar el evento: ' + error.message, 'error');

            // Restaurar botones
            confirmBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar Evento';
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
        }
    };

    // Cerrar modal al hacer clic fuera
    confirmModal.onclick = (e) => {
        if (e.target === confirmModal) {
            document.body.removeChild(confirmModal);
            document.body.style.overflow = 'auto';
        }
    };
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

    // Debug: Log del evento para verificar estructura
    console.log('Cargando evento:', event);

    // Rellenar campos básicos
    document.getElementById('editFolio').value = event.folio || '';
    document.getElementById('editNombreEvento').value = event.nombreEvento || '';
    document.getElementById('editOperador').value = event.operador || '';
    document.getElementById('editFechaInicio').value = formatDateForInput(event.fechaInicio);
    document.getElementById('editFechaFinal').value = formatDateForInput(event.fechaFinal);
    document.getElementById('editZona').value = event.zona || '';
    document.getElementById('editCiudad').value = event.ciudad || '';
    document.getElementById('editTieneOrdenSRE').value = event.tieneOrdenSRE ? 'true' : 'false';
    document.getElementById('editIva').value = event.iva || 0;
    document.getElementById('editSubtotal').value = event.subtotal || 0;
    document.getElementById('editTotal').value = event.total || 0;
    document.getElementById('editCarpetaAuditoria').value = event.carpetaAuditoria || '';
    document.getElementById('editObservaciones').value = event.observaciones || '';

    // Cargar datos dinámicos
    loadDynamicData(event);

    // Verificar que los datos se cargaron correctamente
    setTimeout(() => {
        console.log('Verificando datos cargados:');
        console.log('Pendientes inputs:', document.querySelectorAll('.pendiente-input').length);
        console.log('No Pagados inputs:', document.querySelectorAll('.nopagado-input').length);
        console.log('Pagados inputs:', document.querySelectorAll('.pagado-input').length);
        
        // Verificar valores específicos
        document.querySelectorAll('.nopagado-input').forEach((input, i) => {
            console.log(`No Pagado ${i}:`, input.value);
        });
        document.querySelectorAll('.pagado-input').forEach((input, i) => {
            console.log(`Pagado ${i}:`, input.value);
        });
    }, 100);

    // Debug: Verificar datos cargados
    console.log('Montos No Pagados:', event.montosNoPagados);
    console.log('Montos Pagados:', event.montosPagados);

    // Deshabilitar campos si es modo solo lectura
    if (readOnly) {
        const inputs = elements.editModal.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.disabled = true);
        
        const addButtons = elements.editModal.querySelectorAll('.btn-add');
        addButtons.forEach(btn => btn.style.display = 'none');
        
        const removeButtons = elements.editModal.querySelectorAll('.btn-remove');
        removeButtons.forEach(btn => btn.style.display = 'none');
    } else {
        // Habilitar campos para edición
        const inputs = elements.editModal.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.disabled = false);
        
        const addButtons = elements.editModal.querySelectorAll('.btn-add');
        addButtons.forEach(btn => {
            btn.style.display = 'flex';
            btn.disabled = false;
        });
        
        // Actualizar botones de eliminar según corresponda
        updateRemoveButtons('facturasContainer', '.btn-remove');
        updateRemoveButtons('pendientesContainer', '.btn-remove');
        updateRemoveButtons('noPagadosContainer', '.btn-remove');
        updateRemoveButtons('pagadosContainer', '.btn-remove');
    }

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
        // Recopilar datos dinámicos
        const dynamicData = collectDynamicData();
        
        const formData = {
            folio: document.getElementById('editFolio').value.trim(),
            nombreEvento: document.getElementById('editNombreEvento').value.trim(),
            operador: document.getElementById('editOperador').value.trim(),
            fechaInicio: new Date(document.getElementById('editFechaInicio').value),
            fechaFinal: new Date(document.getElementById('editFechaFinal').value),
            zona: document.getElementById('editZona').value.trim(),
            ciudad: document.getElementById('editCiudad').value.trim(),
            tieneOrdenSRE: document.getElementById('editTieneOrdenSRE').value === 'true',
            
            // Datos financieros dinámicos
            facturas: dynamicData.facturas,
            numeroFactura: dynamicData.facturas[0] || '', // Compatibilidad con versión anterior
            montosPendientes: dynamicData.montosPendientes,
            montoPendienteFacturar: dynamicData.montosPendientes.reduce((sum, item) => sum + item.monto, 0), // Compatibilidad
            montosNoPagados: dynamicData.montosNoPagados,
            montoFacturadoNoPagado: dynamicData.montosNoPagados.reduce((sum, item) => sum + item.monto, 0), // Compatibilidad
            montosPagados: dynamicData.montosPagados,
            montoFacturadoPagado: dynamicData.montosPagados.reduce((sum, item) => sum + item.monto, 0), // Compatibilidad
            
            iva: parseFloat(document.getElementById('editIva').value) || 0,
            subtotal: parseFloat(document.getElementById('editSubtotal').value) || 0,
            total: parseFloat(document.getElementById('editTotal').value) || 0,
            
            // Información administrativa
            carpetaAuditoria: document.getElementById('editCarpetaAuditoria').value.trim(),
            observaciones: document.getElementById('editObservaciones').value.trim(),
            fechaModificacion: new Date()
        };
        
        // Validate required fields
        if (!formData.nombreEvento || !formData.operador) {
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
    
    // Reset campos dinámicos
    resetDynamicFields();
    
    // Mostrar botones de agregar en caso de que estuvieran ocultos
    const addButtons = elements.editModal.querySelectorAll('.btn-add');
    addButtons.forEach(btn => {
        btn.style.display = 'flex';
        btn.disabled = false;
    });
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
window.deleteEvent = deleteEvent; // Nueva función exportada

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

// ===== FUNCIONES PARA CAMPOS DINÁMICOS =====

// Contadores para campos dinámicos
let facturaCounter = 1;
let pendienteCounter = 1;
let noPagadoCounter = 1;
let pagadoCounter = 1;

// Funciones para campos dinámicos de facturas
function addFacturaField() {
    const container = document.getElementById('facturasContainer');
    const newItem = document.createElement('div');
    newItem.className = 'dynamic-item';
    newItem.innerHTML = `
        <input type="text" class="form-input factura-input" placeholder="Número de factura" data-index="${facturaCounter}">
        <button type="button" class="btn-remove" onclick="removeFacturaField(${facturaCounter})">
            <i class="fas fa-minus"></i>
        </button>
    `;
    container.appendChild(newItem);
    updateRemoveButtons('facturasContainer', '.btn-remove');
    facturaCounter++;
}

function removeFacturaField(index) {
    const container = document.getElementById('facturasContainer');
    const item = container.querySelector(`[data-index="${index}"]`).closest('.dynamic-item');
    if (container.children.length > 1) {
        item.remove();
        updateRemoveButtons('facturasContainer', '.btn-remove');
    }
}

// Funciones para campos dinámicos de montos pendientes
function addPendienteField() {
    const container = document.getElementById('pendientesContainer');
    const newItem = document.createElement('div');
    newItem.className = 'dynamic-item';
    newItem.innerHTML = `
        <div class="input-with-currency">
            <span class="currency-symbol">$</span>
            <input type="number" class="form-input pendiente-input" placeholder="0.00" step="0.01" data-index="${pendienteCounter}">
            <input type="text" class="form-input concept-input" placeholder="Concepto (opcional)" data-index="${pendienteCounter}">
        </div>
        <button type="button" class="btn-remove" onclick="removePendienteField(${pendienteCounter})">
            <i class="fas fa-minus"></i>
        </button>
    `;
    container.appendChild(newItem);
    updateRemoveButtons('pendientesContainer', '.btn-remove');
    pendienteCounter++;
}

function removePendienteField(index) {
    const container = document.getElementById('pendientesContainer');
    const item = container.querySelector(`input[data-index="${index}"]`).closest('.dynamic-item');
    if (container.children.length > 1) {
        item.remove();
        updateRemoveButtons('pendientesContainer', '.btn-remove');
    }
}

// Funciones para campos dinámicos de montos no pagados
function addNoPagadoField() {
    const container = document.getElementById('noPagadosContainer');
    const newItem = document.createElement('div');
    newItem.className = 'dynamic-item';
    newItem.innerHTML = `
        <div class="input-with-currency">
            <span class="currency-symbol">$</span>
            <input type="number" class="form-input nopagado-input" placeholder="0.00" step="0.01" data-index="${noPagadoCounter}">
            <input type="text" class="form-input concept-input" placeholder="Concepto (opcional)" data-index="${noPagadoCounter}">
        </div>
        <button type="button" class="btn-remove" onclick="removeNoPagadoField(${noPagadoCounter})">
            <i class="fas fa-minus"></i>
        </button>
    `;
    container.appendChild(newItem);
    updateRemoveButtons('noPagadosContainer', '.btn-remove');
    noPagadoCounter++;
}

function removeNoPagadoField(index) {
    const container = document.getElementById('noPagadosContainer');
    const item = container.querySelector(`input[data-index="${index}"]`).closest('.dynamic-item');
    if (container.children.length > 1) {
        item.remove();
        updateRemoveButtons('noPagadosContainer', '.btn-remove');
    }
}

// Funciones para campos dinámicos de montos pagados
function addPagadoField() {
    const container = document.getElementById('pagadosContainer');
    const newItem = document.createElement('div');
    newItem.className = 'dynamic-item';
    newItem.innerHTML = `
        <div class="input-with-currency">
            <span class="currency-symbol">$</span>
            <input type="number" class="form-input pagado-input" placeholder="0.00" step="0.01" data-index="${pagadoCounter}">
            <input type="text" class="form-input concept-input" placeholder="Concepto (opcional)" data-index="${pagadoCounter}">
        </div>
        <button type="button" class="btn-remove" onclick="removePagadoField(${pagadoCounter})">
            <i class="fas fa-minus"></i>
        </button>
    `;
    container.appendChild(newItem);
    updateRemoveButtons('pagadosContainer', '.btn-remove');
    pagadoCounter++;
}

function removePagadoField(index) {
    const container = document.getElementById('pagadosContainer');
    const item = container.querySelector(`input[data-index="${index}"]`).closest('.dynamic-item');
    if (container.children.length > 1) {
        item.remove();
        updateRemoveButtons('pagadosContainer', '.btn-remove');
    }
}

// Función auxiliar para mostrar/ocultar botones de eliminar
function updateRemoveButtons(containerId, buttonSelector) {
    const container = document.getElementById(containerId);
    const removeButtons = container.querySelectorAll(buttonSelector);
    
    removeButtons.forEach(button => {
        if (container.children.length > 1) {
            button.style.display = 'flex';
        } else {
            button.style.display = 'none';
        }
    });
}

// Función para recopilar datos dinámicos
function collectDynamicData() {
    const facturas = [];
    document.querySelectorAll('.factura-input').forEach(input => {
        const value = input.value.trim();
        if (value) facturas.push(value);
    });

    const montosPendientes = [];
    document.querySelectorAll('.pendiente-input').forEach(input => {
        const value = parseFloat(input.value) || 0;
        const index = input.getAttribute('data-index');
        const concepto = document.querySelector(`#pendientesContainer .concept-input[data-index="${index}"]`)?.value.trim() || '';
        
        if (value > 0 || concepto) {
            montosPendientes.push({ monto: value, concepto });
        }
    });

    const montosNoPagados = [];
    document.querySelectorAll('.nopagado-input').forEach(input => {
        const value = parseFloat(input.value) || 0;
        const index = input.getAttribute('data-index');
        const concepto = document.querySelector(`#noPagadosContainer .concept-input[data-index="${index}"]`)?.value.trim() || '';
        
        if (value > 0 || concepto) {
            montosNoPagados.push({ monto: value, concepto });
        }
    });

    const montosPagados = [];
    document.querySelectorAll('.pagado-input').forEach(input => {
        const value = parseFloat(input.value) || 0;
        const index = input.getAttribute('data-index');
        const concepto = document.querySelector(`#pagadosContainer .concept-input[data-index="${index}"]`)?.value.trim() || '';
        
        if (value > 0 || concepto) {
            montosPagados.push({ monto: value, concepto });
        }
    });

    return { facturas, montosPendientes, montosNoPagados, montosPagados };
}

// Función para cargar datos dinámicos en el modal
function loadDynamicData(event) {
    resetDynamicFields();

    // Cargar facturas
    if (event.facturas && Array.isArray(event.facturas)) {
        if (event.facturas.length > 0) {
            document.querySelector('.factura-input[data-index="0"]').value = event.facturas[0];
        }
        for (let i = 1; i < event.facturas.length; i++) {
            addFacturaField();
            const newInput = document.querySelector(`.factura-input[data-index="${facturaCounter - 1}"]`);
            if (newInput) newInput.value = event.facturas[i];
        }
    } else if (event.numeroFactura) {
        document.querySelector('.factura-input[data-index="0"]').value = event.numeroFactura;
    }

    // Cargar montos pendientes
    if (event.montosPendientes && Array.isArray(event.montosPendientes)) {
        if (event.montosPendientes.length > 0) {
            const firstPendiente = document.querySelector('.pendiente-input[data-index="0"]');
            const firstConcepto = document.querySelector('.concept-input[data-index="0"]');
            if (firstPendiente) firstPendiente.value = event.montosPendientes[0].monto;
            if (firstConcepto) firstConcepto.value = event.montosPendientes[0].concepto || '';
        }
        for (let i = 1; i < event.montosPendientes.length; i++) {
            addPendienteField();
            const pendienteInput = document.querySelector(`.pendiente-input[data-index="${pendienteCounter - 1}"]`);
            const conceptoInput = document.querySelector(`.concept-input[data-index="${pendienteCounter - 1}"]`);
            if (pendienteInput) pendienteInput.value = event.montosPendientes[i].monto;
            if (conceptoInput) conceptoInput.value = event.montosPendientes[i].concepto || '';
        }
    } else if (event.montoPendienteFacturar) {
        document.querySelector('.pendiente-input[data-index="0"]').value = event.montoPendienteFacturar;
    }

    // Cargar montos no pagados
    if (event.montosNoPagados && Array.isArray(event.montosNoPagados)) {
        if (event.montosNoPagados.length > 0) {
            const firstNoPagado = document.querySelector('.nopagado-input[data-index="0"]');
            const firstConceptoNoPagado = document.querySelector('#noPagadosContainer .concept-input[data-index="0"]');
            if (firstNoPagado) firstNoPagado.value = event.montosNoPagados[0].monto;
            if (firstConceptoNoPagado) firstConceptoNoPagado.value = event.montosNoPagados[0].concepto || '';
        }
        for (let i = 1; i < event.montosNoPagados.length; i++) {
            addNoPagadoField();
            const noPagadoInput = document.querySelector(`.nopagado-input[data-index="${noPagadoCounter - 1}"]`);
            const conceptoNoPagadoInput = document.querySelector(`#noPagadosContainer .concept-input[data-index="${noPagadoCounter - 1}"]`);
            if (noPagadoInput) noPagadoInput.value = event.montosNoPagados[i].monto;
            if (conceptoNoPagadoInput) conceptoNoPagadoInput.value = event.montosNoPagados[i].concepto || '';
        }
    } else if (event.montoFacturadoNoPagado) {
        document.querySelector('.nopagado-input[data-index="0"]').value = event.montoFacturadoNoPagado;
    }

    // Cargar montos pagados
    if (event.montosPagados && Array.isArray(event.montosPagados)) {
        if (event.montosPagados.length > 0) {
            const firstPagado = document.querySelector('.pagado-input[data-index="0"]');
            const firstConceptoPagado = document.querySelector('#pagadosContainer .concept-input[data-index="0"]');
            if (firstPagado) firstPagado.value = event.montosPagados[0].monto;
            if (firstConceptoPagado) firstConceptoPagado.value = event.montosPagados[0].concepto || '';
        }
        for (let i = 1; i < event.montosPagados.length; i++) {
            addPagadoField();
            const pagadoInput = document.querySelector(`.pagado-input[data-index="${pagadoCounter - 1}"]`);
            const conceptoPagadoInput = document.querySelector(`#pagadosContainer .concept-input[data-index="${pagadoCounter - 1}"]`);
            if (pagadoInput) pagadoInput.value = event.montosPagados[i].monto;
            if (conceptoPagadoInput) conceptoPagadoInput.value = event.montosPagados[i].concepto || '';
        }
    } else if (event.montoFacturadoPagado) {
        document.querySelector('.pagado-input[data-index="0"]').value = event.montoFacturadoPagado;
    }
}

// Función para resetear campos dinámicos
function resetDynamicFields() {
    document.getElementById('facturasContainer').innerHTML = `
        <div class="dynamic-item">
            <input type="text" class="form-input factura-input" placeholder="Número de factura" data-index="0">
            <button type="button" class="btn-remove" onclick="removeFacturaField(0)" style="display: none;">
                <i class="fas fa-minus"></i>
            </button>
        </div>
    `;

    document.getElementById('pendientesContainer').innerHTML = `
        <div class="dynamic-item">
            <div class="input-with-currency">
                <span class="currency-symbol">$</span>
                <input type="number" class="form-input pendiente-input" placeholder="0.00" step="0.01" data-index="0">
                <input type="text" class="form-input concept-input" placeholder="Concepto (opcional)" data-index="0">
            </div>
            <button type="button" class="btn-remove" onclick="removePendienteField(0)" style="display: none;">
                <i class="fas fa-minus"></i>
            </button>
        </div>
    `;

    document.getElementById('noPagadosContainer').innerHTML = `
        <div class="dynamic-item">
            <div class="input-with-currency">
                <span class="currency-symbol">$</span>
                <input type="number" class="form-input nopagado-input" placeholder="0.00" step="0.01" data-index="0">
                <input type="text" class="form-input concept-input" placeholder="Concepto (opcional)" data-index="0">
            </div>
            <button type="button" class="btn-remove" onclick="removeNoPagadoField(0)" style="display: none;">
                <i class="fas fa-minus"></i>
            </button>
        </div>
    `;

    document.getElementById('pagadosContainer').innerHTML = `
        <div class="dynamic-item">
            <div class="input-with-currency">
                <span class="currency-symbol">$</span>
                <input type="number" class="form-input pagado-input" placeholder="0.00" step="0.01" data-index="0">
                <input type="text" class="form-input concept-input" placeholder="Concepto (opcional)" data-index="0">
            </div>
            <button type="button" class="btn-remove" onclick="removePagadoField(0)" style="display: none;">
                <i class="fas fa-minus"></i>
            </button>
        </div>
    `;

    facturaCounter = 1;
    pendienteCounter = 1;
    noPagadoCounter = 1;
    pagadoCounter = 1;
}