// ── STATE ──
const state = { penduduk: [], lastResult: null, charts: {} };
const API = window.location.origin;

// ── CANVAS ──
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ── TABS ──
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
        content.style.display = 'none';
    });
    const target = document.getElementById(`tab-${tabName}`);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'block';
    }
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) btn.classList.add('active');
    });
    setTimeout(() => {
        if (state.charts['chart-compare']) state.charts['chart-compare'].resize();
    }, 100);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        if (tabName) switchTab(tabName);
    });
});

// ── SLIDERS ──
function bindSlider(id, displayId, decimals = 0) {
    const el = document.getElementById(id);
    const disp = document.getElementById(displayId);
    if (el && disp) el.addEventListener('input', () => disp.textContent = parseFloat(el.value).toFixed(decimals));
}
bindSlider('num_penduduk', 'val-penduduk');
bindSlider('num_menara', 'val-menara');
bindSlider('radius_coverage', 'val-radius');
bindSlider('hc_max_iter', 'val-hciter');
bindSlider('sa_suhu_awal', 'val-suhu');
bindSlider('sa_cooling_rate', 'val-cooling', 3);
bindSlider('ga_populasi', 'val-pop');
bindSlider('ga_generasi', 'val-gen');
bindSlider('ga_crossover', 'val-cx', 2);
bindSlider('ga_mutasi', 'val-mut', 2);

// ── ALGO SELECTOR ──
document.querySelectorAll('input[name="algo"]').forEach(radio => {
    radio.addEventListener('change', () => {
        document.querySelectorAll('.algo-params').forEach(p => p.classList.add('hidden'));
        document.getElementById(`params-${radio.value}`)?.classList.remove('hidden');
    });
});

// ── CHART.JS CONFIG ──
Chart.defaults.color = '#8892aa';
Chart.defaults.borderColor = '#2a3045';
Chart.defaults.font.size = 11;

function destroyChart(id) {
    if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
}

function buatChartKonvergensi(canvasId, history, label, color) {
    destroyChart(canvasId);
    const el = document.getElementById(canvasId);
    if (!el) return;
    const key = history[0]?.iterasi !== undefined ? 'iterasi' : 'generasi';
    state.charts[canvasId] = new Chart(el, {
        type: 'line',
        data: {
            labels: history.map(h => h[key]),
            datasets: [{
                label, data: history.map(h => h.fitness),
                borderColor: color, backgroundColor: color + '18',
                tension: 0.3, fill: true, pointRadius: 0,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#1e2330' }, ticks: { maxTicksLimit: 8 } },
                y: { grid: { color: '#1e2330' }, min: 0, max: 1 },
            }
        }
    });
}

// ── GAMBAR PETA BTS ──
function gambarPeta(canvasEl, penduduk, menara, radius) {
    const c = canvasEl.getContext('2d');
    const W = canvasEl.width, H = canvasEl.height;
    c.clearRect(0, 0, W, H);

    c.fillStyle = '#0d0f14';
    c.fillRect(0, 0, W, H);

    c.strokeStyle = 'rgba(255,255,255,0.03)';
    c.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

    function sx(v) { return (v / 1000) * W; }
    function sy(v) { return (v / 1000) * H; }

    menara.forEach(m => {
        c.beginPath();
        c.arc(sx(m.x), sy(m.y), sx(radius), 0, Math.PI * 2);
        c.fillStyle = 'rgba(0,229,195,0.06)';
        c.fill();
        c.strokeStyle = 'rgba(0,229,195,0.25)';
        c.lineWidth = 1.5;
        c.stroke();
    });

    penduduk.forEach(p => {
        const covered = menara.some(m => {
            const d = Math.sqrt((p.x - m.x) ** 2 + (p.y - m.y) ** 2);
            return d <= radius;
        });
        c.beginPath();
        c.arc(sx(p.x), sy(p.y), 2.5, 0, Math.PI * 2);
        c.fillStyle = covered ? '#00e5c3' : '#ff5c5c';
        c.globalAlpha = 0.8;
        c.fill();
        c.globalAlpha = 1;
    });

    menara.forEach((m, i) => {
        const x = sx(m.x), y = sy(m.y);
        c.beginPath();
        c.arc(x, y, 7, 0, Math.PI * 2);
        c.fillStyle = '#ffb340';
        c.fill();
        c.strokeStyle = '#0d0f14';
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = '#e8ecf4';
        c.font = 'bold 10px Segoe UI';
        c.fillText(`BTS ${i + 1}`, x + 10, y - 6);
    });

    c.fillStyle = 'rgba(0,229,195,0.8)';
    c.beginPath(); c.arc(12, H - 28, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8892aa'; c.font = '10px Segoe UI';
    c.fillText('Tercakup', 20, H - 24);

    c.fillStyle = 'rgba(255,92,92,0.8)';
    c.beginPath(); c.arc(12, H - 12, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8892aa';
    c.fillText('Tidak Tercakup', 20, H - 8);
}

// ── AMBIL CONFIG DARI UI ──
function getConfig() {
    return {
        area_width: 1000, area_height: 1000,
        num_penduduk: parseInt(document.getElementById('num_penduduk').value),
        num_menara: parseInt(document.getElementById('num_menara').value),
        radius_coverage: parseFloat(document.getElementById('radius_coverage').value),
        biaya_per_menara: 1000,
        mode: document.getElementById('mode').value,
        hc_variant: document.getElementById('hc_variant').value,
        hc_max_iter: parseInt(document.getElementById('hc_max_iter').value),
        sa_suhu_awal: parseFloat(document.getElementById('sa_suhu_awal').value),
        sa_cooling_rate: parseFloat(document.getElementById('sa_cooling_rate').value),
        sa_suhu_min: 0.1,
        ga_populasi: parseInt(document.getElementById('ga_populasi').value),
        ga_generasi: parseInt(document.getElementById('ga_generasi').value),
        ga_crossover: parseFloat(document.getElementById('ga_crossover').value),
        ga_mutasi: parseFloat(document.getElementById('ga_mutasi').value),
    };
}

// ── RUN SIMULASI ──
document.getElementById('btn-run').addEventListener('click', async () => {
    const algo = document.querySelector('input[name="algo"]:checked').value;
    const config = getConfig();
    const btn = document.getElementById('btn-run');

    btn.disabled = true;
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('canvas-hint').style.display = 'none';

    try {
        const res = await fetch(`${API}/api/${algo}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        const data = await res.json();
        state.lastResult = data;

        gambarPeta(canvas, data.penduduk, data.menara, config.radius_coverage);

        document.getElementById('result-bar').classList.remove('hidden');
        document.getElementById('res-algo').textContent = data.algoritma + (data.varian ? ` (${data.varian})` : '');
        document.getElementById('res-coverage').textContent = data.coverage_persen + '%';
        document.getElementById('res-fitness').textContent = data.fitness;
        document.getElementById('res-menara').textContent = data.menara.length + ' menara';

        document.getElementById('chart-wrap').classList.remove('hidden');
        buatChartKonvergensi('chart-konvergensi', data.history, 'Fitness', '#00e5c3');

    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.disabled = false;
        document.getElementById('loading').classList.add('hidden');
    }
});

// ── KOMPARASI ──
document.getElementById('btn-compare').addEventListener('click', async () => {
    const config = getConfig();
    const btn = document.getElementById('btn-compare');
    btn.disabled = true;
    btn.textContent = '⏳ Memproses...';

    try {
        const res = await fetch(`${API}/api/compare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        const data = await res.json();

        document.getElementById('compare-cards').classList.remove('hidden');
        document.getElementById('winner-box').classList.remove('hidden');
        document.getElementById('chart-compare-wrap').classList.remove('hidden');

        const algoMap = {
            hill_climbing: { key: 'hc', label: 'Hill Climbing', color: '#ff5c5c' },
            simulated_annealing: { key: 'sa', label: 'Simulated Annealing', color: '#00e5c3' },
            genetic_algorithm: { key: 'ga', label: 'Genetic Algorithm', color: '#a855f7' },
        };

        Object.entries(algoMap).forEach(([apiKey, { key, color }]) => {
            const d = data[apiKey];
            document.getElementById(`cc-${key}-coverage`).textContent = d.coverage_persen + '%';
            document.getElementById(`cc-${key}-fitness`).textContent = 'Fitness: ' + d.fitness;
            const miniCanvas = document.getElementById(`canvas-${key}`);
            gambarPeta(miniCanvas, data.penduduk, d.menara, config.radius_coverage);
            if (apiKey === data.pemenang) {
                document.getElementById(`ccard-${key}`).classList.add('winner');
            }
        });

        const w = algoMap[data.pemenang];
        document.getElementById('winner-name').textContent = w.label;
        document.getElementById('winner-coverage').textContent = data[data.pemenang].coverage_persen + '%';

        destroyChart('chart-compare');
        const allHistories = [
            { history: data.hill_climbing.history, label: 'Hill Climbing', color: '#ff5c5c' },
            { history: data.simulated_annealing.history, label: 'Simulated Annealing', color: '#00e5c3' },
            { history: data.genetic_algorithm.history, label: 'Genetic Algorithm', color: '#a855f7' },
        ];
        const maxLen = Math.max(...allHistories.map(h => h.history.length));
        const labels = Array.from({ length: maxLen }, (_, i) => i + 1);

        state.charts['chart-compare'] = new Chart(document.getElementById('chart-compare'), {
            type: 'line',
            data: {
                labels,
                datasets: allHistories.map(({ history, label, color }) => ({
                    label,
                    data: history.map(h => h.fitness),
                    borderColor: color, backgroundColor: color + '15',
                    tension: 0.3, fill: true, pointRadius: 0,
                }))
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { boxWidth: 12 } } },
                scales: {
                    x: { grid: { color: '#1e2330' }, ticks: { maxTicksLimit: 8 } },
                    y: { grid: { color: '#1e2330' }, min: 0, max: 1 },
                }
            }
        });

    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Bandingkan Sekarang';
    }
});