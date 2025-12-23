/**
 * IZSU Data Visualization - Main Application
 * Cem Baspinar - MIT License
 */

const App = (function() {
    'use strict';

    let data = {};
    let locationsData = null;
    let historyData = null;
    let consumptionData = null;

    // Water quality parameter limits (for color coding)
    // Based on Turkish drinking water standards (TS 266 / WHO guidelines)
    const QUALITY_LIMITS = {
        'pH': { min: 6.5, max: 9.5 },
        'PH': { min: 6.5, max: 9.5 },
        'Bulaniklik': { max: 1 },
        'Bulaniklık': { max: 1 },
        'Turbidite': { max: 1 },
        'Serbest Klor': { min: 0.2, max: 0.5 },
        'Serbest Residuel Klor': { min: 0.2, max: 0.5 },
        'Klor': { min: 0.2, max: 0.5 },
        'Residuel Klor': { min: 0.2, max: 0.5 },
        'Iletkenlik': { max: 2500 },
        'Elektriksel Iletkenlik': { max: 2500 },
        'Nitrat': { max: 50 },
        'NO3': { max: 50 },
        'Nitrit': { max: 0.5 },
        'NO2': { max: 0.5 },
        'Amonyum': { max: 0.5 },
        'NH4': { max: 0.5 },
        'Demir': { max: 0.2 },
        'Fe': { max: 0.2 },
        'Mangan': { max: 0.05 },
        'Mn': { max: 0.05 },
        'Aluminyum': { max: 0.2 },
        'Al': { max: 0.2 },
        'Florur': { max: 1.5 },
        'F': { max: 1.5 },
        'Sulfat': { max: 250 },
        'SO4': { max: 250 },
        'Klorur': { max: 250 },
        'Cl': { max: 250 },
        'Renk': { max: 20 },
        'Toplam Sertlik': { max: 500 },
        'Sertlik': { max: 500 },
        'E.Coli': { max: 0 },
        'E. Coli': { max: 0 },
        'Escherichia Coli': { max: 0 },
        'Koliform': { max: 0 },
        'Toplam Koliform': { max: 0 },
        'Koliform Bakteri': { max: 0 }
    };

    /**
     * Initialize application
     */
    async function init() {
        await I18n.init();

        UI.applySettings();
        setupEventListeners();
        UI.showLoading(true);

        try {
            await Promise.all([
                loadData(),
                loadLocationsData(),
                loadHistoryData()
            ]);
            loadConsumptionData().catch(() => {});
            renderAll();
            UI.updateStatusBar();
        } catch (error) {
            console.error('Initialization error:', error);
            UI.showToast(I18n.t('toast.loadError'), 'error');
        } finally {
            UI.showLoading(false);
        }
    }

    /**
     * Load locations data from JSON
     */
    async function loadLocationsData() {
        try {
            const response = await fetch('data/locations.json');
            if (response.ok) {
                locationsData = await response.json();
            }
        } catch (error) {
            console.warn('Could not load locations data:', error);
        }
    }

    /**
     * Load historical data from JSON
     */
    async function loadHistoryData() {
        try {
            const response = await fetch('data/history.json');
            if (response.ok) {
                historyData = await response.json();
            }
        } catch (error) {
            console.warn('Could not load history data:', error);
        }
    }

    /**
     * Load consumption data from Gist (via API)
     */
    async function loadConsumptionData() {
        try {
            const ckanData = await API.getConsumption();
            if (ckanData && ckanData.total) {
                consumptionData = {
                    totalRecords: ckanData.total,
                    dailyConsumption: locationsData?.consumption?.dailyTotal || 967500000
                };
                return;
            }
        } catch (error) {
            console.warn('Failed to load consumption data:', error.message);
        }

        consumptionData = {
            dailyConsumption: 967500000
        };
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', handleNavClick);
        });

        // Settings modal
        document.getElementById('settingsBtn').addEventListener('click', () => {
            UI.openModal('settingsModal');
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            UI.closeModal('settingsModal');
        });

        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                UI.closeModal('settingsModal');
            }
        });

        document.getElementById('saveSettings').addEventListener('click', UI.saveSettings);
        document.getElementById('clearCache').addEventListener('click', UI.clearCache);
        document.getElementById('refreshBtn').addEventListener('click', refreshData);

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', UI.handleTabClick);
        });

        // Filters
        document.getElementById('yearSelect').addEventListener('change', handleYearChange);
        document.getElementById('districtFilter').addEventListener('change', handleDistrictFilter);
        document.getElementById('parameterFilter').addEventListener('change', handleParameterFilter);
        document.getElementById('analysisDistrictFilter').addEventListener('change', handleAnalysisDistrictFilter);
        document.getElementById('damQualityFilter').addEventListener('change', handleDamQualityFilter);

        // View mode toggles
        const analysisViewModeEl = document.getElementById('analysisViewMode');
        const districtViewModeEl = document.getElementById('districtViewMode');
        const damQualityViewModeEl = document.getElementById('damQualityViewMode');

        const viewModes = Tables.getViewModes();
        analysisViewModeEl.value = viewModes.analysisViewMode;
        districtViewModeEl.value = viewModes.districtViewMode;
        damQualityViewModeEl.value = viewModes.damQualityViewMode;

        analysisViewModeEl.addEventListener('change', handleAnalysisViewModeChange);
        districtViewModeEl.addEventListener('change', handleDistrictViewModeChange);
        damQualityViewModeEl.addEventListener('change', handleDamQualityViewModeChange);

        // Hash navigation
        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();
    }

    /**
     * Load all data
     */
    async function loadData(forceRefresh = false) {
        data = await API.fetchAll(forceRefresh);
    }

    /**
     * Render all sections
     */
    function renderAll() {
        renderDamSection();
        Production.render(data);
        Tables.renderOutageSection(data);
        Tables.renderAnalysisSection(data, QUALITY_LIMITS);
        renderSourcesSection();
    }

    /**
     * Render dam status section
     */
    function renderDamSection() {
        const damStatus = data.damStatus || [];
        const container = document.getElementById('damStats');

        if (data.damStatusError) {
            container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.damDataError')}<br><span class="text-muted">${Utils.escapeHtml(data.damStatusError)}</span><br><button class="btn btn-secondary mt-4" onclick="App.refreshData()">${I18n.t('errors.retry')}</button></p></div>`;
            return;
        }

        if (!damStatus.length) {
            container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.damDataNotFound')}</p></div>`;
            return;
        }

        // Render water countdown
        Countdown.render(damStatus, consumptionData);

        // Find max values from history
        const maxValues = getHistoricalMaxValues();

        container.innerHTML = damStatus.map(dam => {
            const fillRate = dam.DolulukOrani || 0;
            const fillClass = fillRate >= 70 ? '' : fillRate >= 40 ? 'warning' : 'danger';
            const damName = dam.BarajKuyuAdi || I18n.t('dams.unknown');
            const maxInfo = maxValues[damName];
            const isBaraj = damName.toLowerCase().includes('baraj');

            return `
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-title">
                            <svg class="inline-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                ${isBaraj
                                    ? '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
                                    : '<circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/>'}
                            </svg>
                            ${Utils.escapeHtml(damName)}
                        </span>
                        <span class="stat-card-badge">${fillRate.toFixed(1)}%</span>
                    </div>
                    <div class="stat-card-value">
                        ${Utils.formatLargeNumber(dam.SuDurumu || 0)}
                        <span class="stat-card-unit">m3</span>
                    </div>
                    <div class="stat-card-subtitle">
                        ${I18n.t('dams.max')}: ${Utils.formatLargeNumber(dam.MaksimumSuKapasitesi || 0)} m3
                    </div>
                    <div class="stat-card-progress">
                        <div class="progress-bar">
                            <div class="progress-fill ${fillClass}" style="width: ${Math.min(100, fillRate)}%"></div>
                        </div>
                        <div class="progress-label">
                            <span>${I18n.t('dams.min')}: ${Utils.formatLargeNumber(dam.MinimumSuKapasitesi || 0)}</span>
                            <span>${I18n.t('dams.max')}: ${Utils.formatLargeNumber(dam.MaksimumSuKapasitesi || 0)}</span>
                        </div>
                    </div>
                    ${maxInfo ? `
                        <div class="stat-card-max">
                            <span class="stat-card-max-label">${I18n.t('dams.highest')}:</span>
                            <span class="stat-card-max-date">${maxInfo.date}</span>
                            <span>(${maxInfo.fillRate.toFixed(1)}%)</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        Charts.createTotalWaterChart(damStatus);
        Charts.createDamFillRateChart(damStatus);
        renderHistoricalTrend();
    }

    /**
     * Get historical max values for each dam
     */
    function getHistoricalMaxValues() {
        const maxValues = {};

        if (!historyData || !historyData.entries || !historyData.entries.length) {
            return maxValues;
        }

        historyData.entries.forEach(entry => {
            if (!entry.dams) return;

            entry.dams.forEach(dam => {
                const name = dam.name;
                const fillRate = dam.fillRate || 0;

                if (!maxValues[name] || fillRate > maxValues[name].fillRate) {
                    maxValues[name] = {
                        fillRate,
                        date: Utils.formatDate(entry.date),
                        volume: dam.currentVolume
                    };
                }
            });
        });

        return maxValues;
    }

    /**
     * Render historical trend chart
     */
    function renderHistoricalTrend() {
        const container = document.getElementById('historicalTrendContainer');
        if (!container) return;

        if (!historyData || !historyData.entries || historyData.entries.length < 2) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';

        const entries = [...historyData.entries].reverse();
        const labels = entries.map(e => Utils.formatDate(e.date));
        const fillRates = entries.map(e => e.summary?.averageFillRate || 0);

        const colors = Charts.getColors();
        const chartData = {
            labels,
            datasets: [{
                label: I18n.t('labels.avgFillRate'),
                data: fillRates,
                borderColor: colors.accent,
                backgroundColor: colors.accentDim,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        };

        Charts.createChart('historicalTrendChart', 'line', chartData, {
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        callback: value => value + '%'
                    }
                }
            }
        });
    }

    /**
     * Render sources section
     */
    function renderSourcesSection() {
        const sources = data.damsWells || [];
        MapView.initToggleState(sources);
        MapView.renderSourceToggles(sources);
        MapView.render(sources);
    }

    // Event handlers
    function handleNavClick(e) {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        UI.navigateToSection(section);

        if (section === 'kaynaklar') {
            MapView.invalidateSize();
        }
    }

    function handleHashChange() {
        const hash = window.location.hash.slice(1) || 'barajlar';
        UI.navigateToSection(hash);
    }

    function handleYearChange(e) {
        const year = parseInt(e.target.value);
        Production.handleYearChange(year, data.productionDistribution);
    }

    function handleDistrictFilter(e) {
        Tables.renderOutageList(data.outages, e.target.value);
    }

    function handleParameterFilter(e) {
        Tables.renderWeeklyAnalysis(data, QUALITY_LIMITS, e.target.value);
    }

    function handleAnalysisDistrictFilter(e) {
        Tables.renderDistrictAnalysis(data, QUALITY_LIMITS, e.target.value);
    }

    function handleDamQualityFilter(e) {
        Tables.renderDamQuality(data, QUALITY_LIMITS, e.target.value);
    }

    function handleAnalysisViewModeChange(e) {
        Tables.setAnalysisViewMode(e.target.value);
        Tables.renderWeeklyAnalysis(data, QUALITY_LIMITS, document.getElementById('parameterFilter').value);
    }

    function handleDistrictViewModeChange(e) {
        Tables.setDistrictViewMode(e.target.value);
        Tables.renderDistrictAnalysis(data, QUALITY_LIMITS, document.getElementById('analysisDistrictFilter').value);
    }

    function handleDamQualityViewModeChange(e) {
        Tables.setDamQualityViewMode(e.target.value);
        Tables.renderDamQuality(data, QUALITY_LIMITS, document.getElementById('damQualityFilter').value);
    }

    /**
     * Refresh data
     */
    async function refreshData() {
        UI.showLoading(true);

        try {
            await loadData(true);
            renderAll();
            UI.updateStatusBar();
            UI.showToast(I18n.t('toast.dataRefreshed'), 'success');
        } catch (error) {
            console.error('Refresh error:', error);
            UI.showToast(I18n.t('toast.loadError'), 'error');
        } finally {
            UI.showLoading(false);
        }
    }

    /**
     * Get current data
     */
    function getData() {
        return data;
    }

    /**
     * Get quality limits
     */
    function getQualityLimits() {
        return QUALITY_LIMITS;
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        init,
        refreshData,
        clearCache: UI.clearCache,
        getData,
        getQualityLimits
    };
})();
