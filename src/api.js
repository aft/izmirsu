/**
 * IZSU API Service Module
 * Uses GitHub Gist (updated hourly by GitHub Actions)
 * Cem Baspinar - MIT License
 */

const API = (function() {
    'use strict';

    // GitHub Gist URL (updated hourly by GitHub Actions)
    const GIST_URL =
        "https://gist.githubusercontent.com/aft/3277579cab49d20d3fd0a8705119db0c/raw/izsu-data.json";

    // Endpoint names for cache keys
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

    // Cache for Gist data (in-memory)
    let gistData = null;
    let gistFetchPromise = null;

    /**
     * Fetch data from GitHub Gist
     * @returns {Promise<Object|null>} Gist data or null if unavailable
     */
    async function fetchFromGist() {
        // Return cached if available and fresh (< 5 min)
        if (gistData && gistData._fetchedAt && (Date.now() - gistData._fetchedAt < 300000)) {
            return gistData;
        }

        // Deduplicate concurrent requests
        if (gistFetchPromise) {
            return gistFetchPromise;
        }

        gistFetchPromise = (async () => {
            try {
                // Add cache-busting param
                const url = `${GIST_URL}?t=${Date.now()}`;
                const response = await fetch(url);

                if (!response.ok) {
                    console.warn('Gist fetch failed:', response.status);
                    return null;
                }

                const data = await response.json();
                data._fetchedAt = Date.now();
                gistData = data;
                console.log('Gist data loaded, timestamp:', data.timestamp);
                return data;
            } catch (error) {
                console.warn('Gist fetch error:', error.message);
                return null;
            } finally {
                gistFetchPromise = null;
            }
        })();

        return gistFetchPromise;
    }

    /**
     * Get data from Gist endpoint
     * @param {string} endpoint - Endpoint name
     * @returns {Promise<*>} Data from Gist or null
     */
    async function getFromGist(endpoint) {
        const data = await fetchFromGist();
        if (data && data.endpoints && data.endpoints[endpoint]) {
            const endpointData = data.endpoints[endpoint];
            if (!endpointData.error) {
                return endpointData;
            }
        }
        return null;
    }

    /**
     * Fetch with local caching
     */
    async function fetchWithCache(cacheKey, fetchFn, forceRefresh = false) {
        if (!forceRefresh) {
            const cached = Cache.get(cacheKey);
            if (cached !== null) {
                return cached;
            }
        }

        const data = await fetchFn();
        if (data) {
            Cache.set(cacheKey, data);
        }
        return data;
    }

    /**
     * Get dam status
     */
    async function getDamStatus(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAM_STATUS, async () => {
            return await getFromGist('barajdurum') || [];
        }, forceRefresh);
    }

    /**
     * Get daily production
     */
    async function getDailyProduction(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAILY_PRODUCTION, async () => {
            return await getFromGist('gunluksuuretimi') || null;
        }, forceRefresh);
    }

    /**
     * Get production distribution
     */
    async function getProductionDistribution(year = null, forceRefresh = false) {
        const cacheKey = year ? `${ENDPOINTS.PRODUCTION_DISTRIBUTION}_${year}` : ENDPOINTS.PRODUCTION_DISTRIBUTION;

        return fetchWithCache(cacheKey, async () => {
            const data = await getFromGist('suuretiminindagilimi');
            if (!data) return [];

            // Filter by year if specified
            if (year && Array.isArray(data)) {
                return data.filter(r => r.Yil === year);
            }
            return data;
        }, forceRefresh);
    }

    /**
     * Get outages
     */
    async function getOutages(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.OUTAGES, async () => {
            return await getFromGist('arizakaynaklisukesintileri') || [];
        }, forceRefresh);
    }

    /**
     * Get dams and wells
     */
    async function getDamsAndWells(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAMS_WELLS, async () => {
            return await getFromGist('barajvekuyular') || [];
        }, forceRefresh);
    }

    /**
     * Get weekly analysis
     */
    async function getWeeklyAnalysis(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.WEEKLY_ANALYSIS, async () => {
            return await getFromGist('haftaliksuanalizleri') || { Pinotlar: [] };
        }, forceRefresh);
    }

    /**
     * Get district analysis
     */
    async function getDistrictAnalysis(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DISTRICT_ANALYSIS, async () => {
            return await getFromGist('cevreilcesuanalizleri') || { Pinotlar: [] };
        }, forceRefresh);
    }

    /**
     * Get dam quality
     */
    async function getDamQuality(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAM_QUALITY, async () => {
            return await getFromGist('barajsukaliteraporlari') || { Pinotlar: [] };
        }, forceRefresh);
    }

    /**
     * Fetch all data concurrently
     */
    async function fetchAll(forceRefresh = false) {
        // Pre-fetch gist data once
        await fetchFromGist();

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
            if (result.status === 'fulfilled' && result.value !== null) {
                return { data: result.value, error: null };
            }
            return { data: fallback, error: result.reason?.message || 'Data unavailable' };
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

    function getLastUpdateTime() {
        if (gistData && gistData.timestamp) {
            return new Date(gistData.timestamp).getTime();
        }
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

    function needsRefresh() {
        return !gistData;
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
