/**
 * IZSU Charts Module
 * Handles all Chart.js visualizations
 * Cem Baspinar - MIT License
 */

const Charts = (function() {
    'use strict';

    const chartInstances = {};

    /**
     * Get chart colors based on current theme
     * @returns {Object} Color configuration
     */
    function getColors() {
        const style = getComputedStyle(document.documentElement);
        return {
            accent: style.getPropertyValue('--accent').trim() || '#00d4ff',
            accentDim: style.getPropertyValue('--accent-dim').trim() || 'rgba(0, 212, 255, 0.15)',
            textPrimary: style.getPropertyValue('--text-primary').trim() || '#e5e5e5',
            textSecondary: style.getPropertyValue('--text-secondary').trim() || '#a3a3a3',
            textMuted: style.getPropertyValue('--text-muted').trim() || '#666666',
            borderColor: style.getPropertyValue('--border-color').trim() || '#2a2a2a',
            success: style.getPropertyValue('--success').trim() || '#22c55e',
            warning: style.getPropertyValue('--warning').trim() || '#f59e0b',
            danger: style.getPropertyValue('--danger').trim() || '#ef4444',
            info: style.getPropertyValue('--info').trim() || '#3b82f6'
        };
    }

    /**
     * Generate color palette for multiple data points
     * @param {number} count - Number of colors needed
     * @returns {Array<string>} Color array
     */
    function generatePalette(count) {
        const baseColors = [
            '#00d4ff', '#22c55e', '#f59e0b', '#ef4444',
            '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
            '#f97316', '#6366f1', '#14b8a6', '#eab308'
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }

    /**
     * Get default chart options
     * @returns {Object} Chart.js options
     */
    function getDefaultOptions() {
        const colors = getColors();
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: colors.textSecondary,
                        font: {
                            family: "'JetBrains Mono', monospace",
                            size: 11
                        },
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: '#222222',
                    titleColor: colors.textPrimary,
                    bodyColor: colors.textSecondary,
                    borderColor: colors.borderColor,
                    borderWidth: 1,
                    padding: 12,
                    titleFont: {
                        family: "'JetBrains Mono', monospace",
                        size: 12,
                        weight: '500'
                    },
                    bodyFont: {
                        family: "'JetBrains Mono', monospace",
                        size: 11
                    },
                    cornerRadius: 4,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: colors.textMuted,
                        font: {
                            family: "'JetBrains Mono', monospace",
                            size: 10
                        }
                    },
                    grid: {
                        color: colors.borderColor,
                        drawBorder: false
                    }
                },
                y: {
                    ticks: {
                        color: colors.textMuted,
                        font: {
                            family: "'JetBrains Mono', monospace",
                            size: 10
                        }
                    },
                    grid: {
                        color: colors.borderColor,
                        drawBorder: false
                    }
                }
            }
        };
    }

    /**
     * Destroy existing chart instance
     * @param {string} id - Chart ID
     */
    function destroyChart(id) {
        if (chartInstances[id]) {
            chartInstances[id].destroy();
            delete chartInstances[id];
        }
    }

    /**
     * Create or update a chart
     * @param {string} id - Canvas element ID
     * @param {string} type - Chart type
     * @param {Object} data - Chart data
     * @param {Object} customOptions - Custom options
     * @returns {Chart} Chart instance
     */
    function createChart(id, type, data, customOptions = {}) {
        destroyChart(id);

        const ctx = document.getElementById(id);
        if (!ctx) {
            console.warn('Chart canvas not found:', id);
            return null;
        }

        const options = mergeDeep(getDefaultOptions(), customOptions);

        chartInstances[id] = new Chart(ctx, {
            type,
            data,
            options
        });

        return chartInstances[id];
    }

    /**
     * Deep merge objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    function mergeDeep(target, source) {
        const output = Object.assign({}, target);
        if (isObject(target) && isObject(source)) {
            Object.keys(source).forEach(key => {
                if (isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = mergeDeep(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }

    function isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    /**
     * Create total water status pie chart
     * @param {Array} damData - Dam status data
     */
    function createTotalWaterChart(damData) {
        if (!damData || !damData.length) return;

        const colors = getColors();
        const totalCurrent = damData.reduce((sum, d) => sum + (d.SuDurumu || 0), 0);
        const totalMax = damData.reduce((sum, d) => sum + (d.MaksimumSuKapasitesi || 0), 0);
        const totalMin = damData.reduce((sum, d) => sum + (d.MinimumSuKapasitesi || 0), 0);

        const usable = totalCurrent - totalMin;
        const usableCapacity = totalMax - totalMin;
        const remaining = usableCapacity - usable;

        const data = {
            labels: [I18n.t('dams.usableWater'), I18n.t('dams.emptyCapacity')],
            datasets: [{
                data: [Math.max(0, usable), Math.max(0, remaining)],
                backgroundColor: [colors.accent, colors.borderColor],
                borderWidth: 0,
                hoverOffset: 4
            }]
        };

        createChart('totalWaterChart', 'doughnut', data, {
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${formatNumber(value)} m3 (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        });
    }

    /**
     * Create dam fill rate bar chart
     * @param {Array} damData - Dam status data
     */
    function createDamFillRateChart(damData) {
        if (!damData || !damData.length) return;

        const colors = getColors();
        const sortedData = [...damData].sort((a, b) => (b.DolulukOrani || 0) - (a.DolulukOrani || 0));

        const labels = sortedData.map(d => d.BarajKuyuAdi || 'Bilinmiyor');
        const values = sortedData.map(d => d.DolulukOrani || 0);

        const backgroundColors = values.map(v => {
            if (v >= 70) return colors.success;
            if (v >= 40) return colors.warning;
            return colors.danger;
        });

        const data = {
            labels,
            datasets: [{
                label: 'Doluluk Orani (%)',
                data: values,
                backgroundColor: backgroundColors,
                borderRadius: 4,
                barThickness: 24
            }]
        };

        createChart('damFillRateChart', 'bar', data, {
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
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
     * Create daily production pie chart
     * @param {Object} productionData - Daily production data
     */
    function createDailyProductionChart(productionData) {
        if (!productionData || !productionData.BarajKuyuUretimleri) return;

        const items = productionData.BarajKuyuUretimleri;
        const palette = generatePalette(items.length);

        const labels = items.map(p => p.BarajKuyuAdi || 'Bilinmiyor');
        const values = items.map(p => p.UretimMiktari || 0);

        const data = {
            labels,
            datasets: [{
                data: values,
                backgroundColor: palette,
                borderWidth: 0
            }]
        };

        createChart('dailyProductionChart', 'pie', data, {
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${formatNumber(value)} m3 (${percentage}%)`;
                        }
                    }
                }
            }
        });
    }

    /**
     * Create monthly production line chart
     * @param {Array} distributionData - Production distribution data
     * @param {number} year - Year to display
     */
    function createMonthlyProductionChart(distributionData, year) {
        if (!distributionData || !distributionData.length) return;

        const colors = getColors();
        const monthNames = [
            'Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz',
            'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'
        ];

        const yearData = year
            ? distributionData.filter(d => d.Yil === year)
            : distributionData;

        const sources = [...new Set(yearData.map(d => d.UretimKaynagi))];
        const palette = generatePalette(sources.length);

        const datasets = sources.map((source, index) => {
            const sourceData = yearData.filter(d => d.UretimKaynagi === source);
            const monthlyData = new Array(12).fill(0);

            sourceData.forEach(d => {
                const monthIndex = d.Ay - 1;
                if (monthIndex >= 0 && monthIndex < 12) {
                    monthlyData[monthIndex] = parseInt(d.UretimMiktari) || 0;
                }
            });

            return {
                label: source,
                data: monthlyData,
                borderColor: palette[index],
                backgroundColor: palette[index] + '20',
                fill: false,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5
            };
        });

        const data = {
            labels: monthNames,
            datasets
        };

        createChart('monthlyProductionChart', 'line', data, {
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.raw)} m3`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatNumber(value)
                    }
                }
            }
        });
    }

    /**
     * Create source production bar chart
     * @param {Array} distributionData - Production distribution data
     * @param {number} year - Year to display
     */
    function createSourceProductionChart(distributionData, year) {
        if (!distributionData || !distributionData.length) return;

        const yearData = year
            ? distributionData.filter(d => d.Yil === year)
            : distributionData;

        const sourceMap = {};
        yearData.forEach(d => {
            const source = d.UretimKaynagi || 'Bilinmiyor';
            const amount = parseInt(d.UretimMiktari) || 0;
            sourceMap[source] = (sourceMap[source] || 0) + amount;
        });

        const sortedSources = Object.entries(sourceMap)
            .sort((a, b) => b[1] - a[1]);

        const labels = sortedSources.map(([source]) => source);
        const values = sortedSources.map(([, value]) => value);
        const palette = generatePalette(labels.length);

        const data = {
            labels,
            datasets: [{
                label: 'Toplam Uretim (m3)',
                data: values,
                backgroundColor: palette,
                borderRadius: 4
            }]
        };

        createChart('sourceProductionChart', 'bar', data, {
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${formatNumber(context.raw)} m3`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatNumber(value)
                    }
                }
            }
        });
    }

    /**
     * Create outage distribution by district chart
     * @param {Array} outages - Outage data
     */
    function createOutageDistrictChart(outages) {
        if (!outages || !outages.length) return;

        const districtMap = {};
        outages.forEach(o => {
            const district = o.IlceAdi || 'Bilinmiyor';
            districtMap[district] = (districtMap[district] || 0) + 1;
        });

        const sortedDistricts = Object.entries(districtMap)
            .sort((a, b) => b[1] - a[1]);

        const labels = sortedDistricts.map(([district]) => district);
        const values = sortedDistricts.map(([, count]) => count);
        const palette = generatePalette(labels.length);

        const data = {
            labels,
            datasets: [{
                label: 'Kesinti Sayisi',
                data: values,
                backgroundColor: palette,
                borderRadius: 4
            }]
        };

        createChart('outageDistrictChart', 'bar', data, {
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        });
    }

    /**
     * Format large numbers for display
     * @param {number} num - Number to format
     * @returns {string} Formatted string
     */
    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    /**
     * Update all charts (for theme changes)
     */
    function updateAllCharts() {
        Object.keys(chartInstances).forEach(id => {
            const chart = chartInstances[id];
            if (chart) {
                chart.update();
            }
        });
    }

    /**
     * Destroy all charts
     */
    function destroyAll() {
        Object.keys(chartInstances).forEach(id => {
            destroyChart(id);
        });
    }

    return {
        createChart,
        createTotalWaterChart,
        createDamFillRateChart,
        createDailyProductionChart,
        createMonthlyProductionChart,
        createSourceProductionChart,
        createOutageDistrictChart,
        updateAllCharts,
        destroyAll,
        getColors,
        generatePalette
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Charts;
}
