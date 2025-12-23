/**
 * IZSU Tables Module
 * Handles rendering of outages, analysis, and quality tables
 * Cem Baspinar - MIT License
 */

const Tables = (function() {
    'use strict';

    // View mode preferences
    let analysisViewMode = localStorage.getItem('izsu_analysisViewMode') || 'card';
    let districtViewMode = localStorage.getItem('izsu_districtViewMode') || 'card';
    let damQualityViewMode = localStorage.getItem('izsu_damQualityViewMode') || 'card';

    /**
     * Get value class based on quality limits
     * @param {string} paramName - Parameter name
     * @param {*} value - Parameter value
     * @param {Object} qualityLimits - Quality limit thresholds
     * @returns {string} CSS class name
     */
    function getValueClass(paramName, value, qualityLimits) {
        const limit = qualityLimits[paramName];
        if (!limit) return 'value-normal';

        const numValue = parseFloat(value);
        if (isNaN(numValue)) return 'value-normal';

        if (limit.min !== undefined && limit.max !== undefined) {
            if (numValue < limit.min || numValue > limit.max) {
                return 'value-danger';
            }
            if (numValue < limit.min * 1.1 || numValue > limit.max * 0.9) {
                return 'value-warning';
            }
            return 'value-normal';
        }

        if (limit.max !== undefined) {
            if (numValue > limit.max) return 'value-danger';
            if (numValue > limit.max * 0.8) return 'value-warning';
            return 'value-normal';
        }

        if (limit.min !== undefined) {
            if (numValue < limit.min) return 'value-danger';
            if (numValue < limit.min * 1.2) return 'value-warning';
            return 'value-normal';
        }

        return 'value-normal';
    }

    /**
     * Render outage section
     * @param {Object} data - Application data
     */
    function renderOutageSection(data) {
        const outages = data.outages || [];

        const statsContainer = document.getElementById('outageStats');
        const activeOutages = outages.filter(o => o.Ongoru !== '2' || !o.ArizaGiderilmeTarihi);
        const districts = [...new Set(outages.map(o => o.IlceAdi))];

        statsContainer.innerHTML = `
            <div class="stat-mini">
                <div class="stat-mini-label">${I18n.t('outages.active')}</div>
                <div class="stat-mini-value">${activeOutages.length}</div>
            </div>
            <div class="stat-mini">
                <div class="stat-mini-label">${I18n.t('outages.total')}</div>
                <div class="stat-mini-value">${outages.length}</div>
            </div>
            <div class="stat-mini">
                <div class="stat-mini-label">${I18n.t('outages.districts')}</div>
                <div class="stat-mini-value">${districts.length}</div>
            </div>
        `;

        const districtFilter = document.getElementById('districtFilter');
        districtFilter.innerHTML = `<option value="">${I18n.t('outages.filterAll')}</option>` +
            districts.sort().map(d => `<option value="${Utils.escapeHtml(d)}">${Utils.escapeHtml(d)}</option>`).join('');

        renderOutageList(outages);
        Charts.createOutageDistrictChart(outages);
    }

    /**
     * Render outage list
     * @param {Array} outages - Outage data
     * @param {string} filterDistrict - Optional district filter
     */
    function renderOutageList(outages, filterDistrict = '') {
        const container = document.getElementById('outageList');
        let filtered = outages || [];

        if (filterDistrict) {
            filtered = filtered.filter(o => o.IlceAdi === filterDistrict);
        }

        if (!filtered.length) {
            container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.outageNotFound')}</p></div>`;
            return;
        }

        container.innerHTML = filtered.map(outage => {
            const isResolved = outage.Ongoru === '2' && outage.ArizaGiderilmeTarihi;
            const neighborhoods = (outage.Mahalleler || '').split(',').map(m => m.trim()).filter(m => m);

            return `
                <div class="outage-card ${isResolved ? 'resolved' : ''}">
                    <div class="outage-card-header">
                        <div class="outage-location">
                            <span class="outage-district">${Utils.escapeHtml(outage.IlceAdi || I18n.t('dams.unknown'))}</span>
                        </div>
                        <span class="outage-status ${isResolved ? 'resolved' : ''}">${isResolved ? I18n.t('outages.resolved') : I18n.t('outages.active')}</span>
                    </div>
                    <div class="outage-meta">
                        <span>${I18n.t('outages.type')}: ${Utils.escapeHtml(outage.Tip || '-')}</span>
                        <span>${I18n.t('outages.unit')}: ${Utils.escapeHtml(outage.Birim || '-')}</span>
                        <span>${I18n.t('labels.start')}: ${Utils.formatDate(outage.KesintiTarihi)}</span>
                    </div>
                    <div class="outage-description">${Utils.escapeHtml(outage.KesintiSuresi || '')}</div>
                    ${outage.Aciklama ? `<div class="outage-description mt-4">${Utils.escapeHtml(outage.Aciklama)}</div>` : ''}
                    ${neighborhoods.length ? `
                        <div class="outage-neighborhoods">
                            <div class="outage-neighborhoods-label">${I18n.t('labels.affectedNeighborhoods')}:</div>
                            <div class="outage-neighborhoods-list">
                                ${neighborhoods.map(n => `<span class="neighborhood-tag">${Utils.escapeHtml(n)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Render analysis section
     * @param {Object} data - Application data
     * @param {Object} qualityLimits - Quality limit thresholds
     */
    function renderAnalysisSection(data, qualityLimits) {
        renderWeeklyAnalysis(data, qualityLimits);
        renderDistrictAnalysis(data, qualityLimits);
        renderDamQuality(data, qualityLimits);
    }

    /**
     * Render weekly analysis
     * @param {Object} data - Application data
     * @param {Object} qualityLimits - Quality limit thresholds
     * @param {string} filterParam - Optional parameter filter
     */
    function renderWeeklyAnalysis(data, qualityLimits, filterParam = '') {
        const weeklyData = data.weeklyAnalysis;
        const cardContainer = document.getElementById('weeklyAnalysisList');
        const tableContainer = document.getElementById('weeklyAnalysisTable');

        if (data.weeklyAnalysisError) {
            cardContainer.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.weeklyAnalysisError')}<br><span class="text-muted">${Utils.escapeHtml(data.weeklyAnalysisError)}</span><br><button class="btn btn-secondary mt-4" onclick="App.refreshData()">${I18n.t('errors.retry')}</button></p></div>`;
            cardContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            return;
        }

        const analyses = Array.isArray(weeklyData) ? weeklyData : (weeklyData?.TumAnalizler || []);

        if (!analyses.length) {
            cardContainer.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.weeklyAnalysisNotFound')}</p></div>`;
            cardContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            return;
        }

        const allParams = new Set();
        analyses.forEach(a => {
            if (a.analizSonuclari) {
                a.analizSonuclari.forEach(s => allParams.add(s.ParametreAdi));
            }
        });

        const paramFilter = document.getElementById('parameterFilter');
        const currentValue = paramFilter.value;
        paramFilter.innerHTML = `<option value="">${I18n.t('outages.filterAll')}</option>` +
            [...allParams].sort().map(p => `<option value="${Utils.escapeHtml(p)}"${p === currentValue ? ' selected' : ''}>${Utils.escapeHtml(Utils.translateParam(p))}</option>`).join('');

        if (analysisViewMode === 'table') {
            cardContainer.classList.add('hidden');
            tableContainer.classList.remove('hidden');
            renderWeeklyAnalysisTable(analyses, filterParam, qualityLimits);
        } else {
            cardContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            renderWeeklyAnalysisCards(analyses, filterParam, cardContainer, qualityLimits);
        }
    }

    /**
     * Render weekly analysis as cards
     */
    function renderWeeklyAnalysisCards(analyses, filterParam, container, qualityLimits) {
        container.innerHTML = analyses.map(analysis => {
            let results = analysis.analizSonuclari || [];

            if (filterParam) {
                results = results.filter(r => r.ParametreAdi === filterParam);
            }

            if (!results.length) return '';

            const latestDate = results.length ? Utils.formatDate(results[0].SonucTarihi) : '-';

            return `
                <div class="analysis-card">
                    <div class="analysis-card-header">
                        <div class="analysis-card-title">${Utils.escapeHtml(analysis.NoktaTanimi || I18n.t('dams.unknown'))}</div>
                        <div class="analysis-card-date">${latestDate}</div>
                    </div>
                    <div class="analysis-params">
                        ${results.slice(0, 8).map(r => {
                            const valueClass = getValueClass(r.ParametreAdi, r.ParametreDegeri, qualityLimits);
                            return `
                                <div class="analysis-param">
                                    <span class="param-name">${Utils.escapeHtml(Utils.translateParam(r.ParametreAdi))}</span>
                                    <span class="param-value ${valueClass}">${Utils.escapeHtml(Utils.translateValue(r.ParametreDegeri) || '-')} ${Utils.escapeHtml(Utils.translateUnit(r.Birim))}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).filter(html => html).join('');

        if (!container.innerHTML) {
            container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.noResults')}</p></div>`;
        }
    }

    /**
     * Render weekly analysis as table
     */
    function renderWeeklyAnalysisTable(analyses, filterParam, qualityLimits) {
        const container = document.getElementById('weeklyAnalysisTable');

        const allParams = new Set();
        analyses.forEach(a => {
            if (a.analizSonuclari) {
                a.analizSonuclari.forEach(s => {
                    if (!filterParam || s.ParametreAdi === filterParam) {
                        allParams.add(s.ParametreAdi);
                    }
                });
            }
        });

        const params = [...allParams].sort();
        if (!params.length) {
            container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.noResults')}</p></div>`;
            return;
        }

        container.innerHTML = `
            <table class="data-table sortable-table analysis-table" id="weeklyAnalysisTableData">
                <thead>
                    <tr>
                        <th class="sortable" data-col="0">${I18n.t('labels.point')}</th>
                        <th class="sortable" data-col="1">${I18n.t('analysis.date')}</th>
                        ${params.map((p, i) => `<th class="text-center sortable" data-col="${i + 2}"><span class="th-rotated">${Utils.escapeHtml(Utils.translateParam(p))}</span></th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${analyses.map(analysis => {
                        const results = analysis.analizSonuclari || [];
                        if (!results.length) return '';

                        const latestDate = Utils.formatDate(results[0].SonucTarihi);
                        const rawDate = results[0].SonucTarihi || '';
                        const valueMap = {};
                        results.forEach(r => {
                            valueMap[r.ParametreAdi] = { value: r.ParametreDegeri, unit: r.Birim };
                        });

                        return `
                            <tr>
                                <td data-value="${Utils.escapeHtml(analysis.NoktaTanimi || '')}">${Utils.escapeHtml(analysis.NoktaTanimi || I18n.t('dams.unknown'))}</td>
                                <td data-value="${rawDate}">${latestDate}</td>
                                ${params.map(p => {
                                    const d = valueMap[p];
                                    if (!d) return '<td class="text-center" data-value="">-</td>';
                                    const valueClass = getValueClass(p, d.value, qualityLimits);
                                    return `<td class="text-center ${valueClass}" data-value="${d.value || ''}">${Utils.escapeHtml(Utils.translateValue(d.value) || '-')}</td>`;
                                }).join('')}
                            </tr>
                        `;
                    }).filter(html => html).join('')}
                </tbody>
            </table>
        `;

        UI.initSortableTable('weeklyAnalysisTableData');
    }

    /**
     * Render district analysis
     * @param {Object} data - Application data
     * @param {Object} qualityLimits - Quality limit thresholds
     * @param {string} filterDistrict - Optional district filter
     */
    function renderDistrictAnalysis(data, qualityLimits, filterDistrict = '') {
        const districtData = data.districtAnalysis;
        const cardContainer = document.getElementById('districtAnalysisList');
        const tableContainer = document.getElementById('districtAnalysisTable');

        if (data.districtAnalysisError) {
            cardContainer.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.districtAnalysisError')}<br><span class="text-muted">${Utils.escapeHtml(data.districtAnalysisError)}</span><br><button class="btn btn-secondary mt-4" onclick="App.refreshData()">${I18n.t('errors.retry')}</button></p></div>`;
            cardContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            return;
        }

        let districts = Array.isArray(districtData) ? districtData : (districtData?.Ilceler || []);

        if (!districts.length) {
            cardContainer.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.districtAnalysisNotFound')}</p></div>`;
            cardContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            return;
        }

        const districtFilter = document.getElementById('analysisDistrictFilter');
        const currentValue = districtFilter.value;
        districtFilter.innerHTML = `<option value="">${I18n.t('outages.filterAll')}</option>` +
            districts.map(d => `<option value="${Utils.escapeHtml(d.IlceAdi)}"${d.IlceAdi === currentValue ? ' selected' : ''}>${Utils.escapeHtml(d.IlceAdi)}</option>`).join('');

        if (filterDistrict) {
            districts = districts.filter(d => d.IlceAdi === filterDistrict);
        }

        if (districtViewMode === 'table') {
            cardContainer.classList.add('hidden');
            tableContainer.classList.remove('hidden');
            renderDistrictAnalysisTable(districts, qualityLimits);
        } else {
            cardContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            renderDistrictAnalysisCards(districts, cardContainer, qualityLimits);
        }
    }

    /**
     * Render district analysis as cards
     */
    function renderDistrictAnalysisCards(districts, container, qualityLimits) {
        container.innerHTML = districts.map(district => {
            const points = district.Noktalar || [];

            return points.map(point => {
                const analyses = point.NoktaAnalizleri || [];

                return `
                    <div class="analysis-card">
                        <div class="analysis-card-header">
                            <div class="analysis-card-title">${Utils.escapeHtml(district.IlceAdi)} - ${Utils.escapeHtml(point.Adres || I18n.t('dams.unknown'))}</div>
                            <div class="analysis-card-date">${Utils.formatDate(district.AnalizTarihi)}</div>
                        </div>
                        <div class="analysis-params">
                            ${analyses.slice(0, 8).map(a => {
                                const valueClass = getValueClass(a.ParametreAdi, a.ParametreDegeri, qualityLimits);
                                return `
                                    <div class="analysis-param">
                                        <span class="param-name">${Utils.escapeHtml(Utils.translateParam(a.ParametreAdi))}</span>
                                        <span class="param-value ${valueClass}">${Utils.escapeHtml(Utils.translateValue(a.ParametreDegeri) || '-')} ${Utils.escapeHtml(Utils.translateUnit(a.Birim))}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }).join('');

        if (!container.innerHTML) {
            container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.noResults')}</p></div>`;
        }
    }

    /**
     * Render district analysis as table
     */
    function renderDistrictAnalysisTable(districts, qualityLimits) {
        const container = document.getElementById('districtAnalysisTable');

        const allParams = new Set();
        const rows = [];

        districts.forEach(district => {
            const points = district.Noktalar || [];
            points.forEach(point => {
                const analyses = point.NoktaAnalizleri || [];
                const valueMap = {};
                analyses.forEach(a => {
                    allParams.add(a.ParametreAdi);
                    valueMap[a.ParametreAdi] = { value: a.ParametreDegeri, unit: a.Birim };
                });
                rows.push({
                    district: district.IlceAdi,
                    address: point.Adres,
                    date: district.AnalizTarihi,
                    values: valueMap
                });
            });
        });

        const params = [...allParams].sort();
        if (!rows.length) {
            container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.noResults')}</p></div>`;
            return;
        }

        container.innerHTML = `
            <table class="data-table sortable-table analysis-table" id="districtTable">
                <thead>
                    <tr>
                        <th class="sortable" data-col="0">${I18n.t('outages.district')}</th>
                        <th class="sortable" data-col="1">${I18n.t('analysis.address')}</th>
                        <th class="sortable" data-col="2">${I18n.t('analysis.date')}</th>
                        ${params.map((p, i) => `<th class="text-center sortable" data-col="${i + 3}"><span class="th-rotated">${Utils.escapeHtml(Utils.translateParam(p))}</span></th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td data-value="${Utils.escapeHtml(row.district)}">${Utils.escapeHtml(row.district)}</td>
                            <td data-value="${Utils.escapeHtml(row.address || '')}">${Utils.escapeHtml(row.address || '-')}</td>
                            <td data-value="${row.date || ''}">${Utils.formatDate(row.date)}</td>
                            ${params.map(p => {
                                const d = row.values[p];
                                if (!d) return '<td class="text-center" data-value="">-</td>';
                                const valueClass = getValueClass(p, d.value, qualityLimits);
                                return `<td class="text-center ${valueClass}" data-value="${d.value || ''}">${Utils.escapeHtml(Utils.translateValue(d.value) || '-')}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        UI.initSortableTable('districtTable');
    }

    /**
     * Render dam quality reports
     * @param {Object} data - Application data
     * @param {Object} qualityLimits - Quality limit thresholds
     * @param {string} filterDam - Optional dam filter
     */
    function renderDamQuality(data, qualityLimits, filterDam = '') {
        const qualityData = data.damQuality;
        const cardContainer = document.getElementById('damQualityList');
        const tableContainer = document.getElementById('damQualityTable');

        if (data.damQualityError) {
            cardContainer.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.damQualityError')}<br><span class="text-muted">${Utils.escapeHtml(data.damQualityError)}</span><br><button class="btn btn-secondary mt-4" onclick="App.refreshData()">${I18n.t('errors.retry')}</button></p></div>`;
            cardContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            return;
        }

        if (!qualityData || !qualityData.BarajAnalizleri) {
            cardContainer.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.damQualityNotFound')}</p></div>`;
            cardContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            return;
        }

        let dams = qualityData.BarajAnalizleri;

        const damFilter = document.getElementById('damQualityFilter');
        const currentValue = damFilter.value;
        damFilter.innerHTML = `<option value="">${I18n.t('outages.filterAll')}</option>` +
            dams.map(d => `<option value="${Utils.escapeHtml(d.BarajAdi)}"${d.BarajAdi === currentValue ? ' selected' : ''}>${Utils.escapeHtml(d.BarajAdi)}</option>`).join('');

        if (filterDam) {
            dams = dams.filter(d => d.BarajAdi === filterDam);
        }

        if (damQualityViewMode === 'table') {
            cardContainer.classList.add('hidden');
            tableContainer.classList.remove('hidden');
            renderDamQualityTable(dams, qualityLimits);
        } else {
            cardContainer.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            renderDamQualityCards(dams, cardContainer, qualityLimits);
        }
    }

    /**
     * Render dam quality as cards
     */
    function renderDamQualityCards(dams, container, qualityLimits) {
        container.innerHTML = dams.map(dam => {
            const analyses = dam.Analizler || [];

            return `
                <div class="analysis-card">
                    <div class="analysis-card-header">
                        <div class="analysis-card-title">${Utils.escapeHtml(dam.BarajAdi || I18n.t('dams.unknown'))}</div>
                        <div class="analysis-card-date">${Utils.formatDate(dam.Tarih)}</div>
                    </div>
                    ${analyses.map(analysis => {
                        const elements = analysis.AnalizElemanlari || [];
                        return `
                            <div class="mb-4">
                                <div class="text-muted" style="font-size: 0.75rem; margin-bottom: 0.5rem;">${Utils.escapeHtml(analysis.AnalizTipAdi || '')}</div>
                                <div class="analysis-params">
                                    ${elements.slice(0, 6).map(e => {
                                        const value = e.IslenmisSu || e.IslenmemisSu || '-';
                                        const valueClass = getValueClass(e.ParametreAdi, value, qualityLimits);
                                        return `
                                            <div class="analysis-param">
                                                <span class="param-name">${Utils.escapeHtml(Utils.translateParam(e.ParametreAdi))}</span>
                                                <span class="param-value ${valueClass}">${Utils.escapeHtml(Utils.translateValue(value))} ${Utils.escapeHtml(Utils.translateUnit(e.Birim))}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }).join('');

        if (!container.innerHTML) {
            container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.noResults')}</p></div>`;
        }
    }

    /**
     * Render dam quality as table
     */
    function renderDamQualityTable(dams, qualityLimits) {
        const container = document.getElementById('damQualityTable');

        const allParams = new Set();
        const rows = [];

        dams.forEach(dam => {
            const analyses = dam.Analizler || [];
            analyses.forEach(analysis => {
                const elements = analysis.AnalizElemanlari || [];
                const valueMap = {};
                elements.forEach(e => {
                    allParams.add(e.ParametreAdi);
                    valueMap[e.ParametreAdi] = {
                        value: e.IslenmisSu || e.IslenmemisSu,
                        unit: e.Birim
                    };
                });
                rows.push({
                    dam: dam.BarajAdi,
                    type: analysis.AnalizTipAdi,
                    date: dam.Tarih,
                    values: valueMap
                });
            });
        });

        const params = [...allParams].sort();
        if (!rows.length) {
            container.innerHTML = `<div class="empty-state"><p class="empty-state-text">${I18n.t('errors.noResults')}</p></div>`;
            return;
        }

        container.innerHTML = `
            <table class="data-table sortable-table analysis-table" id="damQualityTableData">
                <thead>
                    <tr>
                        <th class="sortable" data-col="0">${I18n.t('dams.dam')}</th>
                        <th class="sortable" data-col="1">${I18n.t('labels.analysisType')}</th>
                        <th class="sortable" data-col="2">${I18n.t('analysis.date')}</th>
                        ${params.map((p, i) => `<th class="text-center sortable" data-col="${i + 3}"><span class="th-rotated">${Utils.escapeHtml(Utils.translateParam(p))}</span></th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td data-value="${Utils.escapeHtml(row.dam)}">${Utils.escapeHtml(row.dam)}</td>
                            <td data-value="${Utils.escapeHtml(row.type || '')}">${Utils.escapeHtml(row.type || '-')}</td>
                            <td data-value="${row.date || ''}">${Utils.formatDate(row.date)}</td>
                            ${params.map(p => {
                                const d = row.values[p];
                                if (!d) return '<td class="text-center" data-value="">-</td>';
                                const valueClass = getValueClass(p, d.value, qualityLimits);
                                return `<td class="text-center ${valueClass}" data-value="${d.value || ''}">${Utils.escapeHtml(Utils.translateValue(d.value) || '-')}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        UI.initSortableTable('damQualityTableData');
    }

    /**
     * Set analysis view mode
     * @param {string} mode - View mode: 'card' or 'table'
     */
    function setAnalysisViewMode(mode) {
        analysisViewMode = mode;
        localStorage.setItem('izsu_analysisViewMode', mode);
    }

    /**
     * Set district view mode
     * @param {string} mode - View mode: 'card' or 'table'
     */
    function setDistrictViewMode(mode) {
        districtViewMode = mode;
        localStorage.setItem('izsu_districtViewMode', mode);
    }

    /**
     * Set dam quality view mode
     * @param {string} mode - View mode: 'card' or 'table'
     */
    function setDamQualityViewMode(mode) {
        damQualityViewMode = mode;
        localStorage.setItem('izsu_damQualityViewMode', mode);
    }

    /**
     * Get current view modes
     * @returns {Object} Current view modes
     */
    function getViewModes() {
        return {
            analysisViewMode,
            districtViewMode,
            damQualityViewMode
        };
    }

    return {
        renderOutageSection,
        renderOutageList,
        renderAnalysisSection,
        renderWeeklyAnalysis,
        renderDistrictAnalysis,
        renderDamQuality,
        setAnalysisViewMode,
        setDistrictViewMode,
        setDamQualityViewMode,
        getViewModes,
        getValueClass
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Tables;
}
