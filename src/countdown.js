/**
 * IZSU Countdown Module
 * Handles water countdown ticker visualization
 * Cem Baspinar - MIT License
 */

const Countdown = (function() {
    'use strict';

    let countdownInterval = null;
    let countdownData = null;

    /**
     * Render water countdown visualization
     * @param {Array} damStatus - Dam status data
     * @param {Object} consumptionData - Consumption data
     */
    function render(damStatus, consumptionData) {
        const container = document.getElementById('waterCountdown');
        if (!container) return;

        const totalCurrent = damStatus.reduce((sum, d) => sum + (d.SuDurumu || 0), 0);
        const totalMin = damStatus.reduce((sum, d) => sum + (d.MinimumSuKapasitesi || 0), 0);
        const totalMax = damStatus.reduce((sum, d) => sum + (d.MaksimumSuKapasitesi || 0), 0);

        const usableWater = totalCurrent - totalMin;
        const usableCapacity = totalMax - totalMin;
        const fillPercentage = (usableWater / usableCapacity) * 100;

        // Daily consumption in m3 (convert from liters)
        const dailyConsumption = (consumptionData?.dailyConsumption || 967500000) / 1000;
        const consumptionPerSecond = dailyConsumption / 86400;

        // Store countdown data for live updates
        countdownData = {
            startTime: Date.now(),
            startWater: usableWater,
            consumptionPerSecond,
            usableCapacity,
            dailyConsumption
        };

        container.innerHTML = `
            <div class="countdown-title">${I18n.t('countdown.title')}</div>
            <div class="countdown-main">
                <div class="countdown-time">
                    <span class="countdown-number" id="countdownDays">--</span><span class="countdown-unit">${I18n.t('countdown.days')}</span>
                    <span class="countdown-number" id="countdownHours">--</span><span class="countdown-unit">${I18n.t('countdown.hours')}</span>
                    <span class="countdown-number" id="countdownMins">--</span><span class="countdown-unit">${I18n.t('countdown.minutes')}</span>
                    <span class="countdown-number" id="countdownSecs">--</span><span class="countdown-unit">${I18n.t('countdown.seconds')}</span>
                </div>
                <span class="countdown-separator">|</span>
                <div class="countdown-volume">
                    <span class="countdown-number" id="countdownVolume">--</span><span class="countdown-unit">m3</span>
                </div>
            </div>
            <div class="countdown-bar">
                <div class="countdown-bar-fill" id="countdownFill"></div>
            </div>
            <div class="countdown-details">
                <div class="countdown-detail">
                    <div class="countdown-detail-value">${Utils.formatLargeNumber(dailyConsumption)}</div>
                    <div class="countdown-detail-label">${I18n.t('labels.dailyConsumption')}</div>
                </div>
                <div class="countdown-detail">
                    <div class="countdown-detail-value">${fillPercentage.toFixed(1)}%</div>
                    <div class="countdown-detail-label">${I18n.t('dams.fillRate')}</div>
                </div>
                <div class="countdown-detail">
                    <div class="countdown-detail-value">${Utils.formatNumber(Math.round(consumptionPerSecond * 100) / 100)}</div>
                    <div class="countdown-detail-label">m3/s</div>
                </div>
            </div>
        `;

        startTicker();
    }

    /**
     * Start live countdown ticker
     */
    function startTicker() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        let lastValues = { days: null, hours: null, mins: null, secs: null, volume: null };

        function update() {
            if (!countdownData) return;

            const elapsed = (Date.now() - countdownData.startTime) / 1000;
            const currentWater = Math.max(0, countdownData.startWater - (elapsed * countdownData.consumptionPerSecond));
            const totalSeconds = Math.floor(currentWater / countdownData.consumptionPerSecond);

            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const mins = Math.floor((totalSeconds % 3600) / 60);
            const secs = totalSeconds % 60;

            const daysStr = String(days);
            const hoursStr = String(hours).padStart(2, '0');
            const minsStr = String(mins).padStart(2, '0');
            const secsStr = String(secs).padStart(2, '0');
            const volumeStr = Utils.formatNumber(Math.floor(currentWater));

            updateDigitsWithFlash('countdownDays', daysStr, lastValues.days);
            updateDigitsWithFlash('countdownHours', hoursStr, lastValues.hours);
            updateDigitsWithFlash('countdownMins', minsStr, lastValues.mins);
            updateDigitsWithFlash('countdownSecs', secsStr, lastValues.secs);
            updateDigitsWithFlash('countdownVolume', volumeStr, lastValues.volume);

            const fillPct = Math.min(100, Math.max(0, (currentWater / countdownData.usableCapacity) * 100));
            const fill = document.getElementById('countdownFill');

            if (fill) {
                fill.style.width = `${fillPct}%`;
                fill.style.backgroundColor = Utils.getGradientColor(fillPct);
            }

            lastValues = { days: daysStr, hours: hoursStr, mins: minsStr, secs: secsStr, volume: volumeStr };
        }

        update();
        countdownInterval = setInterval(update, 1000);
    }

    /**
     * Update digits with flash animation
     * @param {string} id - Element ID
     * @param {string} newValue - New value string
     * @param {string|null} oldValue - Previous value string
     */
    function updateDigitsWithFlash(id, newValue, oldValue) {
        const el = document.getElementById(id);
        if (!el) return;

        const newChars = newValue.split('');
        const oldChars = oldValue ? oldValue.split('') : [];

        while (oldChars.length < newChars.length) {
            oldChars.unshift('');
        }
        while (oldChars.length > newChars.length) {
            oldChars.shift();
        }

        let html = '';
        for (let i = 0; i < newChars.length; i++) {
            const char = newChars[i];
            const oldChar = oldChars[i];
            const isDigit = /\d/.test(char);
            const changed = oldValue !== null && char !== oldChar;

            if (isDigit) {
                html += `<span class="countdown-digit${changed ? ' flash' : ''}">${char}</span>`;
            } else {
                html += `<span class="countdown-sep">${char}</span>`;
            }
        }

        el.innerHTML = html;
    }

    /**
     * Stop countdown ticker
     */
    function stop() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        countdownData = null;
    }

    return {
        render,
        stop
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Countdown;
}
