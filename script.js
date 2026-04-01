const models = [
    { id: 'icon', name: 'ICON-EU', sub: 'Open Météo', model: 'icon_seamless', color: 'from-amber-400 to-orange-500' },
    { id: 'gfs', name: 'GFS-Global', sub: 'Standard International', model: 'gfs_seamless', color: 'from-rose-400 to-red-600' },
    { id: 'arome', name: 'AROME-HD', sub: 'Météo-France AROME', model: 'meteofrance_arome', color: 'from-blue-400 to-indigo-600' },
    { id: 'arpege', name: 'ARPEGE', sub: 'Météo-France ARPEGE', model: 'meteofrance_arpege', color: 'from-cyan-400 to-blue-500' },
    { id: 'ecmwf', name: 'ECMWF-IFS', sub: 'Référence Européenne', model: 'ecmwf_ifs04', color: 'from-emerald-400 to-teal-600' },
    { id: 'gem', name: 'GEM-Global', sub: 'Modèle Canadien', model: 'gem_seamless', color: 'from-purple-400 to-fuchsia-600' }
];

let favorites = JSON.parse(localStorage.getItem('meteoFavs')) || [];
let currentCoords = { lat: 0, lon: 0 };

document.addEventListener('DOMContentLoaded', renderFavorites);
document.getElementById('weatherForm').addEventListener('submit', e => { 
    e.preventDefault(); 
    getAllWeather(); 
    document.getElementById('cityInput').blur(); 
});

function getIcon(code) {
    if (code <= 1) return 'fa-sun text-yellow-400';
    if (code <= 3) return 'fa-cloud-sun text-indigo-300';
    if (code >= 51 && code <= 67) return 'fa-cloud-showers-heavy text-blue-400';
    if (code >= 95) return 'fa-bolt-lightning text-purple-400';
    return 'fa-cloud text-slate-500';
}

function getRainValue(h, i, mName) {
    const keys = ['precipitation_probability', `precipitation_probability_${mName}`, 'precipitation'];
    for (let k of keys) {
        if (h[k] !== undefined && h[k] !== null) return k === 'precipitation' ? (h[k][i] > 0 ? 100 : 0) : h[k][i];
    }
    return 0;
}

function renderFavorites() {
    const container = document.getElementById('favoritesSection');
    const list = document.getElementById('favoritesList');
    if (favorites.length === 0) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    list.innerHTML = favorites.map(city => `<div class="fav-badge text-white" onclick="searchFavorite('${city}')"><span>${city}</span></div>`).join('');
}

function toggleFavorite() {
    const cityName = document.getElementById('displayCity').innerText.trim();
    const index = favorites.findIndex(f => f.toLowerCase() === cityName.toLowerCase());
    if (index !== -1) {
        favorites.splice(index, 1);
        document.getElementById('favBtn').classList.remove('is-fav');
    } else {
        favorites.push(cityName);
        document.getElementById('favBtn').classList.add('is-fav');
    }
    localStorage.setItem('meteoFavs', JSON.stringify(favorites));
    renderFavorites();
}

function searchFavorite(city) {
    document.getElementById('cityInput').value = city;
    getAllWeather();
}

async function getAllWeather() {
    const cityInput = document.getElementById('cityInput').value.trim();
    if (!cityInput) return;
    const btn = document.getElementById('searchBtn');
    btn.disabled = true;
    
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityInput)}&count=1&language=fr&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results) throw new Error("Ville non trouvée");
        
        const { latitude, longitude, name } = geoData.results[0];
        currentCoords = { lat: latitude, lon: longitude };
        
        document.getElementById('displayCity').innerText = name;
        document.getElementById('resultsArea').classList.remove('hidden');
        document.getElementById('detailArea').classList.add('hidden');
        
        const isFav = favorites.some(f => f.toLowerCase() === name.toLowerCase());
        document.getElementById('favBtn').classList.toggle('is-fav', isFav);

        const grid = document.getElementById('weatherGrid');
        grid.innerHTML = models.map((m, i) => `
            <div class="glass p-6 card-pro reveal-card" style="animation-delay: ${i * 0.1}s" onclick="showDetails('${m.id}')">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <p class="text-[10px] font-black uppercase text-indigo-400 tracking-wider mb-1">${m.name}</p>
                        <h3 class="font-bold text-white text-sm">${m.sub}</h3>
                    </div>
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br ${m.color} flex items-center justify-center shadow-lg"><i class="fas fa-plus text-[10px] text-white"></i></div>
                </div>
                <div id="data-${m.id}" class="min-h-[140px] flex items-center justify-center"><i class="fas fa-circle-notch fa-spin text-slate-800 text-xl"></i></div>
            </div>
        `).join('');

        // Optimisation Fluidité : affichage progressif des modèles
        models.forEach((m, index) => {
            setTimeout(() => {
                fetchHomeData(m, latitude, longitude);
            }, index * 60);
        });

    } catch (e) { alert(e.message); } finally { btn.disabled = false; }
}

async function fetchHomeData(m, lat, lon) {
    const container = document.getElementById(`data-${m.id}`);

    try {
        const isMF = m.model.includes('meteofrance') || m.model.includes('ecmwf');
        const url = `${isMF ? 'https://api.open-meteo.com/v1/meteofrance' : 'https://api.open-meteo.com/v1/forecast'}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code,precipitation_probability,precipitation&${isMF ? 'model' : 'models'}=${m.model}&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        const h = data.hourly;
        const temps = h.temperature_2m || h[`temperature_2m_${m.model}`];
        const codes = h.weather_code || h[`weather_code_${m.model}`];

        const now = new Date();
        const currentHour = now.getHours();
        let startIndex = h.time.findIndex(t => parseInt(t.substring(11, 13)) === currentHour);
        if (startIndex === -1) startIndex = 0;

        let forecastHTML = '';
        [0, 2, 4, 6].forEach(offset => {
            const i = startIndex + offset;
            if (temps[i] !== undefined) {
                forecastHTML += `
                    <div class="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <span class="text-[10px] font-black ${offset === 0 ? 'text-indigo-400' : 'text-slate-500'} uppercase">${h.time[i].substring(11, 16)}</span>
                        <i class="fas ${getIcon(codes[i])} text-xs"></i>
                        <span class="text-xs font-black text-white w-8 text-right">${Math.round(temps[i])}°</span>
                    </div>`;
            }
        });

        container.innerHTML = `
            <div class="w-full">
                <div class="flex items-center gap-4 mb-4">
                    <i class="fas ${getIcon(codes[startIndex])} text-4xl"></i>
                    <span class="text-5xl font-black tracking-tighter">${Math.round(temps[startIndex])}°</span>
                </div>
                <div class="space-y-0.5 mb-4">${forecastHTML}</div>
                <div class="pt-3 border-t border-white/10 flex justify-between items-center">
                    <span class="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Prob. Pluie</span>
                    <span class="text-xs font-black text-cyan-400">${Math.round(getRainValue(h, startIndex, m.model))}%</span>
                </div>
            </div>`;
    } catch (e) { container.innerHTML = "<p class='text-xs text-slate-600'>Erreur</p>"; }
}

async function showDetails(modelId) {
    const m = models.find(mod => mod.id === modelId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    document.getElementById('resultsArea').classList.add('hidden');
    document.getElementById('searchSection').classList.add('hidden');
    document.getElementById('detailArea').classList.remove('hidden');
    document.getElementById('mobileHomeBtn').classList.add('visible');
    
    const content = document.getElementById('detailContent');
    content.innerHTML = `<div class="flex justify-center py-20"><i class="fas fa-circle-notch fa-spin text-3xl text-indigo-500"></i></div>`;

    try {
        const isMF = m.model.includes('meteofrance') || m.model.includes('ecmwf');
        const url = `${isMF ? 'https://api.open-meteo.com/v1/meteofrance' : 'https://api.open-meteo.com/v1/forecast'}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&hourly=temperature_2m,weather_code,precipitation_probability,precipitation&${isMF ? 'model' : 'models'}=${m.model}&timezone=auto&forecast_days=3`;
        const res = await fetch(url);
        const data = await res.json();
        const h = data.hourly;
        const t = h.temperature_2m || h[`temperature_2m_${m.model}`];
        const c = h.weather_code || h[`weather_code_${m.model}`];

        const days = {};
        h.time.forEach((time, i) => {
            const date = time.substring(0, 10);
            if (!days[date]) days[date] = [];
            days[date].push({ time: time.substring(11, 16), temp: t[i], rain: getRainValue(h, i, m.model), code: c[i] });
        });

        content.innerHTML = `<div class="mb-8 text-center reveal-card"><p class="text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px] mb-2">${m.name}</p><h2 class="text-3xl font-black uppercase italic">${m.sub}</h2></div>` + 
        Object.keys(days).map((date, idx) => {
            const label = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
            return `
                <div class="glass mb-4 overflow-hidden reveal-card" style="animation-delay: ${idx * 0.1}s">
                    <div class="p-6 flex justify-between items-center cursor-pointer" onclick="toggleDay(${idx})">
                        <span class="font-black uppercase italic text-sm">${label}</span>
                        <div class="flex items-center gap-4"><span class="text-2xl font-black">${Math.round(Math.max(...days[date].map(d=>d.temp)))}°</span><i class="fas fa-chevron-down text-indigo-500 transition-transform duration-300" id="icon-${idx}"></i></div>
                    </div>
                    <div id="day-${idx}" class="day-collapse px-4 bg-black/10">
                        ${days[date].filter((_, i) => i % 2 === 0).map(d => {
                            const now = new Date();
                            const isToday = new Date(date).toDateString() === now.toDateString();
                            const currentHour = now.getHours();
                            const slotHour = parseInt(d.time.substring(0, 2));
                            const isLive = isToday && (slotHour === currentHour || (currentHour % 2 !== 0 && slotHour === currentHour - 1));

                            return `
                                <div class="flex justify-between items-center py-4 px-4 my-1 border-t border-white/5 transition-all ${isLive ? 'live-indicator' : ''}">
                                    <div class="flex flex-col"><span class="text-[11px] font-bold ${isLive ? 'text-indigo-400' : 'text-slate-500'} w-12">${d.time}</span></div>
                                    <i class="fas ${getIcon(d.code)} text-lg"></i>
                                    <span class="font-black w-10 text-right">${Math.round(d.temp)}°</span>
                                    <span class="text-cyan-400 font-bold text-[10px] w-12 text-right">${Math.round(d.rain)}%</span>
                                </div>`;
                        }).join('')}
                    </div>
                </div>`;
        }).join('');
    } catch (e) { content.innerHTML = "<p class='text-center'>Erreur de chargement</p>"; }
}

window.toggleDay = function(idx) {
    const el = document.getElementById(`day-${idx}`);
    const icon = document.getElementById(`icon-${idx}`);
    const isOpen = el.classList.contains('open');
    document.querySelectorAll('.day-collapse').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.fa-chevron-down').forEach(i => i.style.transform = 'rotate(0deg)');
    if (!isOpen) { el.classList.add('open'); icon.style.transform = 'rotate(180deg)'; }
};

window.backToHome = function() {
    document.getElementById('cityInput').value = "";
    document.getElementById('resultsArea').classList.add('hidden');
    document.getElementById('detailArea').classList.add('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
    document.getElementById('mobileHomeBtn').classList.remove('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.backToGrid = function() {
    document.getElementById('detailArea').classList.add('hidden');
    document.getElementById('resultsArea').classList.remove('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
    document.getElementById('mobileHomeBtn').classList.remove('visible');
};