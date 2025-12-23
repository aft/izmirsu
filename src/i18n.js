/**
 * IZSU Localization Module
 * Simple, modular i18n system with per-language files
 * Cem Baspinar - MIT License
 */

const I18n = (function() {
    'use strict';

    let currentLang = 'tr';
    let translations = {};
    const availableLanguages = ['tr', 'en'];
    const languageNames = {
        tr: 'Turkce',
        en: 'English'
    };

    /**
     * Load a language file
     * @param {string} lang - Language code (e.g., 'tr', 'en')
     * @returns {Promise<boolean>} Success status
     */
    async function loadLanguage(lang) {
        if (!availableLanguages.includes(lang)) {
            console.warn(`Language '${lang}' not available`);
            return false;
        }

        try {
            const response = await fetch(`lang/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load language file: ${lang}`);
            }
            translations[lang] = await response.json();
            return true;
        } catch (error) {
            console.error(`Error loading language '${lang}':`, error);
            return false;
        }
    }

    /**
     * Set current language
     * @param {string} lang - Language code
     * @returns {Promise<boolean>} Success status
     */
    async function setLanguage(lang) {
        if (!translations[lang]) {
            const loaded = await loadLanguage(lang);
            if (!loaded) return false;
        }

        currentLang = lang;
        localStorage.setItem('izsu_language', lang);
        applyTranslations();
        document.documentElement.setAttribute('lang', lang);
        return true;
    }

    /**
     * Get translation for a key
     * @param {string} key - Translation key (dot notation supported)
     * @param {Object} params - Optional parameters for interpolation
     * @returns {string} Translated string or key if not found
     */
    function t(key, params = {}) {
        const langData = translations[currentLang] || {};
        let value = getNestedValue(langData, key);

        if (value === undefined) {
            // Fallback to Turkish
            const fallback = translations['tr'] || {};
            value = getNestedValue(fallback, key);
        }

        if (value === undefined) {
            return key;
        }

        // Interpolate parameters
        return interpolate(value, params);
    }

    /**
     * Get nested value from object using dot notation
     * @param {Object} obj - Object to search
     * @param {string} path - Dot-notation path
     * @returns {*} Value or undefined
     */
    function getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Interpolate parameters into string
     * @param {string} str - String with {param} placeholders
     * @param {Object} params - Parameters to interpolate
     * @returns {string} Interpolated string
     */
    function interpolate(str, params) {
        return str.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    /**
     * Apply translations to DOM elements with data-i18n attribute
     */
    function applyTranslations() {
        // Translate elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = t(key);

            // Check if it's an input placeholder
            if (el.hasAttribute('data-i18n-placeholder')) {
                el.placeholder = translated;
            }
            // Check if it's a title/tooltip
            else if (el.hasAttribute('data-i18n-title')) {
                el.title = translated;
            }
            // Check if it's an aria-label
            else if (el.hasAttribute('data-i18n-aria')) {
                el.setAttribute('aria-label', translated);
            }
            // Default: set text content
            else {
                el.textContent = translated;
            }
        });

        // Translate elements with data-i18n-html (allows HTML content)
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            el.innerHTML = t(key);
        });
    }

    /**
     * Get current language
     * @returns {string} Current language code
     */
    function getCurrentLanguage() {
        return currentLang;
    }

    /**
     * Get available languages
     * @returns {Array<{code: string, name: string}>} Available languages
     */
    function getAvailableLanguages() {
        return availableLanguages.map(code => ({
            code,
            name: languageNames[code] || code
        }));
    }

    /**
     * Initialize i18n system
     * @returns {Promise<void>}
     */
    async function init() {
        // Load saved language preference
        const savedLang = localStorage.getItem('izsu_language');
        const browserLang = navigator.language.split('-')[0];
        const defaultLang = savedLang || 'tr';

        // Always load Turkish as fallback
        await loadLanguage('tr');

        // Load and set the default language
        await setLanguage(defaultLang);
    }

    return {
        init,
        t,
        setLanguage,
        getCurrentLanguage,
        getAvailableLanguages,
        applyTranslations
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18n;
}
