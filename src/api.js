/**
 * IZSU API Service Module
 * Handles all API calls with caching and retry support
 * Cem Baspinar - MIT License
 */

const API = (function() {
    'use strict';

    const API_BASE = 'https://openapi.izmir.bel.tr/api/izsu';

    // Use CORS proxy for local development
    const IS_LOCAL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

    // CORS proxies with their URL builders
    // Each proxy has different URL format requirements
    const CORS_PROXIES = [
        {
            name: 'corsproxy.io',
            buildUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
        },
        {
            name: 'allorigins',
            buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
        },
        {
            name: 'cors-anywhere-alt',
            buildUrl: (url) => `https://proxy.cors.sh/${url}`
        }
    ];

    let currentProxyIndex = 0;

    function rotateProxy() {
        if (!IS_LOCAL) return false;
        currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
        console.log(`Switching to proxy: ${CORS_PROXIES[currentProxyIndex].name}`);
        return true;
    }

    function buildProxiedUrl(endpoint) {
        const fullUrl = `${API_BASE}/${endpoint}`;
        if (!IS_LOCAL) return fullUrl;
        return CORS_PROXIES[currentProxyIndex].buildUrl(fullUrl);
    }

    const ENDPOINTS = {
        OUTAGES: 'arizakaynaklisukesintileri',
        DAMS_WELLS: 'barajvekuyular',
        DAM_STATUS: 'barajdurum',
        DAILY_PRODUCTION: 'gunluksuuretimi',
        PRODUCTION_DISTRIBUTION: 'suuretiminindagilimi',
        WEEKLY_ANALYSIS: 'haftaliksuanalizleri',
        DISTRICT_ANALYSIS: 'cevreilcesuanalizleri',
        DAM_QUALITY: 'barajsukaliteraporlari'
    };

    const RETRY_CONFIG = {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000
    };

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Calculate exponential backoff delay
     * @param {number} attempt - Current attempt number (0-indexed)
     * @returns {number} Delay in milliseconds
     */
    function getBackoffDelay(attempt) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 500;
        return Math.min(delay + jitter, RETRY_CONFIG.maxDelayMs);
    }

    /**
     * Fetch with retry, exponential backoff, and proxy rotation
     * @param {string} endpoint - API endpoint (without base URL)
     * @returns {Promise<Object>} Parsed JSON data
     */
    async function fetchWithRetry(endpoint) {
        let lastError;
        let proxyAttempts = 0;
        const maxProxyAttempts = IS_LOCAL ? CORS_PROXIES.length : 1;

        while (proxyAttempts < maxProxyAttempts) {
            const url = buildProxiedUrl(endpoint);

            for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
                try {
                    const response = await fetch(url);
                    const data = await response.json();

                    // Check for error message in response body (server returns 200 with error)
                    if (data && data.message === 'An unexpected error occurred') {
                        lastError = new Error('Sunucu gecici olarak kulanilamiyor');
                        if (attempt < RETRY_CONFIG.maxRetries) {
                            const delay = getBackoffDelay(attempt);
                            console.log(`Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} for ${endpoint} after ${Math.round(delay)}ms (server error in body)`);
                            await sleep(delay);
                            continue;
                        }
                        break; // Try next proxy
                    }

                    if (response.ok) {
                        return data;
                    }

                    if (response.status >= 500) {
                        // Server error, retry
                        lastError = new Error(`API Hatasi: ${response.status}`);
                    } else {
                        // Client error, try next proxy
                        lastError = new Error(`API Hatasi: ${response.status}`);
                        break;
                    }
                } catch (error) {
                    if (error.name === 'TypeError') {
                        // Network error, retry
                        lastError = new Error('Ag baglantisi hatasi');
                    } else {
                        lastError = error;
                    }
                }

                if (attempt < RETRY_CONFIG.maxRetries) {
                    const delay = getBackoffDelay(attempt);
                    console.log(`Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} for ${endpoint} after ${Math.round(delay)}ms`);
                    await sleep(delay);
                }
            }

            // Try next proxy
            proxyAttempts++;
            if (proxyAttempts < maxProxyAttempts) {
                rotateProxy();
                console.log(`Trying next proxy for ${endpoint}...`);
            }
        }

        throw lastError || new Error('Maksimum deneme sayisina ulasildi');
    }

    /**
     * Fetch data from API with caching and retry
     * @param {string} endpoint - API endpoint name
     * @param {Object} params - Query parameters
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<*>} API response data
     */
    async function fetchWithCache(endpoint, params = {}, forceRefresh = false) {
        const cacheKey = buildCacheKey(endpoint, params);

        if (!forceRefresh) {
            const cached = Cache.get(cacheKey);
            if (cached !== null) {
                return cached;
            }
        }

        const endpointWithParams = buildEndpointWithParams(endpoint, params);
        const data = await fetchWithRetry(endpointWithParams);

        Cache.set(cacheKey, data);
        return data;
    }

    /**
     * Build endpoint with query parameters
     * @param {string} endpoint - Endpoint name
     * @param {Object} params - Query parameters
     * @returns {string} Endpoint with query string
     */
    function buildEndpointWithParams(endpoint, params = {}) {
        const queryParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                queryParams.append(key, value);
            }
        });

        const queryString = queryParams.toString();
        if (queryString) {
            return `${endpoint}?${queryString}`;
        }

        return endpoint;
    }

    /**
     * Build cache key from endpoint and params
     * @param {string} endpoint - Endpoint name
     * @param {Object} params - Query parameters
     * @returns {string} Cache key
     */
    function buildCacheKey(endpoint, params = {}) {
        const paramStr = Object.entries(params)
            .filter(([_, v]) => v !== null && v !== undefined && v !== '')
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('&');

        return paramStr ? `${endpoint}_${paramStr}` : endpoint;
    }

    /**
     * Get fault-based water outages
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Array>} Outage data
     */
    async function getOutages(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.OUTAGES, {}, forceRefresh);
    }

    /**
     * Get dams and wells list
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Array>} Dams and wells data
     */
    async function getDamsAndWells(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAMS_WELLS, {}, forceRefresh);
    }

    /**
     * Get dam status (fill rates, capacity)
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Array>} Dam status data
     */
    async function getDamStatus(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAM_STATUS, {}, forceRefresh);
    }

    /**
     * Get daily water production
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Object>} Daily production data
     */
    async function getDailyProduction(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAILY_PRODUCTION, {}, forceRefresh);
    }

    /**
     * Get water production distribution by month/source
     * @param {number|null} year - Optional year filter
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Array>} Production distribution data
     */
    async function getProductionDistribution(year = null, forceRefresh = false) {
        const params = year ? { Yil: year } : {};
        return fetchWithCache(ENDPOINTS.PRODUCTION_DISTRIBUTION, params, forceRefresh);
    }

    /**
     * Get weekly water analysis results
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Object>} Weekly analysis data
     */
    async function getWeeklyAnalysis(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.WEEKLY_ANALYSIS, {}, forceRefresh);
    }

    /**
     * Get district center analysis results
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Object>} District analysis data
     */
    async function getDistrictAnalysis(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DISTRICT_ANALYSIS, {}, forceRefresh);
    }

    /**
     * Get dam water quality reports
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Object>} Dam quality reports
     */
    async function getDamQuality(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAM_QUALITY, {}, forceRefresh);
    }

    /**
     * Fetch all data concurrently with individual error handling
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Object>} All API data with error states
     */
    async function fetchAll(forceRefresh = false) {
        const results = await Promise.allSettled([
            getOutages(forceRefresh),
            getDamsAndWells(forceRefresh),
            getDamStatus(forceRefresh),
            getDailyProduction(forceRefresh),
            getProductionDistribution(null, forceRefresh),
            getWeeklyAnalysis(forceRefresh),
            getDistrictAnalysis(forceRefresh),
            getDamQuality(forceRefresh)
        ]);

        const extract = (result, fallback) => {
            if (result.status === 'fulfilled') {
                return { data: result.value, error: null };
            }
            console.error('API Error:', result.reason);
            return { data: fallback, error: result.reason?.message || 'Unknown error' };
        };

        return {
            outages: extract(results[0], []).data,
            outagesError: extract(results[0], []).error,
            damsWells: extract(results[1], []).data,
            damsWellsError: extract(results[1], []).error,
            damStatus: extract(results[2], []).data,
            damStatusError: extract(results[2], []).error,
            dailyProduction: extract(results[3], null).data,
            dailyProductionError: extract(results[3], null).error,
            productionDistribution: extract(results[4], []).data,
            productionDistributionError: extract(results[4], []).error,
            weeklyAnalysis: extract(results[5], null).data,
            weeklyAnalysisError: extract(results[5], null).error,
            districtAnalysis: extract(results[6], null).data,
            districtAnalysisError: extract(results[6], null).error,
            damQuality: extract(results[7], null).data,
            damQualityError: extract(results[7], null).error
        };
    }

    /**
     * Get last update timestamp from any cached endpoint
     * @returns {number|null} Timestamp or null
     */
    function getLastUpdateTime() {
        const endpoints = Object.values(ENDPOINTS);
        let latestTimestamp = null;

        for (const endpoint of endpoints) {
            const timestamp = Cache.getTimestamp(endpoint);
            if (timestamp && (!latestTimestamp || timestamp > latestTimestamp)) {
                latestTimestamp = timestamp;
            }
        }

        return latestTimestamp;
    }

    /**
     * Check if any data needs refresh
     * @returns {boolean} True if refresh needed
     */
    function needsRefresh() {
        const endpoints = Object.values(ENDPOINTS);
        return endpoints.some(endpoint => !Cache.has(endpoint));
    }

    return {
        getOutages,
        getDamsAndWells,
        getDamStatus,
        getDailyProduction,
        getProductionDistribution,
        getWeeklyAnalysis,
        getDistrictAnalysis,
        getDamQuality,
        fetchAll,
        getLastUpdateTime,
        needsRefresh,
        ENDPOINTS
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
