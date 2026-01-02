/**
 * IZSU Production Module
 * Handles production charts, stats, and tables
 * Cem Baspinar - MIT License
 */

const Production = (function() {
    'use strict';

    let monthlyTrendPeriod = parseInt(localStorage.getItem('izsu_monthlyTrendPeriod')) || 12;

    /**
     * Render production section
     * @param {Object} data - Application data
     */
    function render(data) {
        const dailyProduction = data.dailyProduction;
        const distribution = data.productionDistribution || [];

        renderProductionStats(dailyProduction, distribution);
        renderYearSelector(distribution);
        initPeriodFilter(distribution);
        createMonthlyTrendChart(distribution, monthlyTrendPeriod);
        createMonthlyComparisonChart(distribution);
        renderMonthlyProductionTable(distribution);
    }

    /**
     * Render production stats
     */
    function renderProductionStats(dailyProduction, distribution) {
        const statsContainer = document.getElementById('productionStats');

        if (dailyProduction && dailyProduction.BarajKuyuUretimleri) {
            const items = dailyProduction.BarajKuyuUretimleri;
            const totalProduction = items.reduce((sum, p) => sum + (p.UretimMiktari || 0), 0);
            const productionDate = Utils.formatDate(dailyProduction.UretimTarihi);

            const barajTotal = items.filter(p => (p.BarajKuyuAdi || '').toLowerCase().includes('baraj'))
                .reduce((sum, p) => sum + (p.UretimMiktari || 0), 0);
            const kuyuTotal = totalProduction - barajTotal;
            const barajPercentage = ((barajTotal / totalProduction) * 100).toFixed(1);
            const kuyuPercentage = ((kuyuTotal / totalProduction) * 100).toFixed(1);

            const lastYearData = getLastYearSameDayData(distribution);
            const lastYearComparison = calculateYearOverYearComparison(
                totalProduction, barajTotal, kuyuTotal, barajPercentage, kuyuPercentage, lastYearData
            );

            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-card-title">${I18n.t('labels.dailyTotal')}</div>
                    <div class="stat-card-value">
                        ${Utils.formatLargeNumber(totalProduction)}
                        <span class="stat-card-unit">m3</span>
                    </div>
                    <div class="stat-card-subtitle">${productionDate}</div>
                    ${lastYearComparison.totalHtml}
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">
                        <svg class="inline-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                        </svg>
                        ${I18n.t('labels.damProduction')}
                    </div>
                    <div class="stat-card-value">${barajPercentage}%</div>
                    <div class="stat-card-subtitle">${Utils.formatLargeNumber(barajTotal)} m3</div>
                    ${lastYearComparison.barajHtml}
                </div>
                <div class="stat-card">
                    <div class="stat-card-title">
                        <svg class="inline-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/>
                        </svg>
                        ${I18n.t('labels.wellProduction')}
                    </div>
                    <div class="stat-card-value">${kuyuPercentage}%</div>
                    <div class="stat-card-subtitle">${Utils.formatLargeNumber(kuyuTotal)} m3</div>
                    ${lastYearComparison.kuyuHtml}
                </div>
            `;

            Charts.createDailyProductionChart(dailyProduction);
            createSourceRatioChart(items);
            createLastYearSourceRatioChart(distribution);
            createLastYearDailyProductionChart(distribution);
        } else {
            statsContainer.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.productionDataNotFound')}</p></div>`;
        }
    }

    /**
     * Render year selector
     */
    function renderYearSelector(distribution) {
        const yearSelect = document.getElementById('yearSelect');
        const years = [...new Set(distribution.map(d => d.Yil))].sort((a, b) => b - a);

        yearSelect.innerHTML = years.map(year =>
            `<option value="${year}">${year}</option>`
        ).join('');

        const selectedYear = years[0] || new Date().getFullYear();
        Charts.createSourceProductionChart(distribution, selectedYear);
    }

    /**
     * Get last year same month data
     */
    function getLastYearSameDayData(distribution) {
        const now = new Date();
        const lastYear = now.getFullYear() - 1;
        const currentMonth = now.getMonth() + 1;

        const lastYearMonthData = distribution.filter(d =>
            d.Yil === lastYear && d.Ay === currentMonth
        );

        if (!lastYearMonthData.length) return null;

        const totalProduction = lastYearMonthData.reduce((sum, d) => sum + (parseInt(d.UretimMiktari) || 0), 0);
        const barajTotal = lastYearMonthData.filter(d => (d.UretimKaynagi || '').toLowerCase().includes('baraj'))
            .reduce((sum, d) => sum + (parseInt(d.UretimMiktari) || 0), 0);
        const kuyuTotal = totalProduction - barajTotal;

        const dailyEstimate = Math.round(totalProduction / 30);
        const barajDaily = Math.round(barajTotal / 30);
        const kuyuDaily = Math.round(kuyuTotal / 30);

        return {
            total: dailyEstimate,
            baraj: barajDaily,
            kuyu: kuyuDaily,
            barajPercentage: totalProduction ? ((barajTotal / totalProduction) * 100).toFixed(1) : 0,
            kuyuPercentage: totalProduction ? ((kuyuTotal / totalProduction) * 100).toFixed(1) : 0
        };
    }

    /**
     * Calculate year-over-year comparison HTML
     */
    function calculateYearOverYearComparison(totalProd, barajTot, kuyuTot, barajPct, kuyuPct, lastYearData) {
        const result = {
            totalHtml: '',
            barajHtml: '',
            kuyuHtml: ''
        };

        if (!lastYearData) {
            result.totalHtml = `<div class="comparison-text text-muted">${I18n.t('production.lastYearNoData')}</div>`;
            result.barajHtml = `<div class="comparison-text text-muted">${I18n.t('production.lastYearNoData')}</div>`;
            result.kuyuHtml = `<div class="comparison-text text-muted">${I18n.t('production.lastYearNoData')}</div>`;
            return result;
        }

        if (lastYearData.total) {
            const totalDiff = ((totalProd - lastYearData.total) / lastYearData.total * 100).toFixed(1);
            const totalClass = totalDiff >= 0 ? 'comparison-up' : 'comparison-down';
            const totalSign = totalDiff >= 0 ? '+' : '';
            result.totalHtml = `<div class="comparison-text ${totalClass}">${I18n.t('production.lastYear')}: ${totalSign}${totalDiff}%</div>`;
        }

        const barajPctDiff = (parseFloat(barajPct) - parseFloat(lastYearData.barajPercentage)).toFixed(1);
        const barajClass = barajPctDiff >= 0 ? 'comparison-up' : 'comparison-down';
        const barajSign = barajPctDiff >= 0 ? '+' : '';
        result.barajHtml = `<div class="comparison-text ${barajClass}">${I18n.t('production.lastYear')}: ${lastYearData.barajPercentage}% (${barajSign}${barajPctDiff}%)</div>`;

        const kuyuPctDiff = (parseFloat(kuyuPct) - parseFloat(lastYearData.kuyuPercentage)).toFixed(1);
        const kuyuClass = kuyuPctDiff >= 0 ? 'comparison-up' : 'comparison-down';
        const kuyuSign = kuyuPctDiff >= 0 ? '+' : '';
        result.kuyuHtml = `<div class="comparison-text ${kuyuClass}">${I18n.t('production.lastYear')}: ${lastYearData.kuyuPercentage}% (${kuyuSign}${kuyuPctDiff}%)</div>`;

        return result;
    }

    /**
     * Create source ratio chart
     */
    function createSourceRatioChart(items) {
        const barajTotal = items.filter(p => (p.BarajKuyuAdi || '').toLowerCase().includes('baraj'))
            .reduce((sum, p) => sum + (p.UretimMiktari || 0), 0);
        const kuyuTotal = items.filter(p => !(p.BarajKuyuAdi || '').toLowerCase().includes('baraj'))
            .reduce((sum, p) => sum + (p.UretimMiktari || 0), 0);

        const total = barajTotal + kuyuTotal;
        const barajPct = ((barajTotal / total) * 100).toFixed(1);
        const kuyuPct = ((kuyuTotal / total) * 100).toFixed(1);

        const colors = Charts.getColors();
        const chartData = {
            labels: [''],
            datasets: [
                {
                    label: `${I18n.t('dams.dam')} (${barajPct}%)`,
                    data: [barajTotal],
                    backgroundColor: colors.info,
                    borderWidth: 0,
                    barThickness: 40
                },
                {
                    label: `${I18n.t('dams.well')} (${kuyuPct}%)`,
                    data: [kuyuTotal],
                    backgroundColor: colors.success,
                    borderWidth: 0,
                    barThickness: 40
                }
            ]
        };

        Charts.createChart('sourceRatioChart', 'bar', chartData, {
            indexAxis: 'y',
            scales: {
                x: { stacked: true, display: false },
                y: { stacked: true, display: false }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 15 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const pct = context.datasetIndex === 0 ? barajPct : kuyuPct;
                            return `${context.dataset.label.split(' ')[0]}: ${Utils.formatNumber(value)} m3 (${pct}%)`;
                        }
                    }
                }
            }
        });
    }

    /**
     * Create last year source ratio chart
     */
    function createLastYearSourceRatioChart(distribution) {
        const now = new Date();
        const lastYear = now.getFullYear() - 1;
        const currentMonth = now.getMonth() + 1;

        const lastYearMonthData = distribution.filter(d =>
            d.Yil === lastYear && d.Ay === currentMonth
        );

        if (!lastYearMonthData.length) {
            const canvas = document.getElementById('sourceRatioLastYearChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.font = '12px JetBrains Mono';
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.fillText(I18n.t('production.lastYearNoData'), canvas.width / 2, canvas.height / 2);
            }
            return;
        }

        const totalProduction = lastYearMonthData.reduce((sum, d) => sum + (parseInt(d.UretimMiktari) || 0), 0);
        const barajTotal = lastYearMonthData.filter(d => (d.UretimKaynagi || '').toLowerCase().includes('baraj'))
            .reduce((sum, d) => sum + (parseInt(d.UretimMiktari) || 0), 0);
        const kuyuTotal = totalProduction - barajTotal;

        const barajPct = ((barajTotal / totalProduction) * 100).toFixed(1);
        const kuyuPct = ((kuyuTotal / totalProduction) * 100).toFixed(1);

        const colors = Charts.getColors();
        const chartData = {
            labels: [''],
            datasets: [
                {
                    label: `${I18n.t('dams.dam')} (${barajPct}%)`,
                    data: [barajTotal],
                    backgroundColor: colors.info,
                    borderWidth: 0,
                    barThickness: 40
                },
                {
                    label: `${I18n.t('dams.well')} (${kuyuPct}%)`,
                    data: [kuyuTotal],
                    backgroundColor: colors.success,
                    borderWidth: 0,
                    barThickness: 40
                }
            ]
        };

        Charts.createChart('sourceRatioLastYearChart', 'bar', chartData, {
            indexAxis: 'y',
            scales: {
                x: { stacked: true, display: false },
                y: { stacked: true, display: false }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 15 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const pct = context.datasetIndex === 0 ? barajPct : kuyuPct;
                            return `${context.dataset.label.split(' ')[0]}: ${Utils.formatNumber(value)} m3 (${pct}%)`;
                        }
                    }
                }
            }
        });
    }

    /**
     * Create last year daily production chart
     */
    function createLastYearDailyProductionChart(distribution) {
        const now = new Date();
        const lastYear = now.getFullYear() - 1;
        const currentMonth = now.getMonth() + 1;

        const lastYearMonthData = distribution.filter(d =>
            d.Yil === lastYear && d.Ay === currentMonth
        );

        if (!lastYearMonthData.length) {
            const canvas = document.getElementById('dailyProductionLastYearChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.font = '12px JetBrains Mono';
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.fillText(I18n.t('production.lastYearNoData'), canvas.width / 2, canvas.height / 2);
            }
            return;
        }

        const palette = Charts.generatePalette(lastYearMonthData.length);
        const labels = lastYearMonthData.map(d => d.UretimKaynagi || I18n.t('dams.unknown'));
        const values = lastYearMonthData.map(d => parseInt(d.UretimMiktari) || 0);

        const chartData = {
            labels,
            datasets: [{
                data: values,
                backgroundColor: palette,
                borderWidth: 0
            }]
        };

        Charts.createChart('dailyProductionLastYearChart', 'pie', chartData, {
            plugins: {
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${Utils.formatNumber(value)} m3 (${percentage}%)`;
                        }
                    }
                }
            }
        });
    }

    /**
     * Initialize period filter buttons
     */
    function initPeriodFilter(distribution) {
        const buttons = document.querySelectorAll('.period-btn');

        buttons.forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.period) === monthlyTrendPeriod) {
                btn.classList.add('active');
            }
        });

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const period = parseInt(btn.dataset.period);
                monthlyTrendPeriod = period;
                localStorage.setItem('izsu_monthlyTrendPeriod', period);
                createMonthlyTrendChart(distribution, period);
            });
        });
    }

    /**
     * Create monthly trend chart
     */
    function createMonthlyTrendChart(distribution, monthCount) {
        if (!distribution || !distribution.length) return;

        const colors = Charts.getColors();
        const monthNames = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz',
            'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];

        const months = [];
        const now = new Date();

        // If monthCount is 0, show all available data
        if (monthCount === 0) {
            const years = [...new Set(distribution.map(d => d.Yil))].sort((a, b) => a - b);
            const minYear = years[0];
            const maxYear = years[years.length - 1];
            for (let year = minYear; year <= maxYear; year++) {
                for (let month = 1; month <= 12; month++) {
                    if (year === maxYear && month > now.getMonth() + 1) break;
                    months.push({
                        year: year,
                        month: month,
                        label: `${monthNames[month - 1]} ${year.toString().slice(-2)}`
                    });
                }
            }
        } else {
            for (let i = monthCount - 1; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push({
                    year: d.getFullYear(),
                    month: d.getMonth() + 1,
                    label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`
                });
            }
        }

        const sources = [...new Set(distribution.map(d => d.UretimKaynagi))];
        const palette = Charts.generatePalette(sources.length);

        const datasets = sources.map((source, index) => {
            const monthlyData = months.map(m => {
                const entry = distribution.find(d =>
                    d.UretimKaynagi === source && d.Yil === m.year && d.Ay === m.month
                );
                return entry ? parseInt(entry.UretimMiktari) || 0 : 0;
            });

            return {
                label: source,
                data: monthlyData,
                borderColor: palette[index],
                backgroundColor: palette[index] + '20',
                fill: false,
                tension: 0.3,
                pointRadius: months.length <= 12 ? 3 : (months.length <= 36 ? 2 : 0),
                pointHoverRadius: 4
            };
        });

        const chartData = {
            labels: months.map(m => m.label),
            datasets
        };

        Charts.createChart('monthlyProductionChart', 'line', chartData, {
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${Utils.formatNumber(context.raw)} m3`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => Utils.formatLargeNumber(value)
                    }
                }
            }
        });
    }

    /**
     * Calculate monthly averages
     */
    function calculateMonthlyAverages(distribution) {
        const averages = {};
        const counts = {};

        distribution.forEach(d => {
            const source = d.UretimKaynagi;
            const month = d.Ay;
            const key = `${source}_${month}`;
            const value = parseInt(d.UretimMiktari) || 0;

            if (!averages[key]) {
                averages[key] = 0;
                counts[key] = 0;
            }
            averages[key] += value;
            counts[key]++;
        });

        Object.keys(averages).forEach(key => {
            averages[key] = Math.round(averages[key] / counts[key]);
        });

        return averages;
    }

    /**
     * Get last 12 months
     */
    function getLast12Months() {
        const months = [];
        const now = new Date();
        const monthNames = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz',
            'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                year: d.getFullYear(),
                month: d.getMonth() + 1,
                label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`
            });
        }
        return months;
    }

    /**
     * Render monthly production table
     */
    function renderMonthlyProductionTable(distribution) {
        const container = document.getElementById('monthlyProductionTable');
        if (!container) return;

        if (!distribution || !distribution.length) {
            container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.tableDataNotFound')}</p></div>`;
            return;
        }

        const last12Months = getLast12Months();
        const averages = calculateMonthlyAverages(distribution);
        const sources = [...new Set(distribution.map(d => d.UretimKaynagi))];

        const tableData = {};
        sources.forEach(source => {
            tableData[source] = last12Months.map(m => {
                const entry = distribution.find(d =>
                    d.UretimKaynagi === source && d.Yil === m.year && d.Ay === m.month
                );
                const value = entry ? parseInt(entry.UretimMiktari) || 0 : 0;
                const avgKey = `${source}_${m.month}`;
                const avg = averages[avgKey] || 0;
                return { value, avg };
            });
        });

        const monthlyTotals = last12Months.map((m, i) => {
            return sources.reduce((sum, source) => sum + tableData[source][i].value, 0);
        });

        container.innerHTML = `
            <table class="data-table sortable-table" id="productionTable">
                <thead>
                    <tr>
                        <th class="sortable" data-col="0">${I18n.t('production.source')}</th>
                        ${last12Months.map((m, i) => `<th class="text-right sortable" data-col="${i + 1}">${m.label}</th>`).join('')}
                        <th class="text-right sortable" data-col="${last12Months.length + 1}">${I18n.t('production.total')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${sources.map(source => {
                        const isBaraj = source.toLowerCase().includes('baraj');
                        const total = tableData[source].reduce((a, b) => a + b.value, 0);
                        return `
                            <tr>
                                <td data-value="${Utils.escapeHtml(source)}">
                                    <svg class="inline-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        ${isBaraj
                                            ? '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/>'
                                            : '<circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/>'}
                                    </svg>
                                    ${Utils.escapeHtml(source)}
                                </td>
                                ${tableData[source].map(cell => {
                                    if (!cell.value) return '<td class="text-right" data-value="0">-</td>';

                                    const diff = cell.avg ? ((cell.value - cell.avg) / cell.avg * 100) : 0;
                                    let diffClass = '';
                                    let diffText = '';

                                    if (cell.avg && Math.abs(diff) >= 10) {
                                        if (diff < -20) {
                                            diffClass = 'value-danger';
                                            diffText = `<span class="diff-text">(${diff.toFixed(0)}%)</span>`;
                                        } else if (diff < 0) {
                                            diffClass = 'value-warning';
                                            diffText = `<span class="diff-text">(${diff.toFixed(0)}%)</span>`;
                                        } else if (diff > 20) {
                                            diffClass = 'value-good';
                                            diffText = `<span class="diff-text">(+${diff.toFixed(0)}%)</span>`;
                                        }
                                    }

                                    const titleText = 'Ort: ' + Utils.formatNumber(cell.avg) + ' m3';

                                    return `<td class="text-right ${diffClass}" data-value="${cell.value}" title="${titleText}">${Utils.formatNumber(cell.value)}${diffText}</td>`;
                                }).join('')}
                                <td class="text-right" data-value="${total}"><strong>${Utils.formatNumber(total)}</strong></td>
                            </tr>
                        `;
                    }).join('')}
                    <tr class="total-row">
                        <td data-value="ZZZTOPLAM"><strong>${I18n.t('production.total')}</strong></td>
                        ${monthlyTotals.map(val =>
                            `<td class="text-right" data-value="${val}"><strong>${Utils.formatNumber(val)}</strong></td>`
                        ).join('')}
                        <td class="text-right" data-value="${monthlyTotals.reduce((a, b) => a + b, 0)}"><strong>${Utils.formatNumber(monthlyTotals.reduce((a, b) => a + b, 0))}</strong></td>
                    </tr>
                </tbody>
            </table>
        `;

        UI.initSortableTable('productionTable');
    }

    /**
     * Create monthly comparison chart
     */
    function createMonthlyComparisonChart(distribution) {
        if (!distribution || !distribution.length) return;

        const last12Months = getLast12Months();
        const averages = calculateMonthlyAverages(distribution);
        const sources = [...new Set(distribution.map(d => d.UretimKaynagi))];

        const actualTotals = last12Months.map(m => {
            return sources.reduce((sum, source) => {
                const entry = distribution.find(d =>
                    d.UretimKaynagi === source && d.Yil === m.year && d.Ay === m.month
                );
                return sum + (entry ? parseInt(entry.UretimMiktari) || 0 : 0);
            }, 0);
        });

        const avgTotals = last12Months.map(m => {
            return sources.reduce((sum, source) => {
                const avgKey = `${source}_${m.month}`;
                return sum + (averages[avgKey] || 0);
            }, 0);
        });

        const colors = Charts.getColors();
        const chartData = {
            labels: last12Months.map(m => m.label),
            datasets: [
                {
                    label: I18n.t('labels.actual'),
                    data: actualTotals,
                    backgroundColor: colors.accent,
                    borderRadius: 4
                },
                {
                    label: I18n.t('production.average'),
                    data: avgTotals,
                    backgroundColor: colors.textMuted,
                    borderRadius: 4
                }
            ]
        };

        Charts.createChart('monthlyComparisonChart', 'bar', chartData, {
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const datasetLabel = context.dataset.label;
                            return `${datasetLabel}: ${Utils.formatNumber(value)} m3`;
                        },
                        afterBody: function(context) {
                            if (context[0].datasetIndex === 0) {
                                const actual = context[0].raw;
                                const avg = avgTotals[context[0].dataIndex];
                                if (avg) {
                                    const diff = ((actual - avg) / avg * 100).toFixed(1);
                                    const sign = diff > 0 ? '+' : '';
                                    return `Fark: ${sign}${diff}%`;
                                }
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => Utils.formatLargeNumber(value)
                    }
                }
            }
        });
    }

    /**
     * Handle year change
     * @param {number} year - Selected year
     * @param {Array} distribution - Distribution data
     */
    function handleYearChange(year, distribution) {
        Charts.createMonthlyProductionChart(distribution, year);
        Charts.createSourceProductionChart(distribution, year);
    }

    return {
        render,
        handleYearChange
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Production;
}
