/**
 * IZSU Map Module
 * Handles Leaflet map rendering, overlays, and visualization layers
 * Cem Baspinar - MIT License
 */

const MapView = (function() {
    'use strict';

    let map = null;
    let mapMarkers = [];
    let overlayLayer = null;
    let izmirBoundaryLayer = null;
    let flowAnimationFrame = null;
    let currentMapLayer = 'markers';
    let sourceToggleState = {};
    let mapControlsInitialized = false;
    let locationsData = null;

    // Izmir district center coordinates
    const DISTRICT_COORDS = {
        'Aliaga': { lat: 38.8006, lng: 26.9719 },
        'Balcova': { lat: 38.3897, lng: 27.0397 },
        'Bayindir': { lat: 38.2192, lng: 27.6492 },
        'Bayrakli': { lat: 38.4622, lng: 27.1644 },
        'Bergama': { lat: 39.1214, lng: 27.1797 },
        'Beydag': { lat: 38.0847, lng: 28.2039 },
        'Bornova': { lat: 38.4692, lng: 27.2156 },
        'Buca': { lat: 38.3883, lng: 27.1753 },
        'Cesme': { lat: 38.3236, lng: 26.3028 },
        'Cigli': { lat: 38.4969, lng: 27.0606 },
        'Dikili': { lat: 39.0722, lng: 26.8894 },
        'Foca': { lat: 38.6697, lng: 26.7575 },
        'Gaziemir': { lat: 38.3178, lng: 27.1286 },
        'Guzelbahce': { lat: 38.3675, lng: 26.8972 },
        'Karaburun': { lat: 38.6394, lng: 26.5147 },
        'Karabaglar': { lat: 38.3731, lng: 27.1283 },
        'Karsiyaka': { lat: 38.4561, lng: 27.1106 },
        'Kemalpasa': { lat: 38.4267, lng: 27.4175 },
        'Kinik': { lat: 39.0883, lng: 27.3806 },
        'Kiraz': { lat: 38.2306, lng: 28.2028 },
        'Konak': { lat: 38.4189, lng: 27.1287 },
        'Menderes': { lat: 38.2531, lng: 27.1333 },
        'Menemen': { lat: 38.6081, lng: 27.0694 },
        'Narlidere': { lat: 38.3956, lng: 26.9494 },
        'Odemis': { lat: 38.2294, lng: 27.9706 },
        'Seferihisar': { lat: 38.1978, lng: 26.8408 },
        'Selcuk': { lat: 37.9508, lng: 27.3692 },
        'Tire': { lat: 38.0886, lng: 27.7331 },
        'Torbali': { lat: 38.1569, lng: 27.3619 },
        'Urla': { lat: 38.3225, lng: 26.7647 }
    };

    /**
     * Load locations data from JSON file
     * @returns {Promise<Object|null>} Locations data or null
     */
    async function loadLocationsData() {
        if (locationsData) return locationsData;

        try {
            const response = await fetch('data/locations.json');
            if (!response.ok) return null;
            locationsData = await response.json();
            return locationsData;
        } catch (error) {
            console.warn('Could not load locations data:', error);
            return null;
        }
    }

    /**
     * Get district coordinates by name
     * @param {string} districtName - District name
     * @returns {Object|null} Coordinates object or null
     */
    function getDistrictCoords(districtName) {
        if (!districtName) return null;
        const normalized = Utils.normalizeTurkish(districtName);

        if (DISTRICT_COORDS[normalized]) {
            return DISTRICT_COORDS[normalized];
        }

        for (const [name, coords] of Object.entries(DISTRICT_COORDS)) {
            if (Utils.normalizeTurkish(name).toLowerCase() === normalized.toLowerCase()) {
                return coords;
            }
        }
        return null;
    }

    /**
     * Get coordinates for a source
     * @param {Object} source - Source object from API
     * @returns {Object|null} Coordinates object or null
     */
    function getSourceCoords(source) {
        // First: use API coordinates if available
        if (source.Enlem && source.Boylam) {
            return { Enlem: source.Enlem, Boylam: source.Boylam };
        }

        // Fallback: search in locations.json data
        if (!locationsData) return null;

        const normalizedName = Utils.normalizeTurkish(source.Adi || '').toLowerCase();
        const allSources = [...(locationsData.barajlar || []), ...(locationsData.kuyular || [])];

        for (const loc of allSources) {
            const locName = Utils.normalizeTurkish(loc.name || '').toLowerCase();
            if (normalizedName.includes(locName) || locName.includes(normalizedName)) {
                return { Enlem: loc.lat, Boylam: loc.lng };
            }
        }

        return null;
    }

    /**
     * Initialize map controls
     */
    function initMapControls() {
        if (mapControlsInitialized) return;
        mapControlsInitialized = true;

        document.querySelectorAll('.map-layer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const layer = e.target.dataset.layer;
                setMapLayer(layer);
            });
        });
    }

    /**
     * Set active map layer
     * @param {string} layer - Layer name: 'markers', 'quality', 'flow'
     */
    function setMapLayer(layer) {
        currentMapLayer = layer;

        if (layer !== 'flow' && flowAnimationFrame) {
            cancelAnimationFrame(flowAnimationFrame);
            flowAnimationFrame = null;
        }

        if (overlayLayer && map) {
            map.removeLayer(overlayLayer);
            overlayLayer = null;
        }

        document.querySelectorAll('.map-layer-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.layer === layer);
        });

        const sourceToggles = document.getElementById('sourceToggles');
        if (sourceToggles) {
            sourceToggles.style.display = layer === 'markers' ? 'flex' : 'none';
        }

        const legend = document.getElementById('mapLegend');
        if (legend) {
            legend.style.display = (layer === 'quality' || layer === 'flow') ? 'block' : 'none';
        }

        // Get data from App module
        const appData = App.getData();
        render(appData.damsWells || []);
    }

    /**
     * Load Izmir province boundary
     */
    async function loadIzmirBoundary() {
        try {
            const response = await fetch('data/izmir-boundary.geojson');
            if (!response.ok) return;

            const geoData = await response.json();
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00d4ff';

            izmirBoundaryLayer = L.geoJSON(geoData, {
                style: {
                    color: accentColor,
                    weight: 1.5,
                    opacity: 0.4,
                    fillColor: accentColor,
                    fillOpacity: 0.025
                },
                interactive: false
            }).addTo(map);
        } catch (error) {
            console.warn('Could not load Izmir boundary:', error);
        }
    }

    /**
     * Update legend based on current layer
     */
    function updateLegend() {
        const legend = document.getElementById('mapLegend');
        const content = legend?.querySelector('.legend-content');

        if (!content) return;

        if (currentMapLayer === 'quality') {
            content.innerHTML = `
                <div class="legend-title">${I18n.t('map.quality')}</div>
                <div class="legend-items">
                    <div class="legend-item">
                        <span class="legend-color" style="background: #22c55e;"></span>
                        <span>${I18n.t('map.qualityGood')}</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background: #f59e0b;"></span>
                        <span>${I18n.t('map.qualityWarning')}</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background: #ef4444;"></span>
                        <span>${I18n.t('map.qualityCritical')}</span>
                    </div>
                </div>
            `;
        } else if (currentMapLayer === 'flow') {
            content.innerHTML = `
                <div class="legend-title">${I18n.t('map.flow')}</div>
                <div class="legend-items">
                    <div class="legend-item">
                        <span class="legend-color" style="background: #3b82f6;"></span>
                        <span>${I18n.t('dams.dam')}</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background: #22c55e;"></span>
                        <span>${I18n.t('dams.well')}</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background: #ef4444;"></span>
                        <span>${I18n.t('map.cityCenter')}</span>
                    </div>
                </div>
                <div class="legend-note">${I18n.t('map.flowNote')}</div>
            `;
        }
    }

    /**
     * Animate flow lines
     */
    function animateFlowLines() {
        if (flowAnimationFrame) {
            cancelAnimationFrame(flowAnimationFrame);
        }

        if (currentMapLayer !== 'flow' || !overlayLayer) return;

        let offset = 0;
        function animate() {
            if (currentMapLayer !== 'flow' || !overlayLayer) return;

            offset = (offset + 0.5) % 20;

            overlayLayer.eachLayer(layer => {
                if (layer instanceof L.Polyline && !(layer instanceof L.CircleMarker)) {
                    layer.setStyle({ dashOffset: -offset });
                }
            });

            flowAnimationFrame = requestAnimationFrame(animate);
        }
        animate();
    }

    /**
     * Update water quality overlay
     * @param {Object} appData - Application data
     * @param {Object} qualityLimits - Water quality limits
     */
    function updateQualityOverlay(appData, qualityLimits) {
        if (!map) return;

        if (overlayLayer) {
            map.removeLayer(overlayLayer);
            overlayLayer = null;
        }

        if (currentMapLayer !== 'quality') return;

        const districtData = appData.districtAnalysis;
        let districts = Array.isArray(districtData) ? districtData : (districtData?.Ilceler || []);

        if (!districts.length) return;

        const markers = [];
        const bounds = [];

        districts.forEach(district => {
            const coords = getDistrictCoords(district.IlceAdi);
            if (!coords) return;

            const points = district.Noktalar || [];

            points.forEach((point, idx) => {
                const analyses = point.NoktaAnalizleri || [];
                const quality = evaluateWaterQuality(analyses, qualityLimits);

                const offsetLat = coords.lat + (idx * 0.008) - (points.length * 0.004);
                const offsetLng = coords.lng + ((idx % 2) * 0.01) - 0.005;

                const colors = {
                    good: '#22c55e',
                    warning: '#f59e0b',
                    danger: '#ef4444',
                    unknown: '#6b7280'
                };
                const color = colors[quality];

                const marker = L.circleMarker([offsetLat, offsetLng], {
                    radius: 10,
                    fillColor: color,
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });

                let popupContent = `<div style="min-width: 200px;">
                    <strong>${Utils.escapeHtml(district.IlceAdi)}</strong><br>
                    <span style="color: #a3a3a3; font-size: 11px;">${Utils.escapeHtml(point.Adres || I18n.t('dams.unknown'))}</span>
                    <hr style="border-color: #333; margin: 8px 0;">`;

                const keyParams = ['pH', 'Serbest Klor', 'Bulaniklik', 'Iletkenlik'];
                analyses.forEach(a => {
                    const isKey = keyParams.some(k => (a.ParametreAdi || '').includes(k));
                    if (isKey || analyses.length <= 6) {
                        const valueClass = getValueClass(a.ParametreAdi, a.ParametreDegeri, qualityLimits);
                        const valueColor = valueClass === 'value-danger' ? '#ef4444' :
                                          valueClass === 'value-warning' ? '#f59e0b' : '#22c55e';
                        popupContent += `<div style="display: flex; justify-content: space-between; margin: 2px 0;">
                            <span style="color: #a3a3a3;">${Utils.escapeHtml(Utils.translateParam(a.ParametreAdi))}</span>
                            <span style="color: ${valueColor}; font-weight: 500;">${Utils.escapeHtml(Utils.translateValue(a.ParametreDegeri) || '-')} ${Utils.escapeHtml(Utils.translateUnit(a.Birim))}</span>
                        </div>`;
                    }
                });

                popupContent += `<div style="margin-top: 8px; font-size: 10px; color: #666;">
                    ${Utils.formatDate(district.AnalizTarihi)}
                </div></div>`;

                marker.bindPopup(popupContent);
                markers.push(marker);
                bounds.push([offsetLat, offsetLng]);
            });
        });

        if (markers.length > 0) {
            overlayLayer = L.layerGroup(markers).addTo(map);
            updateLegend();

            if (bounds.length > 0) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    }

    /**
     * Update flow visualization overlay
     * @param {Object} appData - Application data
     */
    function updateFlowOverlay(appData) {
        if (!map) return;

        if (overlayLayer) {
            map.removeLayer(overlayLayer);
            overlayLayer = null;
        }

        if (currentMapLayer !== 'flow') return;

        const sources = appData.damsWells || [];
        const dailyProduction = appData.dailyProduction;
        const productionItems = dailyProduction?.BarajKuyuUretimleri || [];

        const cityCenter = { lat: 38.4189, lng: 27.1287 };
        const layers = [];
        const bounds = [[cityCenter.lat, cityCenter.lng]];
        const maxProduction = Math.max(...productionItems.map(p => p.UretimMiktari || 0), 1);

        sources.forEach(source => {
            const coords = getSourceCoords(source);
            if (!coords) return;

            const lat = parseFloat(coords.Enlem);
            const lng = parseFloat(coords.Boylam);
            if (isNaN(lat) || isNaN(lng)) return;

            bounds.push([lat, lng]);

            const production = productionItems.find(p => {
                const prodName = Utils.normalizeTurkish(p.BarajKuyuAdi || '').toLowerCase();
                const sourceName = Utils.normalizeTurkish(source.Adi || '').toLowerCase();
                return prodName.includes(sourceName) || sourceName.includes(prodName);
            });

            const productionAmount = production?.UretimMiktari || 0;
            const normalizedProduction = productionAmount / maxProduction;
            const weight = 2 + (normalizedProduction * 10);
            const isBaraj = (source.TurAdi || '').toLowerCase().includes('baraj');
            const color = isBaraj ? '#3b82f6' : '#22c55e';

            const flowLine = L.polyline([[lat, lng], [cityCenter.lat, cityCenter.lng]], {
                color: color,
                weight: weight,
                opacity: 0.6,
                dashArray: '10, 10',
                lineCap: 'round'
            });

            const popupContent = `<div>
                <strong>${Utils.escapeHtml(source.Adi)}</strong><br>
                <span style="color: #a3a3a3;">${Utils.escapeHtml(source.TurAdi || '-')}</span>
                ${productionAmount > 0 ? `<hr style="border-color: #333; margin: 8px 0;">
                <div style="color: ${color}; font-weight: 500;">
                    ${I18n.t('production.daily')}: ${Utils.formatLargeNumber(productionAmount)} m3
                </div>` : ''}
            </div>`;
            flowLine.bindPopup(popupContent);
            layers.push(flowLine);

            const sourceMarker = L.circleMarker([lat, lng], {
                radius: 6 + (normalizedProduction * 6),
                fillColor: color,
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
            sourceMarker.bindPopup(popupContent);
            layers.push(sourceMarker);
        });

        const centerMarker = L.circleMarker([cityCenter.lat, cityCenter.lng], {
            radius: 12,
            fillColor: '#ef4444',
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9
        });
        centerMarker.bindPopup(`<strong>${I18n.t('map.cityCenter')}</strong><br><span style="color: #a3a3a3;">${I18n.t('map.distributionPoint')}</span>`);
        layers.push(centerMarker);

        if (layers.length > 0) {
            overlayLayer = L.layerGroup(layers).addTo(map);
            updateLegend();

            if (bounds.length > 1) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }

        animateFlowLines();
    }

    /**
     * Evaluate water quality based on parameters
     * @param {Array} analyses - Analysis data
     * @param {Object} qualityLimits - Quality limit thresholds
     * @returns {string} Quality level: 'good', 'warning', 'danger', 'unknown'
     */
    function evaluateWaterQuality(analyses, qualityLimits) {
        if (!analyses || !analyses.length) return 'unknown';

        let hasWarning = false;
        let hasDanger = false;

        for (const analysis of analyses) {
            const paramName = analysis.ParametreAdi || '';
            const value = parseFloat(analysis.ParametreDegeri);

            if (isNaN(value)) continue;

            const limit = qualityLimits[paramName];
            if (limit) {
                if (limit.max !== undefined && value > limit.max) {
                    hasDanger = true;
                } else if (limit.min !== undefined && value < limit.min) {
                    hasWarning = true;
                } else if (limit.max !== undefined && value > limit.max * 0.8) {
                    hasWarning = true;
                }
            }
        }

        if (hasDanger) return 'danger';
        if (hasWarning) return 'warning';
        return 'good';
    }

    /**
     * Get CSS class for value based on quality limits
     * @param {string} paramName - Parameter name
     * @param {*} value - Parameter value
     * @param {Object} qualityLimits - Quality limit thresholds
     * @returns {string} CSS class name
     */
    function getValueClass(paramName, value, qualityLimits) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '';

        const limit = qualityLimits[paramName];
        if (!limit) return '';

        if (limit.max !== undefined && numValue > limit.max) return 'value-danger';
        if (limit.min !== undefined && numValue < limit.min) return 'value-warning';
        if (limit.max !== undefined && numValue > limit.max * 0.8) return 'value-warning';

        return 'value-good';
    }

    /**
     * Render source toggle buttons
     * @param {Array} sources - Source data
     */
    function renderSourceToggles(sources) {
        const container = document.getElementById('sourceToggles');
        if (!container) return;

        const sortedSources = [...sources].sort((a, b) => {
            const aIsBaraj = (a.TurAdi || '').toLowerCase().includes('baraj');
            const bIsBaraj = (b.TurAdi || '').toLowerCase().includes('baraj');
            if (aIsBaraj && !bIsBaraj) return -1;
            if (!aIsBaraj && bIsBaraj) return 1;
            return (a.Adi || '').localeCompare(b.Adi || '');
        });

        container.innerHTML = sortedSources.map(source => {
            const isBaraj = (source.TurAdi || '').toLowerCase().includes('baraj');
            const iconClass = isBaraj ? 'baraj' : 'kuyu';
            const isEnabled = sourceToggleState[source.Adi] !== false;
            const coords = getSourceCoords(source);
            const hasCoords = coords !== null;

            return `
                <button class="source-toggle ${isEnabled ? 'active' : ''} ${iconClass} ${!hasCoords ? 'no-coords' : ''}"
                        data-source="${Utils.escapeHtml(source.Adi)}"
                        title="${hasCoords ? `${coords.Enlem}, ${coords.Boylam}` : 'Konum bilgisi yok'}">
                    <svg class="source-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${isBaraj
                            ? '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
                            : '<circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/>'}
                    </svg>
                    <span class="source-toggle-name">${Utils.escapeHtml(source.Adi || I18n.t('dams.unknown'))}</span>
                </button>
            `;
        }).join('');

        container.querySelectorAll('.source-toggle').forEach(btn => {
            btn.addEventListener('click', handleSourceToggle);
        });
    }

    /**
     * Handle source toggle click
     * @param {Event} e - Click event
     */
    function handleSourceToggle(e) {
        const btn = e.currentTarget;
        const sourceName = btn.dataset.source;

        sourceToggleState[sourceName] = !sourceToggleState[sourceName];
        btn.classList.toggle('active', sourceToggleState[sourceName]);

        localStorage.setItem('izsu_sourceToggleState', JSON.stringify(sourceToggleState));

        const appData = App.getData();
        render(appData.damsWells || []);
    }

    /**
     * Initialize source toggle state
     * @param {Array} sources - Source data
     */
    function initToggleState(sources) {
        const savedState = localStorage.getItem('izsu_sourceToggleState');
        if (savedState) {
            sourceToggleState = JSON.parse(savedState);
        } else {
            sources.forEach(s => {
                sourceToggleState[s.Adi] = true;
            });
        }
    }

    /**
     * Render the map
     * @param {Array} sources - Source data
     */
    async function render(sources) {
        // Ensure locations data is loaded
        await loadLocationsData();

        const filtered = (sources || []).filter(s => sourceToggleState[s.Adi] !== false);

        mapMarkers.forEach(marker => marker.remove());
        mapMarkers = [];

        if (!map) {
            const mapContainer = document.getElementById('map');
            if (!mapContainer) return;

            map = L.map('map').setView([38.4192, 27.1287], 9);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
                maxZoom: 19
            }).addTo(map);

            loadIzmirBoundary();
            initMapControls();
        }

        const bounds = [];
        const colors = Charts.getColors();
        const appData = App.getData();

        filtered.forEach(source => {
            const coords = getSourceCoords(source);
            if (!coords) return;

            const lat = parseFloat(coords.Enlem);
            const lng = parseFloat(coords.Boylam);

            if (isNaN(lat) || isNaN(lng)) return;

            bounds.push([lat, lng]);

            if (currentMapLayer === 'markers') {
                const isBaraj = (source.TurAdi || '').toLowerCase().includes('baraj');
                const status = getDamStatusForSource(source.Adi, appData.damStatus);
                const fillRate = status ? (status.DolulukOrani || 0) : null;

                let markerColor;
                if (fillRate !== null) {
                    if (fillRate >= 70) markerColor = colors.success;
                    else if (fillRate >= 40) markerColor = colors.warning;
                    else markerColor = colors.danger;
                } else {
                    markerColor = isBaraj ? colors.info : colors.success;
                }

                const marker = L.circleMarker([lat, lng], {
                    radius: 8,
                    fillColor: markerColor,
                    color: markerColor,
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.6
                }).addTo(map);

                let popupContent = `<strong>${Utils.escapeHtml(source.Adi || I18n.t('dams.unknown'))}</strong><br>
                    <span style="color: ${colors.textMuted}">${Utils.escapeHtml(source.TurAdi || '-')}</span>`;

                if (status) {
                    popupContent += `<br><br>
                        <span style="color: ${markerColor}">${I18n.t('dams.fillRate')}: ${(status.DolulukOrani || 0).toFixed(1)}%</span><br>
                        <span>Su: ${Utils.formatLargeNumber(status.SuDurumu || 0)} m3</span>`;
                }

                marker.bindPopup(popupContent);
                mapMarkers.push(marker);
            }
        });

        const qualityLimits = App.getQualityLimits();
        if (currentMapLayer === 'quality') {
            updateQualityOverlay(appData, qualityLimits);
        } else if (currentMapLayer === 'flow') {
            updateFlowOverlay(appData);
        }

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    /**
     * Get dam status for a source by name
     * @param {string} sourceName - Source name
     * @param {Array} damStatus - Dam status data
     * @returns {Object|null} Dam status or null
     */
    function getDamStatusForSource(sourceName, damStatus) {
        if (!damStatus) return null;
        const normalizedSource = Utils.normalizeTurkish(sourceName).toLowerCase();

        return damStatus.find(d => {
            const normalizedDam = Utils.normalizeTurkish(d.BarajKuyuAdi || '').toLowerCase();
            return normalizedSource.includes(normalizedDam) || normalizedDam.includes(normalizedSource);
        });
    }

    /**
     * Invalidate map size (for resize events)
     */
    function invalidateSize() {
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    }

    /**
     * Get current map layer
     * @returns {string} Current layer name
     */
    function getCurrentLayer() {
        return currentMapLayer;
    }

    return {
        render,
        renderSourceToggles,
        initToggleState,
        setMapLayer,
        invalidateSize,
        getCurrentLayer,
        getDistrictCoords,
        getSourceCoords
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapView;
}
