/**
 * IZSU API Service Module
 * Uses GitHub Gist (primary) + CKAN Datastore (fallback)
 * Cem Baspinar - MIT License
 */

const API = (function() {
    'use strict';

    // GitHub Gist URL (updated hourly by GitHub Actions)
    // Replace with your actual Gist raw URL after setup
    const GIST_URL =
        "https://gist.githubusercontent.com/aft/3277579cab49d20d3fd0a8705119db0c/raw/izsu-data.json";

    // CKAN Datastore API (fallback, has valid SSL)
    const CKAN_BASE = 'https://acikveri.bizizmir.com/api/3/action/datastore_search';

    // Resource IDs for CKAN datastore (CSV resources that have datastore)
    const CKAN_RESOURCES = {
        DAM_STATUS: '5c2ad5b0-f681-45a6-b72c-170791ea8f50',
        DAILY_PRODUCTION: '0eca9087-41de-4beb-93a2-d7129faede40',
        PRODUCTION_DISTRIBUTION: 'e3f93f98-38a3-41d9-b89e-a7d1d378475b',
        CONSUMPTION: '7a7485e5-2f04-4daf-9cc0-75ef1c24bc23',
        WATER_LOSSES: '0c70a23a-b293-4906-a348-2cbd5be65d86',
        TARIFFS: 'a523da27-7756-439b-83ed-1da073d8dc86'
    };

    // Legacy endpoint names for cache compatibility
    const ENDPOINTS = {
        OUTAGES: 'arizakaynaklisukesintileri',
        DAMS_WELLS: 'barajvekuyular',
        DAM_STATUS: 'barajdurum',
        DAILY_PRODUCTION: 'gunluksuuretimi',
        PRODUCTION_DISTRIBUTION: 'suuretiminindagilimi',
        WEEKLY_ANALYSIS: 'haftaliksuanalizleri',
        DISTRICT_ANALYSIS: 'cevreilcesuanalizleri',
        DAM_QUALITY: 'barajsukaliteraporlari',
        CONSUMPTION: 'tuketim',
        WATER_LOSSES: 'sukayiplari',
        TARIFFS: 'tarifeler'
    };

    const RETRY_CONFIG = {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000
    };

    // Cache for Gist data (in-memory)
    let gistData = null;
    let gistFetchPromise = null;

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fetch data from GitHub Gist (primary source)
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
     * Get data from Gist endpoint with fallback
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

    function getBackoffDelay(attempt) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 500;
        return Math.min(delay + jitter, RETRY_CONFIG.maxDelayMs);
    }

    /**
     * Fetch from CKAN datastore with retry
     * @param {string} resourceId - CKAN resource ID
     * @param {number} limit - Max records to fetch
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Records array
     */
    async function fetchFromCKAN(resourceId, limit = 1000, filters = {}) {
        let lastError;

        for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
            try {
                const params = new URLSearchParams({
                    resource_id: resourceId,
                    limit: limit.toString()
                });

                // Add filters if provided
                if (Object.keys(filters).length > 0) {
                    params.append('filters', JSON.stringify(filters));
                }

                const url = `${CKAN_BASE}?${params.toString()}`;
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`CKAN API Hatasi: ${response.status}`);
                }

                const json = await response.json();

                if (!json.success) {
                    throw new Error(json.error?.message || 'CKAN API hatasi');
                }

                return json.result.records;
            } catch (error) {
                lastError = error;
                if (attempt < RETRY_CONFIG.maxRetries) {
                    const delay = getBackoffDelay(attempt);
                    console.log(`CKAN retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} for ${resourceId} after ${Math.round(delay)}ms`);
                    await sleep(delay);
                }
            }
        }

        throw lastError;
    }

    /**
     * Fetch with caching
     */
    async function fetchWithCache(cacheKey, fetchFn, forceRefresh = false) {
        if (!forceRefresh) {
            const cached = Cache.get(cacheKey);
            if (cached !== null) {
                return cached;
            }
        }

        const data = await fetchFn();
        Cache.set(cacheKey, data);
        return data;
    }

    /**
     * Transform CKAN dam status to match original API format
     */
    function transformDamStatus(records) {
        return records.map(r => ({
            BarajAdi: r['Baraj Adı'] || r.BarajAdi,
            SuKotu: parseFloat(r['Su Kotu (m)'] || r.SuKotu) || 0,
            SuDurumu: parseFloat(r['Su Hacmi (m³)'] || r.SuDurumu) || 0,
            DolulukOrani: parseFloat(r['Doluluk Oranı (%)'] || r.DolulukOrani) || 0,
            MinimumSuKapasitesi: parseFloat(r['Minimum Su Kapasitesi (m³)'] || r.MinimumSuKapasitesi) || 0,
            MaksimumSuKapasitesi: parseFloat(r['Maksimum Su Kapasitesi (m³)'] || r.MaksimumSuKapasitesi) || 0,
            KullanilabilirSuKapasitesi: parseFloat(r['Kullanılabilir Su Hacmi (m³)'] || r.KullanilabilirSuKapasitesi) || 0,
            Tarih: r['Tarih'] || r.Tarih,
            Enlem: parseFloat(r['Enlem'] || r.Enlem) || 0,
            Boylam: parseFloat(r['Boylam'] || r.Boylam) || 0
        }));
    }

    /**
     * Transform CKAN daily production to match original API format
     */
    function transformDailyProduction(records) {
        // Group by date and calculate totals
        const today = new Date().toISOString().split('T')[0];

        let barajTotal = 0;
        let kuyuTotal = 0;
        const sources = [];

        records.forEach(r => {
            const name = r['Kaynak Adı'] || r.KaynakAdi || '';
            const amount = parseFloat(r['Üretim Miktarı (m³)'] || r.UretimMiktari) || 0;
            const type = (r['Kaynak Tipi'] || r.KaynakTipi || '').toLowerCase();

            sources.push({
                KaynakAdi: name,
                KaynakTipi: type.includes('baraj') ? 'Baraj' : 'Kuyu',
                UretimMiktari: amount
            });

            if (type.includes('baraj')) {
                barajTotal += amount;
            } else {
                kuyuTotal += amount;
            }
        });

        return {
            Tarih: today,
            ToplamUretim: barajTotal + kuyuTotal,
            BarajUretimi: barajTotal,
            KuyuUretimi: kuyuTotal,
            Kaynaklar: sources
        };
    }

    /**
     * Transform CKAN production distribution to match original API format
     */
    function transformProductionDistribution(records) {
        return records.map(r => ({
            Yil: parseInt(r['Yıl'] || r.Yil) || new Date().getFullYear(),
            Ay: parseInt(r['Ay'] || r.Ay) || 1,
            KaynakAdi: r['Kaynak Adı'] || r.KaynakAdi || '',
            KaynakTipi: r['Kaynak Tipi'] || r.KaynakTipi || '',
            UretimMiktari: parseFloat(r['Üretim Miktarı (m³)'] || r.UretimMiktari) || 0
        }));
    }

    /**
     * Get dam status - Gist first, then CKAN fallback
     */
    async function getDamStatus(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAM_STATUS, async () => {
            // Try Gist first
            const gistData = await getFromGist('barajdurum');
            if (gistData) {
                return gistData;
            }

            // Fallback to CKAN
            const records = await fetchFromCKAN(CKAN_RESOURCES.DAM_STATUS, 100);
            return transformDamStatus(records);
        }, forceRefresh);
    }

    /**
     * Get daily production - Gist first, then CKAN fallback
     */
    async function getDailyProduction(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAILY_PRODUCTION, async () => {
            // Try Gist first
            const gistData = await getFromGist('gunluksuuretimi');
            if (gistData) {
                return gistData;
            }

            // Fallback to CKAN
            const records = await fetchFromCKAN(CKAN_RESOURCES.DAILY_PRODUCTION, 100);
            return transformDailyProduction(records);
        }, forceRefresh);
    }

    /**
     * Get production distribution - Gist first, then CKAN fallback
     */
    async function getProductionDistribution(year = null, forceRefresh = false) {
        const cacheKey = year ? `${ENDPOINTS.PRODUCTION_DISTRIBUTION}_${year}` : ENDPOINTS.PRODUCTION_DISTRIBUTION;

        return fetchWithCache(cacheKey, async () => {
            // Try Gist first (only for unfiltered requests)
            if (!year) {
                const gistData = await getFromGist('suuretiminindagilimi');
                if (gistData) {
                    return gistData;
                }
            }

            // Fallback to CKAN
            const filters = year ? { 'Yıl': year } : {};
            const records = await fetchFromCKAN(CKAN_RESOURCES.PRODUCTION_DISTRIBUTION, 5000, filters);
            return transformProductionDistribution(records);
        }, forceRefresh);
    }

    /**
     * Get outages - Gist only (no CKAN fallback)
     */
    async function getOutages(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.OUTAGES, async () => {
            const gistData = await getFromGist('arizakaynaklisukesintileri');
            if (gistData) {
                return gistData;
            }
            console.warn('Outages data unavailable');
            return [];
        }, forceRefresh);
    }

    /**
     * Get dams and wells - Gist first, then derive from dam status
     */
    async function getDamsAndWells(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAMS_WELLS, async () => {
            // Try Gist first
            const gistData = await getFromGist('barajvekuyular');
            if (gistData) {
                return gistData;
            }

            // Fallback: derive from dam status
            const damStatus = await getDamStatus(forceRefresh);
            return damStatus.map(d => ({
                Adi: d.BarajAdi,
                Tipi: 'Baraj',
                Enlem: d.Enlem,
                Boylam: d.Boylam,
                Kapasite: d.MaksimumSuKapasitesi
            }));
        }, forceRefresh);
    }

    /**
     * Get weekly analysis - Gist only (no CKAN fallback)
     */
    async function getWeeklyAnalysis(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.WEEKLY_ANALYSIS, async () => {
            const gistData = await getFromGist('haftaliksuanalizleri');
            if (gistData) {
                return gistData;
            }
            console.warn('Weekly analysis data unavailable');
            return { Pinotlar: [] };
        }, forceRefresh);
    }

    /**
     * Get district analysis - Gist only (no CKAN fallback)
     */
    async function getDistrictAnalysis(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DISTRICT_ANALYSIS, async () => {
            const gistData = await getFromGist('cevreilcesuanalizleri');
            if (gistData) {
                return gistData;
            }
            console.warn('District analysis data unavailable');
            return { Pinotlar: [] };
        }, forceRefresh);
    }

    /**
     * Get dam quality - Gist only (no CKAN fallback)
     */
    async function getDamQuality(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.DAM_QUALITY, async () => {
            const gistData = await getFromGist('barajsukaliteraporlari');
            if (gistData) {
                return gistData;
            }
            console.warn('Dam quality data unavailable');
            return { Pinotlar: [] };
        }, forceRefresh);
    }

    /**
     * Get consumption data from CKAN
     * @param {number} year - Optional year filter
     * @param {boolean} forceRefresh - Bypass cache
     */
    async function getConsumption(year = null, forceRefresh = false) {
        const currentYear = new Date().getFullYear();
        const targetYear = year || currentYear;
        const cacheKey = `${ENDPOINTS.CONSUMPTION}_${targetYear}`;

        return fetchWithCache(cacheKey, async () => {
            // Get recent data - filter by year using SQL query for efficiency
            const params = new URLSearchParams({
                resource_id: CKAN_RESOURCES.CONSUMPTION,
                limit: '10000',
                filters: JSON.stringify({ YIL: targetYear })
            });

            const url = `${CKAN_BASE}?${params.toString()}`;
            const response = await fetch(url);
            const json = await response.json();

            if (!json.success) {
                throw new Error('Tuketim verisi alinamadi');
            }

            const records = json.result.records;

            // Aggregate by district
            const byDistrict = {};
            let totalConsumption = 0;
            let totalSubscribers = 0;

            records.forEach(r => {
                const district = r.ILCE || 'Bilinmiyor';
                const consumption = parseFloat(r.ORTALAMA_TUKETIM) || 0;
                const subscribers = parseInt(r.ABONE_ADEDI) || 0;

                if (!byDistrict[district]) {
                    byDistrict[district] = { consumption: 0, subscribers: 0 };
                }

                byDistrict[district].consumption += consumption * subscribers;
                byDistrict[district].subscribers += subscribers;
                totalConsumption += consumption * subscribers;
                totalSubscribers += subscribers;
            });

            // Convert to array and calculate daily consumption
            const districts = Object.entries(byDistrict).map(([name, data]) => ({
                Ilce: name,
                ToplamTuketim: data.consumption,
                AboneSayisi: data.subscribers,
                OrtalamaGunlukTuketim: data.subscribers > 0 ? data.consumption / data.subscribers / 30 : 0
            })).sort((a, b) => b.ToplamTuketim - a.ToplamTuketim);

            return {
                Yil: targetYear,
                ToplamTuketim: totalConsumption,
                ToplamAbone: totalSubscribers,
                GunlukOrtalamaTuketim: totalConsumption / 365,
                Ilceler: districts
            };
        }, forceRefresh);
    }

    /**
     * Get water losses data from CKAN
     */
    async function getWaterLosses(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.WATER_LOSSES, async () => {
            const records = await fetchFromCKAN(CKAN_RESOURCES.WATER_LOSSES, 100);

            return records.map(r => ({
                Yil: parseInt(r.YIL) || 0,
                Ilce: r.ILCE || '',
                SistemeGirenSu: parseFloat(r.SISTEME_GIREN_SU_MIKTARI) || 0,
                GelirGetirenSu: parseFloat(r.GELIR_GETIREN_SU_MIKTARI) || 0,
                SuKayiplari: parseFloat(r.SU_KAYIPLARI) || 0,
                FizikiKayiplar: parseFloat(r.FIZIKI_KAYIPLAR) || 0,
                IzinsizTuketim: parseFloat(r.IZINSIZ_TUKETIM) || 0,
                KayipOrani: parseFloat(r.SISTEME_GIREN_SU_MIKTARI) > 0
                    ? (parseFloat(r.SU_KAYIPLARI) / parseFloat(r.SISTEME_GIREN_SU_MIKTARI) * 100)
                    : 0
            }));
        }, forceRefresh);
    }

    /**
     * Get water tariffs from CKAN
     */
    async function getTariffs(forceRefresh = false) {
        return fetchWithCache(ENDPOINTS.TARIFFS, async () => {
            const records = await fetchFromCKAN(CKAN_RESOURCES.TARIFFS, 500);

            return records.map(r => ({
                AboneTipi: r.ABONE_TIPI || '',
                Tur: r.TUR || '',
                MetreKup: r.BARAJ_METRE_KUP || '',
                SuFiyati: parseFloat(r.SU_FIYATI) || 0,
                AtiksuFiyati: parseFloat(r.ATIKSU_FIYATI) || 0,
                GecerlilikTarihi: r.GECERLILIK_TARIHI || ''
            }));
        }, forceRefresh);
    }

    /**
     * Fetch all data concurrently
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
        getConsumption,
        getWaterLosses,
        getTariffs,
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
