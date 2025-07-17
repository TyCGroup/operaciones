// Firebase Firestore reference
const db = firebase.firestore();

// Global variables
let allEvents = [];
let filteredEvents = [];
let currentPage = 1;
let pageSize = 10;
let editingEventId = null;
let isReadOnly = false;
let facturaCounter = 1;

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
    loading: document.getElementById('loading'),
    
    // Resumen elements
    resumenSubtotalInput: document.getElementById('resumenSubtotalInput'),
    resumenIVAInput: document.getElementById('resumenIVAInput'),
    resumenTotalEvento: document.getElementById('resumenTotalEvento'),
    resumenPagado: document.getElementById('resumenPagado'),
    resumenSinPagar: document.getElementById('resumenSinPagar'),
    resumenPendiente: document.getElementById('resumenPendiente')
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
    // Event listeners para resumen manual
    if (elements.resumenSubtotalInput) {
        elements.resumenSubtotalInput.addEventListener('input', updateResumenFinanciero);
    }
    if (elements.resumenIVAInput) {
        elements.resumenIVAInput.addEventListener('input', updateResumenFinanciero);
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Filter events
    elements.searchEvent.addEventListener('input', debounce(applyFilters, 300));
    elements.searchOperator.addEventListener('input', debounce(applyFilters, 300));
    elements.dateFrom.addEventListener('change', applyFilters);
    elements.dateTo.addEventListener('change', applyFilters);
    
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
        
        console.log('Loaded ' + allEvents.length + ' events');
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
            toDate.setHours(23, 59, 59, 999);
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
        elements.eventsTableBody.innerHTML = 
            '<tr>' +
                '<td colspan="8" class="no-events">' +
                    '<i class="fas fa-calendar-times"></i>' +
                    '<p>No se encontraron eventos</p>' +
                '</td>' +
            '</tr>';
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
    
    // Calcular total de todas las facturas
    const total = calculateEventTotal(event);
    
    // Obtener primera factura para mostrar
    let primeraFactura = 'N/A';
    if (event.facturas && event.facturas.length > 0) {
        primeraFactura = event.facturas[0].numeroFactura || 'N/A';
    } else if (event.numeroFactura) {
        primeraFactura = event.numeroFactura;
    }
    
    let facturasExtra = '';
    if (event.facturas && event.facturas.length > 1) {
        facturasExtra = '<small>+' + (event.facturas.length - 1) + ' más</small>';
    }
    
    const fechaFinalHtml = (event.fechaFinal && event.fechaFinal.getTime() !== event.fechaInicio.getTime()) ? 
        '<small>hasta ' + formatDate(event.fechaFinal) + '</small>' : '';
    
    const zonaHtml = event.zona ? '<small>Zona: ' + event.zona + '</small>' : '';
    
    // CAMBIO PRINCIPAL: usar numeroEvento en lugar de folio
    const folioDisplay = event.numeroEvento || event.folio || 'N/A';
    
    row.innerHTML = 
        '<td>' +
            '<span class="folio">' + folioDisplay + '</span>' +
        '</td>' +
        '<td>' +
            '<div class="event-info">' +
                '<strong>' + event.nombreEvento + '</strong>' +
                zonaHtml +
            '</div>' +
        '</td>' +
        '<td>' + event.operador + '</td>' +
        '<td>' +
            '<div class="date-info">' +
                '<div>' + formatDate(event.fechaInicio) + '</div>' +
                fechaFinalHtml +
            '</div>' +
        '</td>' +
        '<td>' +
            '<span class="factura">' + primeraFactura + '</span>' +
            facturasExtra +
        '</td>' +
        '<td>' +
            '<div class="amount-info">' +
                '<strong>$' + formatNumber(total) + '</strong>' +
            '</div>' +
        '</td>' +
        '<td>' +
            '<span class="status ' + (event.tieneOrdenSRE ? 'status-success' : 'status-warning') + '">' +
                '<i class="fas ' + (event.tieneOrdenSRE ? 'fa-check-circle' : 'fa-clock') + '"></i>' +
                (event.tieneOrdenSRE ? 'Con Orden SRE' : 'Sin Orden SRE') +
            '</span>' +
        '</td>' +
        '<td>' +
            '<div class="action-buttons">' +
                '<button class="btn btn-sm btn-primary" onclick="editEvent(\'' + event.id + '\')" title="Editar">' +
                    '<i class="fas fa-edit"></i>' +
                '</button>' +
                '<button class="btn btn-sm btn-info" onclick="editEvent(\'' + event.id + '\', true)" title="Ver detalles">' +
                    '<i class="fas fa-eye"></i>' +
                '</button>' +
                '<button class="btn btn-sm btn-danger" onclick="deleteEvent(\'' + event.id + '\')" title="Eliminar">' +
                    '<i class="fas fa-trash"></i>' +
                '</button>' +
            '</div>' +
        '</td>';
    
    return row;
}

// Calcular total del evento sumando todas las facturas
function calculateEventTotal(event) {
    if (event.facturas && Array.isArray(event.facturas)) {
        return event.facturas.reduce((total, factura) => {
            return total + (factura.total || 0);
        }, 0);
    }
    return event.total || 0;
}

// Función para actualizar el resumen financiero
function updateResumenFinanciero() {
    const facturas = collectFacturasData();
    
    // Obtener valores manuales
    const subtotalManual = parseFloat(elements.resumenSubtotalInput.value) || 0;
    const ivaManual = parseFloat(elements.resumenIVAInput.value) || 0;
    
    // Calcular totales de facturas
    let totalPagado = 0;
    let totalSinPagar = 0;
    
    facturas.forEach(factura => {
        const total = factura.total || 0;
        
        if (factura.pagado) {
            totalPagado += total;
        } else if (factura.sinPagar) {
            totalSinPagar += total;
        }
    });
    
    const totalEvento = subtotalManual + ivaManual;
    const pendientePorFacturar = totalEvento - totalPagado - totalSinPagar;
    
    // Actualizar elementos del DOM
    if (elements.resumenTotalEvento) {
        elements.resumenTotalEvento.textContent = '$' + formatNumber(totalEvento);
    }
    if (elements.resumenPagado) {
        elements.resumenPagado.textContent = '$' + formatNumber(totalPagado);
    }
    if (elements.resumenSinPagar) {
        elements.resumenSinPagar.textContent = '$' + formatNumber(totalSinPagar);
    }
    if (elements.resumenPendiente) {
        elements.resumenPendiente.textContent = '$' + formatNumber(Math.max(0, pendientePorFacturar));
    }
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
    confirmModal.innerHTML = 
        '<div class="modal-content" style="max-width: 500px;">' +
            '<div class="modal-header">' +
                '<h2><i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i> Confirmar Eliminación</h2>' +
            '</div>' +
            '<div class="modal-body">' +
                '<p style="margin-bottom: 16px;">¿Está seguro de que desea eliminar este evento?</p>' +
                '<div style="background: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid var(--danger-color);">' +
                    '<strong>Evento:</strong> ' + event.nombreEvento + '<br>' +
                    '<strong>Operador:</strong> ' + event.operador + '<br>' +
                    '<strong>Fecha:</strong> ' + formatDate(event.fechaInicio) +
                '</div>' +
                '<p style="margin-top: 16px; color: var(--danger-color); font-weight: 500;">' +
                    '<i class="fas fa-warning"></i> Esta acción no se puede deshacer.' +
                '</p>' +
            '</div>' +
            '<div class="modal-footer">' +
                '<button type="button" class="btn btn-secondary" id="cancelDelete">Cancelar</button>' +
                '<button type="button" class="btn btn-danger" id="confirmDelete">' +
                    '<i class="fas fa-trash"></i> Eliminar Evento' +
                '</button>' +
            '</div>' +
        '</div>';

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
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;

            await db.collection('eventos').doc(eventId).delete();

            const eventIndex = allEvents.findIndex(e => e.id === eventId);
            if (eventIndex !== -1) {
                allEvents.splice(eventIndex, 1);
            }

            applyFilters();
            updateStats();

            document.body.removeChild(confirmModal);
            document.body.style.overflow = 'auto';

            showNotification('Evento eliminado correctamente', 'success');

            console.log('Evento eliminado:', eventId);

        } catch (error) {
            console.error('Error al eliminar evento:', error);
            showNotification('Error al eliminar el evento: ' + error.message, 'error');

            confirmBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar Evento';
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
        }
    };

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
    prevBtn.className = 'btn btn-sm ' + (currentPage === 1 ? 'btn-disabled' : 'btn-secondary');
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
    nextBtn.className = 'btn btn-sm ' + (currentPage === totalPages ? 'btn-disabled' : 'btn-secondary');
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1);
    paginationContainer.appendChild(nextBtn);
    
    // Page info
    const pageInfo = document.createElement('div');
    pageInfo.className = 'pagination-info';
    pageInfo.innerHTML = 
        'Página ' + currentPage + ' de ' + totalPages + 
        ' (' + filteredEvents.length + ' eventos)';
    
    elements.pagination.appendChild(paginationContainer);
    elements.pagination.appendChild(pageInfo);
}

// Create page button
function createPageButton(pageNum) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm ' + (pageNum === currentPage ? 'btn-primary' : 'btn-secondary');
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
    const totalRevenue = allEvents.reduce((sum, event) => {
        return sum + calculateEventTotal(event);
    }, 0);
    const pendingEvents = allEvents.filter(event => !event.tieneOrdenSRE).length;
    
    if (elements.totalEvents) {
        elements.totalEvents.textContent = totalEvents;
    }
}

// Update filtered statistics
function updateFilteredStats() {
    const totalEvents = filteredEvents.length;
    const totalRevenue = filteredEvents.reduce((sum, event) => {
        return sum + calculateEventTotal(event);
    }, 0);
    const pendingEvents = filteredEvents.filter(event => !event.tieneOrdenSRE).length;
    
    if (elements.totalEvents) {
        elements.totalEvents.textContent = totalEvents;
    }
}

function editEvent(eventId, readOnly = false) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) {
        showNotification('Evento no encontrado', 'error');
        return;
    }

    editingEventId = eventId;
    isReadOnly = readOnly;
    
    const iconClass = readOnly ? 'eye' : 'edit';
    const titleText = readOnly ? 'Ver Detalles del Evento' : 'Editar Evento';
    document.querySelector('#editModal .modal-header h2').innerHTML = 
        '<i class="fas fa-' + iconClass + '"></i> ' + titleText;

    // Rellenar campos del evento
    document.getElementById('editFolio').value = event.numeroEvento || event.folio || '';
    document.getElementById('editNombreEvento').value = event.nombreEvento || '';
    document.getElementById('editOperador').value = event.operador || '';
    document.getElementById('editFechaInicio').value = formatDateForInput(event.fechaInicio);
    document.getElementById('editFechaFinal').value = formatDateForInput(event.fechaFinal);
    document.getElementById('editZona').value = event.zona || '';
    document.getElementById('editCiudad').value = event.ciudad || '';
    document.getElementById('editTieneOrdenSRE').value = event.tieneOrdenSRE ? 'true' : 'false';
    document.getElementById('editCarpetaAuditoria').value = event.carpetaAuditoria || '';
    document.getElementById('editObservaciones').value = event.observaciones || '';

    // Cargar valores manuales ANTES de cargar facturas
    if (elements.resumenSubtotalInput) {
        elements.resumenSubtotalInput.value = event.subtotalManual || 0;
    }
    if (elements.resumenIVAInput) {
        elements.resumenIVAInput.value = event.ivaManual || 0;
    }

    // Cargar facturas (esto incluye la actualización del resumen)
    loadFacturas(event);

    // Deshabilitar campos si es modo solo lectura
    if (readOnly) {
        const inputs = elements.editModal.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.disabled = true);
        
        const buttons = elements.editModal.querySelectorAll('.btn-add, .btn-remove-factura');
        buttons.forEach(btn => btn.style.display = 'none');
    } else {
        const inputs = elements.editModal.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.disabled = false);
        
        const buttons = elements.editModal.querySelectorAll('.btn-add, .btn-remove-factura');
        buttons.forEach(btn => {
            btn.style.display = 'flex';
            btn.disabled = false;
        });
    }

    // Mostrar/ocultar botones según modo
    elements.saveEvent.style.display = readOnly ? 'none' : 'inline-block';
    elements.cancelEdit.textContent = readOnly ? 'Cerrar' : 'Cancelar';

    // Mostrar modal
    elements.editModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // ASEGURAR que el resumen se actualice después de mostrar el modal
    setTimeout(() => {
        updateResumenFinanciero();
    }, 150);
}

function loadFacturas(event) {
    const container = document.getElementById('facturasContainer');
    container.innerHTML = '';
    
    facturaCounter = 1;
    
    // Si el evento tiene facturas en el nuevo formato
    if (event.facturas && Array.isArray(event.facturas) && event.facturas.length > 0) {
        event.facturas.forEach((factura, index) => {
            addFacturaCard(factura);
        });
    } else {
        // Compatibilidad con formato anterior o evento nuevo
        const facturaData = {
            fecha: event.fechaFactura || '',
            numeroFactura: event.numeroFactura || '',
            subtotal: event.subtotal || 0,
            iva: event.iva || 0,
            total: event.total || 0,
            sinPagar: event.sinPagar || false,
            pagado: event.pagado || false,
            comentarios: event.comentarios || ''
        };
        addFacturaCard(facturaData);
    }
    
    // IMPORTANTE: Actualizar el resumen después de cargar todas las facturas
    setTimeout(() => {
        updateResumenFinanciero();
    }, 100);
}

// Función modificada para crear las tarjetas de factura en formato compacto
function addFacturaCard(facturaData = null) {
    const container = document.getElementById('facturasContainer');
    const facturaId = facturaCounter++;
    
    const facturaCard = document.createElement('div');
    facturaCard.className = 'factura-card compact';
    facturaCard.setAttribute('data-factura-id', facturaId);
    
    const factura = facturaData || {
        fecha: '',
        numeroFactura: '',
        subtotal: 0,
        iva: 0,
        total: 0,
        sinPagar: false,
        pagado: false,
        comentarios: ''
    };
    
    facturaCard.innerHTML = 
        '<div class="factura-card-header compact">' +
            '<div class="factura-title">' +
                '<i class="fas fa-file-invoice-dollar"></i>' +
                'Factura #' + facturaId +
            '</div>' +
            '<button type="button" class="btn-remove-factura compact" onclick="removeFacturaCard(' + facturaId + ')">' +
                '<i class="fas fa-trash"></i>' +
            '</button>' +
        '</div>' +
        
        '<div class="factura-row-compact">' +
            '<div class="factura-field">' +
                '<label>Fecha</label>' +
                '<input type="date" class="form-input compact factura-fecha" value="' + factura.fecha + '" data-field="fecha">' +
            '</div>' +
            
            '<div class="factura-field">' +
                '<label>No. Factura</label>' +
                '<input type="text" class="form-input compact factura-numero" placeholder="Número" value="' + factura.numeroFactura + '" data-field="numeroFactura">' +
            '</div>' +
            
            '<div class="factura-field">' +
                '<label>Subtotal</label>' +
                '<input type="number" class="form-input compact factura-subtotal" placeholder="0.00" step="0.01" value="' + factura.subtotal + '" data-field="subtotal">' +
            '</div>' +
            
            '<div class="factura-field">' +
                '<label>IVA (%)</label>' +
                '<input type="number" class="form-input compact factura-iva" placeholder="0" step="0.01" value="' + factura.iva + '" data-field="iva">' +
            '</div>' +
            
            '<div class="factura-field">' +
                '<label>Total</label>' +
                '<div class="total-display compact factura-total" data-field="total">$' + formatNumber(factura.total) + '</div>' +
            '</div>' +
            
            '<div class="factura-field checkboxes">' +
                '<div class="checkbox-compact">' +
                    '<input type="checkbox" class="factura-sin-pagar" ' + (factura.sinPagar ? 'checked' : '') + ' data-field="sinPagar">' +
                    '<label>Sin Pagar</label>' +
                '</div>' +
                '<div class="checkbox-compact">' +
                    '<input type="checkbox" class="factura-pagado" ' + (factura.pagado ? 'checked' : '') + ' data-field="pagado">' +
                    '<label>Pagado</label>' +
                '</div>' +
            '</div>' +
            
            '<div class="factura-field comentarios-field">' +
                '<label>Comentarios</label>' +
                '<input type="text" class="form-input compact factura-comentarios" placeholder="Comentarios..." value="' + factura.comentarios + '" data-field="comentarios">' +
            '</div>' +
        '</div>';
    
    container.appendChild(facturaCard);
    
    // Agregar event listeners para esta tarjeta
    setupFacturaEventListeners(facturaCard);
    
    // Actualizar visibilidad del botón eliminar
    updateRemoveButtonsVisibility();
    
    // Actualizar resumen financiero
    updateResumenFinanciero();
}

// Configurar event listeners para una tarjeta de factura
function setupFacturaEventListeners(facturaCard) {
    const subtotalInput = facturaCard.querySelector('.factura-subtotal');
    const ivaInput = facturaCard.querySelector('.factura-iva');
    const totalDisplay = facturaCard.querySelector('.factura-total');
    const sinPagarCheckbox = facturaCard.querySelector('.factura-sin-pagar');
    const pagadoCheckbox = facturaCard.querySelector('.factura-pagado');
    
    function calcularTotal() {
        const subtotal = parseFloat(subtotalInput.value) || 0;
        const iva = parseFloat(ivaInput.value) || 0;
        const total = subtotal + (subtotal * iva / 100);
        totalDisplay.textContent = formatNumber(total);
        updateResumenFinanciero();
    }
    
    subtotalInput.addEventListener('input', calcularTotal);
    ivaInput.addEventListener('input', calcularTotal);
    
    sinPagarCheckbox.addEventListener('change', function() {
        if (this.checked) {
            pagadoCheckbox.checked = false;
        }
        updateResumenFinanciero();
    });
    
    pagadoCheckbox.addEventListener('change', function() {
        if (this.checked) {
            sinPagarCheckbox.checked = false;
        }
        updateResumenFinanciero();
    });
}

// Eliminar tarjeta de factura
function removeFacturaCard(facturaId) {
    const container = document.getElementById('facturasContainer');
    const facturaCard = container.querySelector('[data-factura-id="' + facturaId + '"]');
    
    if (facturaCard && container.children.length > 1) {
        facturaCard.remove();
        updateRemoveButtonsVisibility();
        updateResumenFinanciero();
    } else if (container.children.length <= 1) {
        showNotification('Debe mantener al menos una factura', 'warning');
    }
}

// Actualizar visibilidad de botones eliminar
function updateRemoveButtonsVisibility() {
    const container = document.getElementById('facturasContainer');
    const removeButtons = container.querySelectorAll('.btn-remove-factura');
    
    removeButtons.forEach(button => {
        if (container.children.length > 1) {
            button.style.display = 'flex';
        } else {
            button.style.display = 'none';
        }
    });
}

// Recopilar datos de todas las facturas
function collectFacturasData() {
    const container = document.getElementById('facturasContainer');
    const facturaCards = container.querySelectorAll('.factura-card');
    const facturas = [];
    
    facturaCards.forEach(card => {
        const factura = {};
        
        card.querySelectorAll('[data-field]').forEach(input => {
            const field = input.getAttribute('data-field');
            
            if (input.type === 'checkbox') {
                factura[field] = input.checked;
            } else if (input.type === 'number') {
                factura[field] = parseFloat(input.value) || 0;
            } else if (field === 'total') {
                const totalText = input.textContent?.replace(/,/g, '') || '0';
                factura[field] = parseFloat(totalText) || 0;
            } else {
                factura[field] = input.value.trim();
            }
        });
        
        facturas.push(factura);
    });
    
    return facturas;
}

// Save event changes
async function saveEventChanges() {
    if (!editingEventId) return;
    
    try {
        const facturas = collectFacturasData();
        
        const formData = {
            // CAMBIO PRINCIPAL: Guardar en numeroEvento en lugar de folio
            numeroEvento: document.getElementById('editFolio').value.trim(),
            nombreEvento: document.getElementById('editNombreEvento').value.trim(),
            operador: document.getElementById('editOperador').value.trim(),
            fechaInicio: new Date(document.getElementById('editFechaInicio').value),
            fechaFinal: new Date(document.getElementById('editFechaFinal').value),
            zona: document.getElementById('editZona').value.trim(),
            ciudad: document.getElementById('editCiudad').value.trim(),
            tieneOrdenSRE: document.getElementById('editTieneOrdenSRE').value === 'true',
            subtotalManual: parseFloat(elements.resumenSubtotalInput.value) || 0,
            ivaManual: parseFloat(elements.resumenIVAInput.value) || 0,
            
            facturas: facturas,
            
            numeroFactura: facturas[0] ? facturas[0].numeroFactura || '' : '',
            subtotal: facturas[0] ? facturas[0].subtotal || 0 : 0,
            iva: facturas[0] ? facturas[0].iva || 0 : 0,
            total: facturas.reduce((sum, f) => sum + f.total, 0),
            
            carpetaAuditoria: document.getElementById('editCarpetaAuditoria').value.trim(),
            observaciones: document.getElementById('editObservaciones').value.trim(),
            fechaModificacion: new Date()
        };
        
        if (!formData.nombreEvento || !formData.operador) {
            showNotification('Por favor complete todos los campos requeridos', 'error');
            return;
        }
        
        elements.saveEvent.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        elements.saveEvent.disabled = true;
        
        await db.collection('eventos').doc(editingEventId).update(formData);
        
        const eventIndex = allEvents.findIndex(e => e.id === editingEventId);
        if (eventIndex !== -1) {
            allEvents[eventIndex] = Object.assign(allEvents[eventIndex], formData);
        }
        
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
    
    document.getElementById('facturasContainer').innerHTML = '';
    facturaCounter = 1;
    
    const buttons = elements.editModal.querySelectorAll('.btn-add, .btn-remove-factura');
    buttons.forEach(btn => {
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
    return new Intl.NumberFormat('es-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
}

function showLoading(show) {
    elements.loading.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type) {
    type = type || 'info';
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    else if (type === 'error') iconClass = 'fa-exclamation-circle';
    else if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    
    notification.innerHTML = 
        '<i class="fas ' + iconClass + '"></i>' +
        '<span>' + message + '</span>' +
        '<button class="notification-close">' +
            '<i class="fas fa-times"></i>' +
        '</button>';
    
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
    return function () {
        const args = arguments;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Cargar opciones de operadores
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

// Global functions for onclick events
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;
window.addFacturaCard = addFacturaCard;
window.removeFacturaCard = removeFacturaCard;