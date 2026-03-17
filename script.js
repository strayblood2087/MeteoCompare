const models = [
    { id: 'icon', name: 'Allemagne (ICON)', sub: 'Open-Météo / Précision EU', model: 'icon_seamless', color: 'amber' },
    { id: 'gfs', name: 'USA (GFS)', sub: 'Standard International', model: 'gfs_seamless', color: 'rose' },
    { id: 'arome', name: 'Météo-France (AROME)', sub: 'Météo Agricole / MF Pro', model: 'meteofrance_arome', color: 'blue' },
    { id: 'arpege', name: 'Météo-France (ARPEGE)', sub: 'Météociel / Global FR', model: 'meteofrance_arpege', color: 'cyan' },
    { id: 'ecmwf', name: 'Europe (ECMWF)', sub: 'Meteoblue / Météo Radar', model: 'ecmwf_ifs04', color: 'emerald' },
    { id: 'gem', name: 'Canada (GEM)', sub: 'Modèle Global CMC', model: 'gem_seamless', color: 'purple' }
];

let currentCoords = { lat: 0, lon: 0 };

// Gestion de la soumission du formulaire
document.getElementById('weatherForm').addEventListener('submit', (e) => {
    e.preventDefault();
    getAllWeather();
});

function getIcon(code) {
    if (code <= 1) return 'fa-sun text-orange-400';
    if (code <= 3) return 'fa-cloud-sun text-slate-400';
    if (code >= 51 && code <= 67) return 'fa-cloud-showers-heavy text-blue-500';
    if (code >= 95) return 'fa-bolt text-indigo-600';
    return 'fa-cloud text-slate-500';
}

function getRainValue(hourlyData, index, modelName) {
    const probKeys = ['precipitation_probability', `precipitation_probability_${modelName}`];
    const mmKeys = ['precipitation', `precipitation_${modelName}`];
    
    for (let key of probKeys) {
        if (hourlyData[key] !== undefined && hourlyData[key] !== null) return hourlyData[key][index];
    }
    for (let key of mmKeys) {
        if (hourlyData[key] !== undefined && hourlyData[key] !== null) return hourlyData[key][index] > 0 ? 100 : 0;
    }
    return 0;
}

async function getAllWeather() {
    const city = document.getElementById('cityInput').value.trim();
    if (!city) return;
    const btn = document.getElementById('searchBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner loading-spin"></i>';
    
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results) throw new Error("Ville non trouvée");
        
        const { latitude, longitude, name, country } = geoData.results[0];
        currentCoords = { lat: latitude, lon: longitude };
        
        document.getElementById('displayCity').innerHTML = `<i class="fas fa-location-dot text-indigo-500"></i> ${name}, ${country}`;
        document.getElementById('resultsArea').classList.remove('hidden');
        document.getElementById('detailArea').classList.add('hidden');
        
        const grid = document.getElementById('weatherGrid');
        grid.innerHTML = ''; 
        const currentHour = new Date().getHours();

        models.forEach(m => {
            const card = document.createElement('div');
            card.className = `glass p-6 rounded-3xl border-t-8 border-${m.color}-500 shadow-xl card-pro`;
            card.onclick = () => showDetails(m);
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div><h3 class="font-black text-slate-900 text-lg leading-none mb-1">${m.sub}</h3><p class="text-[10px] text-slate-400 uppercase font-bold">${m.name}</p></div>
                    <i class="fas fa-plus-circle text-slate-300"></i>
                </div>
                <div id="data-${m.id}" class="text-center py-8"><i class="fas fa-circle-notch loading-spin text-slate-200 text-3xl"></i></div>
            `;
            grid.appendChild(card);
            fetchHomeData(m, latitude, longitude, currentHour);
        });
    } catch (e) { alert(e.message); } finally { btn.disabled = false; btn.innerHTML = 'COMPARER'; }
}

async function fetchHomeData(m, lat, lon, currentHour) {
    const container = document.getElementById(`data-${m.id}`);
    try {
        const isMF = m.model.includes('meteofrance') || m.model.includes('ecmwf');
        const baseUrl = isMF ? 'https://api.open-meteo.com/v1/meteofrance' : 'https://api.open-meteo.com/v1/forecast';
        const url = `${baseUrl}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&${isMF ? 'model' : 'models'}=${m.model}&timezone=auto`;
        
        const res = await fetch(url);
        const data = await res.json();
        const h = data.hourly;
        const temps = h.temperature_2m || h[`temperature_2m_${m.model}`];
        const codes = h.weather_code || h[`weather_code_${m.model}`];

        let startIndex = h.time.findIndex(t => parseInt(t.substring(11, 13)) >= currentHour);
        if (startIndex === -1) startIndex = 0;

        let forecastHTML = '';
        for(let offset = 1; offset <= 6; offset++) {
            const i = startIndex + offset;
            if (!temps[i]) continue;
            const rainVal = getRainValue(h, i, m.model);
            forecastHTML += `<div class="flex justify-between items-center text-[11px] py-1 border-b border-slate-50 last:border-0">
                <span class="text-slate-500 font-bold">${h.time[i].substring(11, 16)}</span>
                <i class="fas ${getIcon(codes[i])} text-slate-300 w-4 text-center"></i>
                <span class="font-black text-slate-700 w-10 text-right">${temps[i].toFixed(1)}°</span>
                <span class="text-blue-500 font-bold w-12 text-right">${Math.round(rainVal)}%</span>
            </div>`;
        }

        container.classList.remove('text-center', 'py-8');
        container.innerHTML = `
            <div class="flex items-center justify-around mb-4">
                <i class="fas ${getIcon(codes[startIndex])} text-5xl"></i>
                <div class="text-4xl font-black text-slate-800">${temps[startIndex].toFixed(1)}°</div>
            </div>
            <div class="space-y-1 border-t pt-2">${forecastHTML}</div>
        `;
    } catch (e) { container.innerHTML = "Indisponible"; }
}

async function showDetails(m) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('resultsArea').classList.add('hidden');
    document.getElementById('searchSection').classList.add('hidden');
    document.getElementById('detailArea').classList.remove('hidden');
    const content = document.getElementById('detailContent');
    content.innerHTML = `<div class="text-center py-20 text-white"><i class="fas fa-circle-notch loading-spin text-5xl"></i></div>`;

    try {
        const isMF = m.model.includes('meteofrance') || m.model.includes('ecmwf');
        const baseUrl = isMF ? 'https://api.open-meteo.com/v1/meteofrance' : 'https://api.open-meteo.com/v1/forecast';
        const url = `${baseUrl}?latitude=${currentCoords.lat}&longitude=${currentCoords.lon}&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&${isMF ? 'model' : 'models'}=${m.model}&timezone=auto&forecast_days=3`;
        
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

        let html = `<div class="space-y-4">`;
        Object.keys(days).forEach((date, idx) => {
            const dayData = days[date];
            const dayLabel = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const tempsArray = dayData.map(d => d.temp);

            html += `
                <div class="glass rounded-3xl overflow-hidden shadow-lg border border-white/20">
                    <button onclick="toggleDay(${idx})" class="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                        <div class="text-left">
                            <p class="text-xs font-bold text-indigo-500 uppercase tracking-widest leading-none mb-1">Modèle : ${m.name}</p>
                            <h3 class="text-xl font-black text-slate-800 capitalize">${dayLabel}</h3>
                        </div>
                        <div class="flex items-center gap-6">
                            <div class="text-right">
                                <p class="text-2xl font-black text-slate-800">${Math.max(...tempsArray).toFixed(1)}°</p>
                                <p class="text-xs font-bold text-slate-400">${Math.min(...tempsArray).toFixed(1)}°</p>
                            </div>
                            <i class="fas fa-chevron-down text-slate-300" id="icon-${idx}"></i>
                        </div>
                    </button>
                    <div id="day-${idx}" class="day-collapse bg-slate-50/50">
                        <div class="p-6 grid grid-cols-1 gap-2 border-t border-slate-100">
                            ${dayData.filter((_, i) => i % 2 === 0).map(d => `
                                <div class="flex items-center justify-between py-2 border-b border-white last:border-0">
                                    <span class="font-bold text-slate-600 w-16">${d.time}</span>
                                    <i class="fas ${getIcon(d.code)} text-xl text-slate-400"></i>
                                    <span class="font-black text-slate-800 w-12 text-right">${d.temp.toFixed(1)}°</span>
                                    <span class="text-blue-500 font-bold w-12 text-right">${Math.round(d.rain)}%</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
        content.innerHTML = html + `</div>`;
    } catch (e) { content.innerHTML = "Erreur de chargement."; }
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
};