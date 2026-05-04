// --- STATE MANAGEMENT ---
const ADMIN_PASS = '0809042011zharkyn@';
let state = JSON.parse(localStorage.getItem('sellerBiState')) || {
    clientId: generateID(),
    firstLaunch: Date.now(),
    subscriptionActive: false,
    inventory: [], // {id, name, cat, buy, qty}
    history: [] // {id, type, amount, profit, date, name, cat}
};

let lineChartInst = null;
let pieChartInst = null;

function saveState() {
    localStorage.setItem('sellerBiState', JSON.stringify(state));
}

function generateID() {
    return 'SBI-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// --- INIT & TRIAL CHECK ---
function init() {
    document.getElementById('lock-client-id').innerText = state.clientId;
    document.getElementById('prof-client-id').innerText = state.clientId;
    
    // Check Trial (3 days = 259200000 ms)
    if (!state.subscriptionActive && (Date.now() - state.firstLaunch > 259200000)) {
        document.getElementById('lock-screen').classList.remove('hidden');
        return;
    }

    renderDashboard();
    renderInventory();
    renderHistory();
    initCalc();
    
    document.getElementById('chart-period').addEventListener('change', renderCharts);
}

// --- NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if(btn.dataset.target === tabId) {
            btn.classList.replace('text-gray-400', 'text-kaspi-red');
        } else {
            btn.classList.replace('text-kaspi-red', 'text-gray-400');
        }
    });

    const titles = { 'dashboard': 'Главная', 'inventory': 'Склад', 'history': 'История', 'profile': 'Профиль' };
    document.getElementById('header-title').innerText = titles[tabId];

    if(tabId === 'dashboard') renderCharts();
}

// --- DASHBOARD ---
function renderDashboard() {
    let totalProfit = 0;
    let totalTurnover = 0;
    let totalExpenses = 0;

    state.history.forEach(h => {
        if (h.type === 'sale') {
            totalTurnover += h.amount;
            totalProfit += h.profit;
        } else if (h.type === 'expense') {
            totalExpenses += h.amount;
        }
    });

    document.getElementById('w-profit').innerText = formatSum(totalProfit);
    document.getElementById('w-turnover').innerText = formatSum(totalTurnover);
    document.getElementById('w-expenses').innerText = formatSum(totalExpenses);
    
    renderCharts();
}

function formatSum(num) {
    return num.toLocaleString('ru-RU') + ' ₸';
}

// --- QUICK CALC ---
function initCalc() {
    const buy = document.getElementById('calc-buy');
    const sell = document.getElementById('calc-sell');
    const tax = document.getElementById('calc-tax');
    const res = document.getElementById('calc-result');

    const updateCalc = () => {
        const b = parseFloat(buy.value) || 0;
        const s = parseFloat(sell.value) || 0;
        const t = parseFloat(tax.value) / 100;
        const margin = s - b - (s * t);
        res.innerText = formatSum(margin);
        res.className = margin >= 0 ? 'font-bold text-green-500' : 'font-bold text-kaspi-red';
    };

    buy.addEventListener('input', updateCalc);
    sell.addEventListener('input', updateCalc);
    tax.addEventListener('change', updateCalc);
}

// --- CHARTS ---
function renderCharts() {
    const periodDays = parseInt(document.getElementById('chart-period').value);
    const cutoffDate = Date.now() - (periodDays * 86400000);
    
    const filteredHistory = state.history.filter(h => h.date >= cutoffDate && h.type === 'sale');
    
    // Data for Line Chart (Profit over time)
    const datesMap = {};
    filteredHistory.forEach(h => {
        const d = new Date(h.date).toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'});
        datesMap[d] = (datesMap[d] || 0) + h.profit;
    });

    const labelsLine = Object.keys(datesMap).sort();
    const dataLine = labelsLine.map(k => datesMap[k]);

    if (lineChartInst) lineChartInst.destroy();
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    lineChartInst = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: labelsLine.length ? labelsLine : ['Нет данных'],
            datasets: [{
                label: 'Прибыль',
                data: dataLine.length ? dataLine : [0],
                borderColor: '#F14635',
                backgroundColor: 'rgba(241, 70, 53, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    // Data for Pie Chart (Category Profit)
    const catMap = {};
    filteredHistory.forEach(h => {
        catMap[h.cat] = (catMap[h.cat] || 0) + h.profit;
    });

    if (pieChartInst) pieChartInst.destroy();
    const ctxPie = document.getElementById('pieChart').getContext('2d');
    pieChartInst = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catMap).length ? Object.keys(catMap) : ['Нет данных'],
            datasets: [{
                data: Object.values(catMap).length ? Object.values(catMap) : [1],
                backgroundColor: ['#F14635', '#2B2F33', '#E5E7EB', '#60A5FA', '#34D399']
            }]
        },
        options: { responsive: true }
    });
}

// --- INVENTORY ---
function addInventory() {
    const name = document.getElementById('inv-name').value.trim();
    const cat = document.getElementById('inv-cat').value.trim() || 'Без категории';
    const buy = parseFloat(document.getElementById('inv-buy').value);
    const qty = parseInt(document.getElementById('inv-qty').value);

    if (!name || isNaN(buy) || isNaN(qty)) return alert('Заполните все поля корректно!');

    const existing = state.inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        existing.qty += qty;
        existing.buy = buy; // update price to latest
    } else {
        state.inventory.push({ id: Date.now(), name, cat, buy, qty });
    }

    // Log expense
    state.history.push({ id: Date.now(), type: 'expense', amount: buy * qty, profit: 0, date: Date.now(), name: `Закуп: ${name}`, cat });
    
    saveState();
    renderInventory();
    renderDashboard();
    document.getElementById('inv-name').value = ''; document.getElementById('inv-cat').value = '';
    document.getElementById('inv-buy').value = ''; document.getElementById('inv-qty').value = '';
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = state.inventory.map(item => `
        <div class="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex justify-between items-center">
            <div>
                <h4 class="font-bold text-kaspi-text">${item.name}</h4>
                <p class="text-xs text-gray-400">${item.cat} • Закуп: ${item.buy} ₸</p>
                <p class="text-sm font-medium mt-1">Остаток: ${item.qty} шт</p>
            </div>
            <button onclick="sellItem(${item.id})" class="bg-kaspi-bg text-kaspi-red px-4 py-2 rounded-xl font-bold text-sm active:scale-95 transition" ${item.qty <= 0 ? 'disabled style="opacity:0.5"' : ''}>Продать</button>
        </div>
    `).join('') || '<p class="text-gray-400 text-center text-sm py-4">Склад пуст</p>';
}

function sellItem(id) {
    const item = state.inventory.find(i => i.id === id);
    if (!item || item.qty <= 0) return;

    const sellPrice = parseFloat(prompt(`Цена продажи для "${item.name}" (Закуп: ${item.buy} ₸):`, ''));
    if (isNaN(sellPrice) || sellPrice <= 0) return;

    item.qty -= 1;
    const profit = sellPrice - item.buy;

    state.history.push({ id: Date.now(), type: 'sale', amount: sellPrice, profit: profit, date: Date.now(), name: item.name, cat: item.cat });
    
    saveState();
    renderInventory();
    renderDashboard();
    renderHistory();
}

// --- HISTORY ---
function renderHistory() {
    const list = document.getElementById('history-list');
    const sorted = [...state.history].sort((a,b) => b.date - a.date);
    
    list.innerHTML = sorted.map(h => `
        <div class="flex justify-between items-center border-b border-gray-100 py-3">
            <div>
                <p class="font-medium text-sm text-kaspi-text">${h.name}</p>
                <p class="text-[10px] text-gray-400">${new Date(h.date).toLocaleString('ru-RU')}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-sm ${h.type === 'sale' ? 'text-green-500' : 'text-kaspi-text'}">
                    ${h.type === 'sale' ? '+' : '-'}${formatSum(h.amount)}
                </p>
                ${h.type === 'sale' ? `<p class="text-[10px] text-gray-400">Прибыль: ${formatSum(h.profit)}</p>` : ''}
            </div>
        </div>
    `).join('') || '<p class="text-gray-400 text-center text-sm py-4">История пуста</p>';
}

// --- ADMIN PANEL ---
function loginAdmin() {
    const pass = document.getElementById('admin-password').value;
    if (pass === ADMIN_PASS) {
        document.getElementById('admin-panel').classList.remove('hidden');
        document.getElementById('admin-password').value = '';
    } else {
        alert('Неверный пароль!');
    }
}

function activateSubscription() {
    const id = document.getElementById('admin-activate-id').value;
    if(id === state.clientId) {
        state.subscriptionActive = true;
        saveState();
        alert('Подписка активирована для этого устройства! Перезагрузите страницу.');
        location.reload();
    } else {
        alert('Можно симулировать активацию только для текущего ID (в данной архитектуре LocalStorage).');
    }
}

function resetAllData() {
    if(confirm('Вы уверены? ВСЕ данные будут удалены безвозвратно!')) {
        localStorage.removeItem('sellerBiState');
        location.reload();
    }
}

// Initialize App
init();