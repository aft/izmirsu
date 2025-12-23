/**
 * IZSU UI Module
 * Handles UI state, navigation, modals, loading, and toasts
 * Cem Baspinar - MIT License
 */

const UI = (function() {
    'use strict';

    /**
     * Show/hide loading overlay
     * @param {boolean} show - Whether to show loading
     */
    function showLoading(show) {
        document.getElementById('loadingOverlay').classList.toggle('active', show);
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type: 'info', 'success', 'error'
     */
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    /**
     * Open modal by ID
     * @param {string} modalId - Modal element ID
     */
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    /**
     * Close modal by ID
     * @param {string} modalId - Modal element ID
     */
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Navigate to a section
     * @param {string} section - Section ID
     */
    function navigateToSection(section) {
        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.section === section);
        });

        // Update sections
        document.querySelectorAll('.section').forEach(sec => {
            sec.classList.toggle('active', sec.id === section);
        });

        // Update URL hash
        window.location.hash = section;

        // Scroll to top
        window.scrollTo(0, 0);
    }

    /**
     * Handle nav link click
     * @param {Event} e - Click event
     */
    function handleNavClick(e) {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        if (section) {
            navigateToSection(section);
        }
    }

    /**
     * Handle hash change for navigation
     */
    function handleHashChange() {
        const hash = window.location.hash.slice(1);
        if (hash) {
            navigateToSection(hash);
        }
    }

    /**
     * Handle tab click
     * @param {Event} e - Click event
     */
    function handleTabClick(e) {
        const btn = e.currentTarget;
        const tabId = btn.dataset.tab;
        const parent = btn.closest('.section');

        if (!parent) return;

        // Update button states
        parent.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tabId);
        });

        // Update tab content
        parent.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}-content`);
        });
    }

    /**
     * Update status bar with last update time and cache stats
     */
    function updateStatusBar() {
        const lastUpdate = API.getLastUpdateTime();
        const stats = Cache.getStats();

        document.getElementById('lastUpdate').textContent = lastUpdate
            ? Utils.formatDateTime(lastUpdate)
            : I18n.t('status.notUpdated');

        document.getElementById('cacheStatus').textContent =
            `${stats.entryCount} ${I18n.t('status.records')}, ${stats.totalSizeKB} KB`;
    }

    /**
     * Apply saved settings (theme, accent, etc.)
     */
    function applySettings() {
        const settings = Cache.getSettings();

        document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
        document.documentElement.setAttribute('data-accent', settings.accentColor || 'cyan');

        const cacheDurationInput = document.getElementById('cacheDuration');
        const themeSelect = document.getElementById('themeSelect');
        const accentSelect = document.getElementById('accentColor');
        const languageSelect = document.getElementById('languageSelect');

        if (cacheDurationInput) cacheDurationInput.value = settings.cacheDurationHours || 24;
        if (themeSelect) themeSelect.value = settings.theme || 'dark';
        if (accentSelect) accentSelect.value = settings.accentColor || 'cyan';
        if (languageSelect) languageSelect.value = I18n.getCurrentLanguage();
    }

    /**
     * Save settings from modal
     * @returns {Promise<void>}
     */
    async function saveSettings() {
        const settings = {
            cacheDurationHours: parseInt(document.getElementById('cacheDuration').value) || 24,
            theme: document.getElementById('themeSelect').value,
            accentColor: document.getElementById('accentColor').value
        };

        // Handle language change
        const newLanguage = document.getElementById('languageSelect').value;
        const currentLanguage = I18n.getCurrentLanguage();
        if (newLanguage !== currentLanguage) {
            await I18n.setLanguage(newLanguage);
        }

        Cache.saveSettings(settings);
        applySettings();
        Charts.updateAllCharts();

        closeModal('settingsModal');
        showToast(I18n.t('toast.settingsSaved'), 'success');
    }

    /**
     * Clear cache
     */
    function clearCache() {
        Cache.clearAll();
        showToast(I18n.t('toast.cacheCleared'), 'success');
        updateStatusBar();
    }

    /**
     * Initialize sortable table
     * @param {string} tableId - Table element ID
     */
    function initSortableTable(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const headers = table.querySelectorAll('th[data-sort]');
        let currentSort = { column: null, direction: 'asc' };

        headers.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const column = header.dataset.sort;
                const direction = currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc';

                sortTable(table, column, direction);
                currentSort = { column, direction };

                // Update header indicators
                headers.forEach(h => {
                    h.classList.remove('sort-asc', 'sort-desc');
                });
                header.classList.add(`sort-${direction}`);
            });
        });
    }

    /**
     * Sort table by column
     * @param {HTMLTableElement} table - Table element
     * @param {string} column - Column index or data attribute
     * @param {string} direction - 'asc' or 'desc'
     */
    function sortTable(table, column, direction) {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        const colIndex = parseInt(column);

        rows.sort((a, b) => {
            const aVal = a.cells[colIndex]?.textContent.trim() || '';
            const bVal = b.cells[colIndex]?.textContent.trim() || '';

            // Try numeric comparison
            const aNum = parseFloat(aVal.replace(/[^\d.-]/g, ''));
            const bNum = parseFloat(bVal.replace(/[^\d.-]/g, ''));

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return direction === 'asc' ? aNum - bNum : bNum - aNum;
            }

            // String comparison
            return direction === 'asc'
                ? aVal.localeCompare(bVal, 'tr')
                : bVal.localeCompare(aVal, 'tr');
        });

        rows.forEach(row => tbody.appendChild(row));
    }

    return {
        showLoading,
        showToast,
        openModal,
        closeModal,
        navigateToSection,
        handleNavClick,
        handleHashChange,
        handleTabClick,
        updateStatusBar,
        applySettings,
        saveSettings,
        clearCache,
        initSortableTable
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}
