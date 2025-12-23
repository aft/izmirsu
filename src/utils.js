/**
 * IZSU Utility Functions
 * Formatting, translation helpers, and common utilities
 * Cem Baspinar - MIT License
 */

const Utils = (function() {
    'use strict';

    /**
     * Translate parameter name from Turkish to current language
     * @param {string} param - Parameter name from API (Turkish)
     * @returns {string} Translated parameter name
     */
    function translateParam(param) {
        if (!param) return '-';
        const translated = I18n.t(`params.${param}`);
        return translated.startsWith('params.') ? param : translated;
    }

    /**
     * Translate analysis value (like UYGUN)
     * @param {string} value - Value from API
     * @returns {string} Translated value
     */
    function translateValue(value) {
        if (!value) return '-';
        const translated = I18n.t(`analysisValues.${value}`);
        return translated.startsWith('analysisValues.') ? value : translated;
    }

    /**
     * Translate unit from Turkish to current language
     * @param {string} unit - Unit from API
     * @returns {string} Translated unit
     */
    function translateUnit(unit) {
        if (!unit) return '';
        const translated = I18n.t(`analysisUnits.${unit}`);
        return translated.startsWith('analysisUnits.') ? unit : translated;
    }

    /**
     * Format date string
     * @param {string} dateStr - Date string to format
     * @returns {string} Formatted date
     */
    function formatDate(dateStr) {
        if (!dateStr) return '-';

        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    }

    /**
     * Format date time string
     * @param {number|string} timestamp - Timestamp to format
     * @returns {string} Formatted date time
     */
    function formatDateTime(timestamp) {
        if (!timestamp) return '-';

        try {
            const date = new Date(timestamp);
            return date.toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '-';
        }
    }

    /**
     * Format number with locale
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    function formatNumber(num) {
        if (num === null || num === undefined) return '-';
        const locale = I18n.getCurrentLanguage() === 'en' ? 'en-US' : 'tr-TR';
        return num.toLocaleString(locale);
    }

    /**
     * Format large numbers with units (K, M, B)
     * @param {number} num - Number to format
     * @returns {string} Formatted string with unit
     */
    function formatLargeNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(2) + ' ' + I18n.t('units.billion');
        }
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + ' ' + I18n.t('units.million');
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + ' ' + I18n.t('units.thousand');
        }
        return formatNumber(num);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Normalize Turkish characters to ASCII
     * @param {string} str - String with Turkish characters
     * @returns {string} ASCII normalized string
     */
    function normalizeTurkish(str) {
        if (!str) return '';
        return str
            .replace(/ı/g, 'i')
            .replace(/İ/g, 'I')
            .replace(/ğ/g, 'g')
            .replace(/Ğ/g, 'G')
            .replace(/ü/g, 'u')
            .replace(/Ü/g, 'U')
            .replace(/ş/g, 's')
            .replace(/Ş/g, 'S')
            .replace(/ö/g, 'o')
            .replace(/Ö/g, 'O')
            .replace(/ç/g, 'c')
            .replace(/Ç/g, 'C')
            .replace(/â/g, 'a')
            .replace(/Â/g, 'A');
    }

    /**
     * Get color for fill bar based on percentage
     * @param {number} pct - Percentage (0-100)
     * @returns {string} RGB color string
     */
    function getGradientColor(pct) {
        const red = { r: 239, g: 68, b: 68 };
        const yellow = { r: 245, g: 158, b: 11 };
        const green = { r: 34, g: 197, b: 94 };

        let r, g, b;

        if (pct <= 35) {
            const t = pct / 35;
            r = Math.round(red.r + (yellow.r - red.r) * t);
            g = Math.round(red.g + (yellow.g - red.g) * t);
            b = Math.round(red.b + (yellow.b - red.b) * t);
        } else {
            const t = (pct - 35) / 65;
            r = Math.round(yellow.r + (green.r - yellow.r) * t);
            g = Math.round(yellow.g + (green.g - yellow.g) * t);
            b = Math.round(yellow.b + (green.b - yellow.b) * t);
        }

        return `rgb(${r}, ${g}, ${b})`;
    }

    return {
        translateParam,
        translateValue,
        translateUnit,
        formatDate,
        formatDateTime,
        formatNumber,
        formatLargeNumber,
        escapeHtml,
        normalizeTurkish,
        getGradientColor
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
