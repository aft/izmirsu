/**
 * Monthly Water Data Collection Script
 * Fetches current dam/well water levels and appends to historical JSON
 * Run by GitHub Actions on the 1st of each month at 00:00 UTC
 * Cem Baspinar - MIT License
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://openapi.izmir.bel.tr/api/izsu';
const HISTORY_FILE = path.join(__dirname, '..', 'data', 'history.json');

// Skip SSL verification (IZSU cert is expired)
const agent = new https.Agent({ rejectUnauthorized: false });

async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const data = await new Promise((resolve, reject) => {
                https.get(url, { agent }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(body));
                        } catch (e) {
                            reject(new Error('JSON parse error'));
                        }
                    });
                }).on('error', reject);
            });

            if (data && data.message === 'An unexpected error occurred') {
                throw new Error('Server returned error in response body');
            }

            return data;
        } catch (error) {
            console.log(`Attempt ${i + 1} failed: ${error.message}`);
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }
    throw new Error(`Failed after ${retries} attempts`);
}

async function collectData() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Collecting water data for ${today}...`);

    // Fetch dam status
    const damStatus = await fetchWithRetry(`${API_BASE}/barajdurum`);
    console.log(`Fetched ${damStatus.length} dam records`);

    // Fetch daily production
    const dailyProduction = await fetchWithRetry(`${API_BASE}/gunluksuuretimi`);
    console.log('Fetched daily production data');

    // Load existing history
    let history = { entries: [], lastUpdated: null };
    if (fs.existsSync(HISTORY_FILE)) {
        const content = fs.readFileSync(HISTORY_FILE, 'utf8');
        history = JSON.parse(content);
    }

    // Check if we already have data for today
    const existingEntry = history.entries.find(e => e.date === today);
    if (existingEntry) {
        console.log(`Data for ${today} already exists, updating...`);
        const index = history.entries.indexOf(existingEntry);
        history.entries[index] = createEntry(today, damStatus, dailyProduction);
    } else {
        history.entries.push(createEntry(today, damStatus, dailyProduction));
    }

    // Sort by date descending (newest first)
    history.entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Keep only last 24 months (2 years of monthly data)
    if (history.entries.length > 24) {
        history.entries = history.entries.slice(0, 24);
    }

    history.lastUpdated = new Date().toISOString();

    // Ensure data directory exists
    const dataDir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write updated history
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log(`History updated with ${history.entries.length} entries`);
}

function createEntry(date, damStatus, dailyProduction) {
    const dams = damStatus.map(dam => ({
        name: dam.BarajKuyuAdi,
        fillRate: dam.DolulukOrani,
        currentVolume: dam.SuDurumu,
        maxCapacity: dam.MaksimumSuKapasitesi,
        minCapacity: dam.MinimumSuKapasitesi
    }));

    const totalCurrent = dams.reduce((sum, d) => sum + (d.currentVolume || 0), 0);
    const totalMax = dams.reduce((sum, d) => sum + (d.maxCapacity || 0), 0);
    const totalMin = dams.reduce((sum, d) => sum + (d.minCapacity || 0), 0);
    const avgFillRate = dams.reduce((sum, d) => sum + (d.fillRate || 0), 0) / dams.length;

    let production = null;
    if (dailyProduction) {
        production = {
            date: dailyProduction.UretimTarihi,
            total: dailyProduction.ToplamUretim,
            sources: (dailyProduction.BarajKuyuUretimleri || []).map(p => ({
                name: p.BarajKuyuAdi,
                amount: p.UretimMiktari
            }))
        };
    }

    return {
        date,
        timestamp: new Date().toISOString(),
        summary: {
            totalCurrentVolume: totalCurrent,
            totalMaxCapacity: totalMax,
            totalMinCapacity: totalMin,
            usableWater: totalCurrent - totalMin,
            usableCapacity: totalMax - totalMin,
            averageFillRate: Math.round(avgFillRate * 10) / 10
        },
        dams,
        production
    };
}

collectData()
    .then(() => console.log('Data collection complete'))
    .catch(err => {
        console.error('Data collection failed:', err);
        process.exit(1);
    });
