const models = [
    { id: 'icon', name: 'ICON-EU', sub: 'Précision Allemande', model: 'icon_seamless', color: 'from-amber-400 to-orange-500' },
    { id: 'gfs', name: 'GFS-Global', sub: 'Standard Américain', model: 'gfs_seamless', color: 'from-rose-400 to-red-600' },
    { id: 'arome', name: 'AROME-HD', sub: 'Haute Définition FR', model: 'meteofrance_arome', color: 'from-blue-400 to-indigo-600' },
    { id: 'arpege', name: 'ARPEGE', sub: 'Météo-France Global', model: 'meteofrance_arpege', color: 'from-cyan-400 to-blue-500' },
    { id: 'ecmwf', name: 'ECMWF-IFS', sub: 'Référence Européenne', model: 'ecmwf_ifs04', color: 'from-emerald-400 to-teal-600' },
    { id: 'gem', name: 'GEM-Global', sub: 'Modèle Canadien', model: 'gem_seamless', color: 'from-purple-400 to-fuchsia-600' }
];

let favorites = JSON.parse(localStorage.getItem('meteoFavs')) || [];
let currentCoords = { lat: 0, lon: 0 };

document.addEventListener('DOMContentLoaded', renderFavorites);
document.getElementById('weatherForm').addEventListener('submit', e => { 
    e.preventDefault(); 
    getAllWeather(); 
    document.getElementById('cityInput').blur(); // Ferme le clavier mobile
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
    list.innerHTML = favorites.map(city => `
        <div class="fav-badge text-white" onclick="searchFavorite('${city}')">
            <span>${city}</span>
            <i class="fas fa-times ml-2 text-slate-500" onclick="event.stopPropagation(); removeFavorite('${city}')"></i>
        </div>
    `).join('');
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

function removeFavorite(city) {
    favorites = favorites.filter(f => f.toLowerCase() !== city.toLowerCase());
    localStorage.setItem('meteoFavs', JSON.stringify(favorites));
    renderFavorites();
    if (document.getElementById('displayCity').innerText.trim().toLowerCase() === city.toLowerCase()) {
        document.getElementById('favBtn').classList.remove('is-fav');
    }
}

function searchFavorite(city) {
    document.getElementById('cityInput').value = city;
    getAllWeather();
}

window.backToHome = function() {
    document.getElementById('resultsArea').classList.add('hidden');
    document.getElementById('detailArea').classList.add('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
    document.getElementById('mobileHomeBtn').classList.remove('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function getAllWeather() {
    const city = document.getElementById('cityInput').value.trim();
    if (!city) return;
    const btn = document.getElementById('searchBtn');
    btn.disabled = true;
    
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`);
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
        grid.innerHTML = models.map(m => `
            <div class="glass p-6 card-pro" onclick="showDetails('${m.id}')">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <p class="text-[10px] font-bold uppercase text-indigo-400">${m.name}</p>
                        <h3 class="font-bold text-white">${m.sub}</h3>
                    </div>
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br ${m.color} flex items-center justify-center shadow-lg">
                        <i class="fas fa-plus text-[10px] text-white"></i>
                    </div>
                </div>
                <div id="data-${m.id}" class="min-h-[100px] flex items-center justify-center">
                    <i class="fas fa-circle-notch fa-spin text-slate-700"></i>
                </div>
            </div>
        `).join('');

        models.forEach(m => fetchHomeData(m, latitude, longitude));

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
        const start = 0; // Simplifié pour perf

        container.innerHTML = `
            <div class="w-full">
                <div class="flex items-center gap-4 mb-4">
                    <i class="fas ${getIcon(codes[start])} text-3xl"></i>
                    <span class="text-4xl font-black">${Math.round(temps[start])}°</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-400">
                    <div class="flex justify-between border-b border-white/5 pb-1">
                        <span>+2h</span><span>${Math.round(temps[start+2])}°</span>
                    </div>
                    <div class="flex justify-between border-b border-white/5 pb-1">
                        <span>Pluie</span><span>${Math.round(getRainValue(h, start, m.model))}%</span>
                    </div>
                </div>
            </div>`;
    } catch (e) { container.innerHTML = "Erreur"; }
}

async function showDetails(modelId) {
    const m = models.find(mod => mod.id === modelId);
    window.scrollTo({ top: 0 });
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

        content.innerHTML = Object.keys(days).map((date, idx) => {
            const dayData = days[date];
            const label = new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
            return `
                <div class="glass mb-4 overflow-hidden">
                    <div class="p-6 flex justify-between items-center" onclick="toggleDay(${idx})">
                        <span class="font-black uppercase italic">${label}</span>
                        <div class="flex items-center gap-4">
                            <span class="text-xl font-bold">${Math.round(Math.max(...dayData.map(d=>d.temp)))}°</span>
                            <i class="fas fa-chevron-down text-indigo-500" id="icon-${idx}"></i>
                        </div>
                    </div>
                    <div id="day-${idx}" class="day-collapse px-6">
                        ${dayData.filter((_,i)=>i%3===0).map(d => `
                            <div class="flex justify-between py-3 border-t border-white/5 text-sm">
                                <span class="text-slate-500">${d.time}</span>
                                <i class="fas ${getIcon(d.code)}"></i>
                                <span class="font-bold">${Math.round(d.temp)}°</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        }).join('');
    } catch (e) { content.innerHTML = "Erreur."; }
}

window.toggleDay = function(idx) {
    const el = document.getElementById(`day-${idx}`);
    const isOpen = el.classList.contains('open');
    document.querySelectorAll('.day-collapse').forEach(d => d.classList.remove('open'));
    if (!isOpen) el.classList.add('open');
};

window.backToGrid = function() {
    document.getElementById('detailArea').classList.add('hidden');
    document.getElementById('resultsArea').classList.remove('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
    document.getElementById('mobileHomeBtn').classList.remove('visible');
};