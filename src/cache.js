/**
 * IZSU Data Cache Module
 * Handles localStorage caching with configurable TTL
 * Cem Baspinar - MIT License
 */

const Cache = (function() {
    'use strict';

    const CACHE_PREFIX = 'izsu_';
    const SETTINGS_KEY = 'izsu_settings';
    const DEFAULT_TTL_HOURS = 24;

    /**
     * Get current settings from localStorage
     * @returns {Object} Settings object
     */
    function getSettings() {
        try {
            const stored = localStorage.getItem(SETTINGS_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to parse settings:', e);
        }
        return {
            cacheDurationHours: DEFAULT_TTL_HOURS,
            theme: 'dark',
            accentColor: 'cyan'
        };
    }

    /**
     * Save settings to localStorage
     * @param {Object} settings - Settings object
     */
    function saveSettings(settings) {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    /**
     * Get TTL in milliseconds from settings
     * @returns {number} TTL in milliseconds
     */
    function getTTL() {
        const settings = getSettings();
        return settings.cacheDurationHours * 60 * 60 * 1000;
    }

    /**
     * Generate cache key with prefix
     * @param {string} key - Base key
     * @returns {string} Prefixed key
     */
    function getCacheKey(key) {
        return CACHE_PREFIX + key;
    }

    /**
     * Get cached data if valid
     * @param {string} key - Cache key
     * @returns {*} Cached data or null if expired/missing
     */
    function get(key) {
        try {
            const cacheKey = getCacheKey(key);
            const stored = localStorage.getItem(cacheKey);

            if (!stored) {
                return null;
            }

            const { data, timestamp } = JSON.parse(stored);
            const now = Date.now();
            const ttl = getTTL();

            if (now - timestamp > ttl) {
                localStorage.removeItem(cacheKey);
                return null;
            }

            return data;
        } catch (e) {
            console.warn('Cache read error for key:', key, e);
            return null;
        }
    }

    /**
     * Store data in cache
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     */
    function set(key, data) {
        try {
            const cacheKey = getCacheKey(key);
            const cacheEntry = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        } catch (e) {
            console.error('Cache write error for key:', key, e);
            if (e.name === 'QuotaExceededError') {
                clearOldEntries();
                try {
                    const cacheKey = getCacheKey(key);
                    const cacheEntry = {
                        data: data,
                        timestamp: Date.now()
                    };
                    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
                } catch (retryError) {
                    console.error('Cache write failed after cleanup:', retryError);
                }
            }
        }
    }

    /**
     * Check if cache entry exists and is valid
     * @param {string} key - Cache key
     * @returns {boolean} True if valid cache exists
     */
    function has(key) {
        return get(key) !== null;
    }

    /**
     * Get cache entry age in human-readable format
     * @param {string} key - Cache key
     * @returns {string|null} Age string or null
     */
    function getAge(key) {
        try {
            const cacheKey = getCacheKey(key);
            const stored = localStorage.getItem(cacheKey);

            if (!stored) {
                return null;
            }

            const { timestamp } = JSON.parse(stored);
            const ageMs = Date.now() - timestamp;
            const ageMinutes = Math.floor(ageMs / 60000);
            const ageHours = Math.floor(ageMinutes / 60);

            if (ageHours > 0) {
                return `${ageHours} saat ${ageMinutes % 60} dk once`;
            }
            return `${ageMinutes} dk once`;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get timestamp of cache entry
     * @param {string} key - Cache key
     * @returns {number|null} Timestamp or null
     */
    function getTimestamp(key) {
        try {
            const cacheKey = getCacheKey(key);
            const stored = localStorage.getItem(cacheKey);

            if (!stored) {
                return null;
            }

            const { timestamp } = JSON.parse(stored);
            return timestamp;
        } catch (e) {
            return null;
        }
    }

    /**
     * Remove specific cache entry
     * @param {string} key - Cache key
     */
    function remove(key) {
        try {
            localStorage.removeItem(getCacheKey(key));
        } catch (e) {
            console.error('Cache remove error:', e);
        }
    }

    /**
     * Clear all IZSU cache entries
     */
    function clearAll() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (e) {
            console.error('Cache clear error:', e);
        }
    }

    /**
     * Clear old/expired cache entries
     */
    function clearOldEntries() {
        try {
            const now = Date.now();
            const ttl = getTTL();
            const keysToRemove = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX) && key !== SETTINGS_KEY) {
                    try {
                        const stored = localStorage.getItem(key);
                        const { timestamp } = JSON.parse(stored);
                        if (now - timestamp > ttl) {
                            keysToRemove.push(key);
                        }
                    } catch (e) {
                        keysToRemove.push(key);
                    }
                }
            }

            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (e) {
            console.error('Clear old entries error:', e);
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    function getStats() {
        let totalSize = 0;
        let entryCount = 0;
        let oldestTimestamp = Date.now();
        let newestTimestamp = 0;

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX) && key !== SETTINGS_KEY) {
                    const value = localStorage.getItem(key);
                    totalSize += value.length;
                    entryCount++;

                    try {
                        const { timestamp } = JSON.parse(value);
                        if (timestamp < oldestTimestamp) oldestTimestamp = timestamp;
                        if (timestamp > newestTimestamp) newestTimestamp = timestamp;
                    } catch (e) {
                        // Skip invalid entries
                    }
                }
            }
        } catch (e) {
            console.error('Get stats error:', e);
        }

        return {
            entryCount,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            oldestTimestamp: entryCount > 0 ? oldestTimestamp : null,
            newestTimestamp: entryCount > 0 ? newestTimestamp : null,
            ttlHours: getSettings().cacheDurationHours
        };
    }

    return {
        get,
        set,
        has,
        remove,
        clearAll,
        clearOldEntries,
        getAge,
        getTimestamp,
        getStats,
        getSettings,
        saveSettings
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cache;
}
