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
document.getElementById('weatherForm').addEventListener('submit', e => { e.preventDefault(); getAllWeather(); });

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

// --- GESTION DES FAVORIS ---
function renderFavorites() {
    const container = document.getElementById('favoritesSection');
    const list = document.getElementById('favoritesList');
    if (favorites.length === 0) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    list.innerHTML = favorites.map(city => `
        <div class="fav-badge text-white group" onclick="searchFavorite('${city}')">
            <span>${city}</span>
            <i class="fas fa-times text-[10px] text-slate-500 hover:text-red-400 p-1" onclick="event.stopPropagation(); removeFavorite('${city}')"></i>
        </div>
    `).join('');
}

function toggleFavorite() {
    const cityName = document.getElementById('displayCity').innerText.trim();
    const btn = document.getElementById('favBtn');
    
    // Comparaison souple
    const index = favorites.findIndex(f => f.toLowerCase() === cityName.toLowerCase());
    
    if (index !== -1) {
        favorites.splice(index, 1);
        btn.classList.remove('is-fav');
    } else {
        favorites.push(cityName);
        btn.classList.add('is-fav');
    }
    localStorage.setItem('meteoFavs', JSON.stringify(favorites));
    renderFavorites();
}

function removeFavorite(city) {
    favorites = favorites.filter(f => f.toLowerCase() !== city.toLowerCase());
    localStorage.setItem('meteoFavs', JSON.stringify(favorites));
    renderFavorites();
    // Mise à jour de l'étoile si c'est la ville affichée
    if (document.getElementById('displayCity').innerText.trim().toLowerCase() === city.toLowerCase()) {
        document.getElementById('favBtn').classList.remove('is-fav');
    }
}

function searchFavorite(city) {
    document.getElementById('cityInput').value = city;
    getAllWeather();
}

// --- LOGIQUE PRINCIPALE ---
window.backToHome = function() {
    document.getElementById('cityInput').value = '';
    document.getElementById('resultsArea').classList.add('hidden');
    document.getElementById('detailArea').classList.add('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
    document.getElementById('mobileHomeBtn').classList.remove('visible');
    renderFavorites();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function getAllWeather() {
    const city = document.getElementById('cityInput').value.trim();
    if (!city) return;
    const btn = document.getElementById('searchBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch loading-spin"></i>';
    
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results) throw new Error("Ville introuvable...");
        
        const { latitude, longitude, name } = geoData.results[0];
        currentCoords = { lat: latitude, lon: longitude };
        
        const displayCityEl = document.getElementById('displayCity');
        displayCityEl.innerText = name;
        document.getElementById('resultsArea').classList.remove('hidden');
        document.getElementById('detailArea').classList.add('hidden');
        document.getElementById('mobileHomeBtn').classList.remove('visible');
        
        // --- CORRECTION : Mise à jour de l'étoile ici ---
        const favBtn = document.getElementById('favBtn');
        const isFav = favorites.some(f => f.toLowerCase() === name.toLowerCase());
        isFav ? favBtn.classList.add('is-fav') : favBtn.classList.remove('is-fav');

        const grid = document.getElementById('weatherGrid');
        grid.innerHTML = ''; 
        const currentHour = new Date().getHours();

        models.forEach(m => {
            const card = document.createElement('div');
            card.className = `glass p-8 card-pro`;
            card.onclick = () => showDetails(m);
            card.innerHTML = `
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">${m.name}</p>
                        <h3 class="text-xl font-bold text-white tracking-tight">${m.sub}</h3>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center shadow-lg"><i class="fas fa-plus text-[10px] text-white"></i></div>
                </div>
                <div id="data-${m.id}"><div class="h-24 flex items-center justify-center"><i class="fas fa-circle-notch loading-spin text-slate-700 text-2xl"></i></div></div>
            `;
            grid.appendChild(card);
        });

        await Promise.all(models.map(m => fetchHomeData(m, latitude, longitude, currentHour)));

    } catch (e) { alert(e.message); } finally { btn.disabled = false; btn.innerHTML = 'ANALYSER'; }
}

async function fetchHomeData(m, lat, lon, currentHour) {
    const container = document.getElementById(`data-${m.id}`);
    try {
        const isMF = m.model.includes('meteofrance') || m.model.includes('ecmwf');
        const url = `${isMF ? 'https://api.open-meteo.com/v1/meteofrance' : 'https://api.open-meteo.com/v1/forecast'}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&${isMF ? 'model' : 'models'}=${m.model}&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        const h = data.hourly;
        const temps = h.temperature_2m || h[`temperature_2m_${m.model}`];
        const codes = h.weather_code || h[`weather_code_${m.model}`];
        let start = h.time.findIndex(t => parseInt(t.substring(11, 13)) >= currentHour);
        if (start === -1) start = 0;

        let list = '';
        for(let offset = 2; offset <= 8; offset += 2) {
            const i = start + offset;
            if (!temps[i]) continue;
            list += `
                <div class="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                    <span class="text-[11px] font-bold text-indigo-200/50 uppercase">${h.time[i].substring(11, 16)}</span>
                    <i class="fas ${getIcon(codes[i])} text-sm"></i>
                    <span class="text-sm font-black text-white w-10 text-right">${Math.round(temps[i])}°</span>
                    <span class="text-cyan-400 font-bold text-[10px] w-12 text-right">${Math.round(getRainValue(h, i, m.model))}%</span>
                </div>`;
        }
        container.innerHTML = `
            <div class="flex items-center gap-6 mb-6">
                <i class="fas ${getIcon(codes[start])} text-5xl drop-shadow-lg"></i>
                <div class="text-5xl font-black text-white tracking-tighter">${Math.round(temps[start])}°</div>
            </div>
            <div class="space-y-0">${list}</div>
        `;
    } catch (e) { container.innerHTML = "<p class='text-slate-600 text-xs text-center'>Erreur</p>"; }
}

async function showDetails(m) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('resultsArea').classList.add('hidden');
    document.getElementById('searchSection').classList.add('hidden');
    document.getElementById('detailArea').classList.remove('hidden');
    document.getElementById('mobileHomeBtn').classList.add('visible');
    const content = document.getElementById('detailContent');
    content.innerHTML = `<div class="flex justify-center py-40"><i class="fas fa-circle-notch loading-spin text-4xl text-indigo-500"></i></div>`;

    try {
        const isMF = m.model.includes('meteofrance') || m.model.includes('ecmwf');
        const url = `${isMF ? 'https://api.open-meteo.com/v1/meteofrance' : 'https://api.open-meteo.com/v1/forecast'}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&${isMF ? 'model' : 'models'}=${m.model}&timezone=auto&forecast_days=3`;
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

        let html = `<div class="space-y-6">`;
        Object.keys(days).forEach((date, idx) => {
            const dayData = days[date];
            const label = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const tempsArr = dayData.map(d => d.temp);
            html += `
                <div class="glass p-2">
                    <button onclick="toggleDay(${idx})" class="w-full flex items-center justify-between p-8 hover:bg-white/[0.03] rounded-[28px] transition-all">
                        <div class="text-left">
                            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">${m.name}</p>
                            <h3 class="text-2xl font-black text-white italic tracking-tight">${label}</h3>
                        </div>
                        <div class="flex items-center gap-8">
                            <div class="text-right"><p class="text-3xl font-black text-white">${Math.round(Math.max(...tempsArr))}°</p></div>
                            <i class="fas fa-chevron-down text-indigo-500 transition-transform duration-500" id="icon-${idx}"></i>
                        </div>
                    </button>
                    <div id="day-${idx}" class="day-collapse"><div class="px-8 pt-4 grid grid-cols-1 md:grid-cols-2 gap-x-12 border-t border-white/5 mx-4">
                        ${dayData.filter((_, i) => i % 2 === 0).map(d => `
                            <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                                <span class="text-xs font-bold text-slate-500 w-12">${d.time}</span>
                                <i class="fas ${getIcon(d.code)} text-lg"></i>
                                <span class="text-lg font-black text-white w-12 text-right">${Math.round(d.temp)}°</span>
                                <span class="text-cyan-400 font-black text-[10px] w-12 text-right">${Math.round(d.rain)}%</span>
                            </div>
                        `).join('')}
                    </div></div>
                </div>`;
        });
        content.innerHTML = html + `</div>`;
    } catch (e) { content.innerHTML = "Erreur."; }
}

window.toggleDay = function(idx) {
    const el = document.getElementById(`day-${idx}`);
    const icon = document.getElementById(`icon-${idx}`);
    const isOpen = el.classList.contains('open');
    document.querySelectorAll('.day-collapse').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.fa-chevron-down').forEach(i => i.style.transform = 'rotate(0deg)');
    if (!isOpen) { el.classList.add('open'); icon.style.transform = 'rotate(180deg)'; }
};

window.backToGrid = function() {
    document.getElementById('detailArea').classList.add('hidden');
    document.getElementById('resultsArea').classList.remove('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
    document.getElementById('mobileHomeBtn').classList.remove('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};