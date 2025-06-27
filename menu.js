// DOM Elements
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const menuCards = document.querySelectorAll('.menu-card');

// Check authentication state
auth.onAuthStateChanged((user) => {
    if (!user) {
        console.log('Usuario no autenticado, redirigiendo al login...');
        // Redirigir automáticamente al login
        window.location.href = 'index.html';
    } else {
        console.log('Usuario autenticado:', user);
        userEmail.textContent = user.email || 'Usuario';
        document.body.classList.add('fade-in');
    }
});

// Logout functionality
logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    try {
        logoutBtn.disabled = true;
        logoutBtn.innerHTML = `
            <svg class="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Cerrando...
        `;
        
        await auth.signOut();
        console.log('Usuario desconectado');
        
        // Redirigir al login después de cerrar sesión
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        
        logoutBtn.disabled = false;
        logoutBtn.innerHTML = `
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            Cerrar Sesión
        `;
        
        alert('Error al cerrar sesión. Inténtalo de nuevo.');
    }
});

// Menu navigation functionality
menuCards.forEach((card, index) => {
    const button = card.querySelector('button');
    
    card.addEventListener('click', (e) => {
        e.preventDefault();
        handleMenuNavigation(index);
    });
    
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMenuNavigation(index);
    });
});

// Handle menu navigation
function handleMenuNavigation(index) {
    const menuOptions = [
        {
            name: 'Captura Nuevo Evento',
            url: 'nuevo-evento.html',
            action: () => navigateToPage('nuevo-evento.html')
        },
        {
            name: 'Modificación de Evento',
            url: 'modificacion.html',
            action: () => navigateToPage('modificacion.html')
        },
        {
            name: 'Reportes',
            url: 'reportes.html',
            action: () => navigateToPage('reportes.html')
        },
        {
            name: 'Dashboard',
            url: 'dashboard.html',
            action: () => navigateToPage('dashboard.html')
        }
    ];
    
    const selectedOption = menuOptions[index];
    
    if (selectedOption) {
        console.log(`Navegando a: ${selectedOption.name}`);
        
        const card = menuCards[index];
        const button = card.querySelector('button');
        const originalText = button.textContent;
        
        button.innerHTML = `
            <svg class="animate-spin h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        `;
        
        setTimeout(() => {
            selectedOption.action();
            button.textContent = originalText;
        }, 500);
    }
}

// Navigate to page function
function navigateToPage(url) {
    const comingSoonPages = ['nuevo-evento.html', 'modificar-evento.html', 'reportes.html', 'dashboard.html'];
    
    if (comingSoonPages.includes(url)) {
        showComingSoon(url);
    } else {
        window.location.href = url;
    }
}

// Show coming soon modal
function showComingSoon(page) {
    const pageName = page.replace('.html', '').replace('-', ' ');
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Próximamente</h3>
            <p class="text-gray-600 mb-6">La sección "${pageName}" estará disponible pronto.</p>
            <button onclick="this.parentElement.parentElement.remove()" class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200">
                Entendido
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    setTimeout(() => {
        if (document.body.contains(modal)) {
            modal.remove();
        }
    }, 5000);
}

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && e.ctrlKey) {
        logoutBtn.click();
    }
    
    const numberKey = parseInt(e.key);
    if (numberKey >= 1 && numberKey <= 4) {
        handleMenuNavigation(numberKey - 1);
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    console.log('Menu loaded successfully');
    
    menuCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
});

console.log('Menu script initialized successfully');