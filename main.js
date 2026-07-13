document.addEventListener("DOMContentLoaded", () => {
    
    const prefs = {
        "016000":"北海道(札幌周辺)","011000":"北海道(宗谷)","012000":"北海道(上川・留萌)","013000":"北海道(網走・北見・紋別)","014100":"北海道(十勝)","014030":"北海道(釧路・根室)","015000":"北海道(胆振・日高)","017000":"北海道(渡島・檜山)",
        "020000":"青森県","030000":"岩手県","040000":"宮城県","050000":"秋田県",
        "060000":"山形県","070000":"福島県","080000":"茨城県","090000":"栃木県","100000":"群馬県",
        "110000":"埼玉県","120000":"千葉県","130000":"東京都","140000":"神奈川県","150000":"新潟県",
        "160000":"富山県","170000":"石川県","180000":"福井県","190000":"山梨県","200000":"長野県",
        "210000":"岐阜県","220000":"静岡県","230000":"愛知県","240000":"三重県","250000":"滋賀県",
        "260000":"京都府","270000":"大阪府","280000":"兵庫県","290000":"奈良県","300000":"和歌山県",
        "310000":"鳥取県","320000":"島根県","330000":"岡山県","340000":"広島県","350000":"山口県",
        "360000":"徳島県","370000":"香川県","380000":"愛媛県","390000":"高知県","400000":"福岡県",
        "410000":"佐賀県","420000":"長崎県","430000":"熊本県","440000":"大分県","450000":"宮崎県",
        "460100":"鹿児島県","460040":"鹿児島県(奄美)","471000":"沖縄県(本島)","472000":"沖縄県(石垣)","473000":"沖縄県(宮古)","474000":"沖縄県(大東島)"
    };

    const prefSelect = document.getElementById('prefecture');
    if(prefSelect) {
        prefSelect.innerHTML = '<option value="">-- 都道府県 --</option>';
        Object.keys(prefs).forEach(k => { prefSelect.appendChild(new Option(prefs[k], k)); });
    }

    const daysArr = ['mon','tue','wed','thu','fri','sat','sun'];
    const daysLabel = ['月','火','水','木','金','土','日'];
    const drContainer = document.getElementById('dayRatioBoxes');
    if(drContainer) {
        drContainer.innerHTML = '';
        daysArr.forEach((d, i) => {
            let html = `<div class="day-ratio-box ${d==='sat'?'day-sat':(d==='sun'?'day-sun':'')}"><label>${daysLabel[i]}</label><select id="ratio_${d}">`;
            for(let v=0.5; v<=2.0; v+=0.1) html += `<option value="${v.toFixed(1)}"${v.toFixed(1)==='1.0'?' selected':''}>${v.toFixed(1)}</option>`;
            html += `</select></div>`;
            drContainer.innerHTML += html;
        });
    }

    const getWeekDayStr = (dateObj) => {
        return ['日','月','火','水','木','金','土'][dateObj.getDay()];
    };

    const initializeDateAndTime = () => {
        const now = new Date();
        const target = new Date(now);
        const offset = (now.getHours() >= 11) ? 2 : 1;
        target.setDate(now.getDate() + offset);
        
        const dateInput = document.getElementById('targetDateInput');
        if(dateInput && !dateInput.value) {
            dateInput.value = target.toISOString().split('T')[0];
            const days = ['sun','mon','tue','wed','thu','fri','sat'];
            document.getElementById('targetDay').value = days[target.getDay()];
            Logic.updateDateUI();
        }
    };

    const State = {
        data: { version: 2, currentStore: "", currentCategory: "", stores: {} },
        load() {
            try {
                const rawV1 = localStorage.getItem('oms_unified_state_v1');
                const rawV2 = localStorage.getItem('oms_unified_state_v2');
                let v2HasData = false;
                if (rawV2) {
                    const parsedV2 = JSON.parse(rawV2);
                    if (parsedV2 && parsedV2.stores && Object.keys(parsedV2.stores).length > 0) {
                        v2HasData = true; this.data = parsedV2;
                    }
                }
                if (!v2HasData && rawV1) {
                    const parsedV1 = JSON.parse(rawV1);
                    if (parsedV1 && parsedV1.stores && Object.keys(parsedV1.stores).length > 0) {
                        this.data = parsedV1; this.data.version = 2; 
                    }
                }
                
                if (this.data && this.data.stores) {
                    Object.keys(this.data.stores).forEach(s => {
                        if (!this.data.stores[s].events) this.data.stores[s].events = [];
                        if (this.data.stores[s].categories) {
                            Object.keys(this.data.stores[s].categories).forEach(c => {
                                let cat = this.data.stores[s].categories[c];
                                if (typeof cat.learnedCoeff === 'undefined') cat.learnedCoeff = 1.0;
                                if (typeof cat.categoryCoeff === 'undefined') cat.categoryCoeff = "1.0";
                                if (typeof cat.history === 'undefined') cat.history = {};
                            });
                        }
                    });
                }
                
                if (this.data && this.data.stores && !this.data.shiftedDatesV3) {
                    Object.keys(this.data.stores).forEach(s => {
                        if (this.data.stores[s].categories) {
                            Object.keys(this.data.stores[s].categories).forEach(c => {
                                let cat = this.data.stores[s].categories[c];
                                if (cat.history) {
                                    let newHistory = {};
                                    Object.keys(cat.history).forEach(dateStr => {
                                        let oldDate = new Date(dateStr);
                                        if (!isNaN(oldDate)) {
                                            oldDate.setDate(oldDate.getDate() + 1);
                                            let newDateStr = oldDate.getFullYear() + "-" + String(oldDate.getMonth()+1).padStart(2, '0') + "-" + String(oldDate.getDate()).padStart(2, '0');
                                            newHistory[newDateStr] = cat.history[dateStr];
                                        }
                                    });
                                    cat.history = newHistory;
                                }
                            });
                        }
                    });
                    this.data.shiftedDatesV3 = true; 
                }

                this.save();
            } catch(e) { console.error("Load Error"); }
        },
        save() { try { localStorage.setItem('oms_unified_state_v2', JSON.stringify(this.data)); UI.showSaveIndicator(); } catch(e){} },
        ensureStore(storeName) {
            if (!storeName) return;
            if (!this.data.stores[storeName]) this.data.stores[storeName] = { prefecture: "230000", cityArea: "", categories: {}, events: [] };
            if (!this.data.stores[storeName].events) this.data.stores[storeName].events = [];
        },
        updateInputData() {
            const store = this.data.currentStore; const cat = this.data.currentCategory;
            if (!store || !cat) return;
            this.ensureStore(store);
            if (!this.data.stores[store].categories) this.data.stores[store].categories = {};
            
            const existingCat = this.data.stores[store].categories[cat] || {};
            const existingLearned = existingCat.learnedCoeff ? existingCat.learnedCoeff : 1.0;
            const existingHistory = existingCat.history || {};

            this.data.stores[store].categories[cat] = {
                avgSales: document.getElementById('avgSales').value,
                currentStock: document.getElementById('currentStock').value,
                maxSales: document.getElementById('maxSales').value,
                minSales: document.getElementById('minSales').value,
                avgWaste: document.getElementById('avgWaste').value,
                avgShortageRate: document.getElementById('avgShortageRate').value,
                minDisplayQty: document.getElementById('minDisplayQty').value,
                categoryCoeff: document.getElementById('categoryCoeff').value,
                learnedCoeff: existingLearned, 
                history: existingHistory,
                ratios: {
                    mon: document.getElementById('ratio_mon').value, tue: document.getElementById('ratio_tue').value,
                    wed: document.getElementById('ratio_wed').value, thu: document.getElementById('ratio_thu').value,
                    fri: document.getElementById('ratio_fri').value, sat: document.getElementById('ratio_sat').value,
                    sun: document.getElementById('ratio_sun').value
                }
            };
            this.save();
        },
        saveHistory(targetDateStr, predQty) {
            if(!targetDateStr || isNaN(predQty)) return;
            const store = this.data.currentStore; const cat = this.data.currentCategory;
            if (!store || !cat) return;
            this.ensureStore(store);
            if(!this.data.stores[store].categories[cat]) return;
            if(!this.data.stores[store].categories[cat].history) this.data.stores[store].categories[cat].history = {};
            
            const now = new Date();
            const proposalDateStr = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
            
            const existing = this.data.stores[store].categories[cat].history[targetDateStr];
            if (existing && typeof existing === 'object' && existing.isLearned) {
                return; 
            }

            this.data.stores[store].categories[cat].history[targetDateStr] = {
                pred: predQty,
                orderDate: proposalDateStr,
                isLearned: false, 
                actual: ""        
            };
            
            // 保存件数を14日分に拡張
            const keys = Object.keys(this.data.stores[store].categories[cat].history).sort((a,b) => b.localeCompare(a));
            if (keys.length > 14) {
                keys.slice(14).forEach(k => delete this.data.stores[store].categories[cat].history[k]);
            }
            this.save();
        }
    };

    const Events = {
        add() {
            const store = State.data.currentStore;
            if(!store || store === "__NEW__") return alert("店舗を選択してください");
            
            const date = document.getElementById('evDate').value;
            const name = document.getElementById('evName').value.trim();
            const cat = document.getElementById('evCategory').value;
            const coeff = parseFloat(document.getElementById('evCoeff').value);
            
            if(!date || !name || isNaN(coeff)) return alert("日付、名前、倍率をすべて入力してください");
            
            State.ensureStore(store);
            State.data.stores[store].events.push({ id: Date.now(), date, name, category: cat, coeff });
            State.save();
            
            document.getElementById('evName').value = "";
            this.renderList();
            Logic.calculate(false, false);
        },
        remove(id) {
            const store = State.data.currentStore;
            if(!store) return;
            State.data.stores[store].events = State.data.stores[store].events.filter(e => e.id !== id);
            State.save();
            this.renderList();
            Logic.calculate(false, false);
        },
        renderList() {
            const store = State.data.currentStore;
            const container = document.getElementById('eventListContainer');
            if(!store || !State.data.stores[store] || !State.data.stores[store].events || State.data.stores[store].events.length === 0) {
                container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding: 10px;">登録されているイベントはありません</div>';
                return;
            }
            
            let html = '';
            const sorted = [...State.data.stores[store].events].sort((a,b) => a.date.localeCompare(b.date));
            
            sorted.forEach(e => {
                const d = new Date(e.date);
                const dStr = isNaN(d) ? e.date : `${d.getMonth()+1}/${d.getDate()}`;
                const catLabel = e.category === "ALL" ? "全分類" : e.category;
                
                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); padding:10px 12px; border-radius:8px; margin-bottom:8px; font-size:0.9rem; border-left: 4px solid var(--seven-red); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div>
                            <strong style="color:var(--seven-red); margin-right:8px;">${dStr}</strong> 
                            <span style="font-weight: bold; color: var(--text);">${e.name}</span> 
                            <span style="color:var(--text-muted); font-size: 0.8rem; margin-left: 4px;">(${catLabel})</span> 
                            <strong style="color:var(--primary-dark); margin-left: 8px;">×${e.coeff.toFixed(1)}</strong>
                        </div>
                        <button onclick="Events.remove(${e.id})" style="background:none; border:none; color:var(--text-muted); font-size:1.4rem; cursor:pointer; padding: 0 8px;">×</button>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    };
    window.Events = Events;

    const ChartModule = {
        chart: null,
        render(history) {
            const canvas = document.getElementById('learningChart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dates = Object.keys(history).sort((a, b) => a.localeCompare(b));
            
            const labels = dates.map(d => {
                const targetDate = new Date(d);
                const salesStr = `${targetDate.getMonth()+1}/${targetDate.getDate()}(${getWeekDayStr(targetDate)})`;
                
                const orderDate = new Date(targetDate);
                orderDate.setDate(orderDate.getDate() - 1);
                const orderStr = `${orderDate.getMonth()+1}/${orderDate.getDate()}(${getWeekDayStr(orderDate)})`;
                
                let histItem = history[d];
                let propDateStr = typeof histItem === 'object' ? histItem.orderDate : null;
                let propStr = "";
                if (propDateStr) {
                    const pDate = new Date(propDateStr);
                    propStr = `${pDate.getMonth()+1}/${pDate.getDate()}(${getWeekDayStr(pDate)})`;
                } else {
                    const pDate = new Date(targetDate);
                    pDate.setDate(pDate.getDate() - 2); 
                    propStr = `${pDate.getMonth()+1}/${pDate.getDate()}(${getWeekDayStr(pDate)})`;
                }
                return [`提案:${propStr}`, `発注:${orderStr}〆`, `販売:${salesStr}`];
            });
            
            const predData = dates.map(d => {
                let val = history[d];
                return typeof val === 'object' ? val.pred : val;
            });

            if (this.chart) this.chart.destroy();
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '予測数',
                        data: predData,
                        borderColor: '#ee7200',
                        backgroundColor: 'rgba(238, 114, 0, 0.1)',
                        borderWidth: 2,
                        pointBackgroundColor: '#ee7200',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: false, ticks: { color: '#888' } },
                        x: { ticks: { color: '#888', font: { size: 9 }, maxRotation: 0 } }
                    },
                    plugins: { legend: { labels: { color: '#888' } } }
                }
            });
        }
    };

    const UI = {
        init() {
            initializeDateAndTime();
            this.renderStoreDatalist();
            if (State.data.currentCategory) {
                document.getElementById('categoryName').value = State.data.currentCategory;
                document.getElementById('learnCategorySelect').value = State.data.currentCategory;
                this.updateFreshnessDisplay(State.data.currentCategory);
                this.restoreCategoryInputs(); 
            }
            Weather.restoreStoreWeather();
            Events.renderList();
            this.setupEventListeners();

            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
            if (!isStandalone) {
                const prompt = document.getElementById('pwaPrompt');
                if (prompt && !localStorage.getItem('pwaPromptDismissed')) {
                    prompt.style.display = 'flex';
                    document.getElementById('pwaClose').addEventListener('click', () => {
                        prompt.style.display = 'none';
                        localStorage.setItem('pwaPromptDismissed', 'true');
                    });
                }
            }
        },

        setupEventListeners() {
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
            });

            const storeSelect = document.getElementById('storeNameSelect');
            storeSelect.addEventListener('change', () => {
                if (storeSelect.value === '__NEW__') {
                    const newStore = prompt("新しい店舗名を入力してください");
                    if (newStore && newStore.trim() !== "") {
                        State.data.currentStore = newStore.trim(); State.ensureStore(State.data.currentStore); State.save();
                        this.renderStoreDatalist(); this.restoreCategoryInputs(); Weather.restoreStoreWeather(); Events.renderList(); Logic.calculate(false, false);
                    } else {
                        storeSelect.value = State.data.currentStore || "";
                    }
                } else {
                    State.data.currentStore = storeSelect.value; State.save();
                    this.restoreCategoryInputs(); Weather.restoreStoreWeather(); Events.renderList(); Logic.calculate(false, false);
                }
            });

            document.getElementById('categoryName').addEventListener('change', () => this.onCategoryChange('simulator'));
            document.getElementById('learnCategorySelect').addEventListener('change', () => this.onCategoryChange('learning'));

            const inputs = ['avgSales', 'currentStock', 'maxSales', 'minSales', 'avgWaste', 'avgShortageRate', 'minDisplayQty', 'categoryCoeff', 'popRate'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    el.addEventListener('input', (e) => { 
                        State.updateInputData(); 
                        if(id === 'popRate') Logic.calcWeatherCoeff();
                        Logic.calculate(false, false);
                    });
                    if(el.type === 'number') el.addEventListener('focus', function() { this.select(); });
                }
            });

            document.getElementById('targetDateInput').addEventListener('input', (e) => {
                const d = new Date(e.target.value);
                if(!isNaN(d)) { document.getElementById('targetDay').value = ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()]; }
                Logic.updateDateUI(); Logic.calculate(false, false);
            });
            document.getElementById('targetDay').addEventListener('change', () => Logic.calculate(false, false));
            document.getElementById('maxTemp').addEventListener('input', () => Logic.calculate(false, false));
            document.getElementById('minTemp').addEventListener('input', () => Logic.calculate(false, false));
            document.getElementById('customCoeff').addEventListener('change', () => Logic.calculate(false, false));
            
            document.getElementById('prefecture').addEventListener('change', () => Weather.onPrefectureChange());
            document.getElementById('cityArea').addEventListener('change', () => { Weather.onCityAreaChange(); Weather.fetchWeather(1); });

            document.getElementById('btn-calculate').addEventListener('click', () => {
                if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                Logic.calculate(false, true); 
                setTimeout(() => document.getElementById('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
            });

            document.getElementById('btn-add-event').addEventListener('click', () => Events.add());
            document.getElementById('btn-learn').addEventListener('click', () => Logic.executeLearning());
            
            const btnResetLearning = document.getElementById('btn-reset-learning');
            if (btnResetLearning) {
                btnResetLearning.addEventListener('click', () => Logic.resetLearning());
            }

            document.getElementById('btn-refresh-all').addEventListener('click', () => Logic.calculateAll());
            
            const btnShare = document.getElementById('btn-share-image');
            if (btnShare) {
                btnShare.addEventListener('click', () => { Logic.shareScreenshot(); });
            }

            document.getElementById('learnDateSelect').addEventListener('change', () => this.onChangeLearnDate());
            document.getElementById('btn-export').addEventListener('click', () => this.exportBackup());
            document.getElementById('btn-import').addEventListener('click', () => this.importBackup());

            const btnForceUpdate = document.getElementById('btn-force-update');
            if (btnForceUpdate) {
                btnForceUpdate.addEventListener('click', async () => {
                    const originalText = btnForceUpdate.innerText;
                    btnForceUpdate.innerText = "更新中...";
                    btnForceUpdate.disabled = true;

                    try {
                        if ('serviceWorker' in navigator) {
                            const registrations = await navigator.serviceWorker.getRegistrations();
                            for (let registration of registrations) {
                                await registration.unregister();
                            }
                        }
                        if ('caches' in window) {
                            const cacheNames = await caches.keys();
                            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
                        }
                        alert("アプリを最新の状態に更新します。");
                        window.location.reload(true);
                    } catch (err) {
                        console.error("更新エラー:", err);
                        alert("更新に失敗しました。少し時間をおいて再度お試しください。");
                        btnForceUpdate.innerText = originalText;
                        btnForceUpdate.disabled = false;
                    }
                });
            }
        },

        switchTab(tabId) {
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            document.getElementById('tabContainer').setAttribute('data-active-tab', tabId);
            document.querySelectorAll('.tab-content, .tab-button').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
            
            if (tabId === 'all') Logic.calculateAll();
            if (tabId === 'learning') {
                this.updateLearnHistoryUI();
                
                const store = State.data.currentStore;
                const cat = State.data.currentCategory;
                if (store && cat && State.data.stores[store] && State.data.stores[store].categories[cat]) {
                    ChartModule.render(State.data.stores[store].categories[cat].history || {});
                }
            }
        },

        updateLearnHistoryUI() {
            const store = State.data.currentStore; const cat = State.data.currentCategory;
            const select = document.getElementById('learnDateSelect');
            if(!store || !cat || !select) return;
            
            const currentSelectedDate = select.value;
            
            select.innerHTML = '';
            const history = (State.data.stores[store].categories && State.data.stores[store].categories[cat] && State.data.stores[store].categories[cat].history) ? State.data.stores[store].categories[cat].history : {};
            const dates = Object.keys(history).sort((a,b) => b.localeCompare(a));
            
            if(dates.length === 0) {
                select.appendChild(new Option("記録がありません (手動入力)", "manual"));
            } else {
                dates.forEach(d => {
                    const targetDate = new Date(d);
                    const salesStr = `${targetDate.getMonth()+1}/${targetDate.getDate()}(${getWeekDayStr(targetDate)})`;
                    
                    const orderDate = new Date(targetDate);
                    orderDate.setDate(orderDate.getDate() - 1);
                    const orderStr = `${orderDate.getMonth()+1}/${orderDate.getDate()}(${getWeekDayStr(orderDate)})`;
                    
                    let histItem = history[d];
                    let predVal = typeof histItem === 'object' ? histItem.pred : histItem;
                    let propDateStr = typeof histItem === 'object' ? histItem.orderDate : null;
                    let isLearned = typeof histItem === 'object' ? histItem.isLearned : false;
                    
                    let propStr = "";
                    if(propDateStr) {
                        const pDate = new Date(propDateStr);
                        propStr = `${pDate.getMonth()+1}/${pDate.getDate()}(${getWeekDayStr(pDate)})`;
                    } else {
                        const pDate = new Date(targetDate);
                        pDate.setDate(pDate.getDate() - 2);
                        propStr = `${pDate.getMonth()+1}/${pDate.getDate()}(${getWeekDayStr(pDate)})`;
                    }
                    
                    let label = `【販売日】${salesStr} (提案:${propStr} ⇒ 発注:${orderStr}〆 / 予測: ${predVal}個)`;
                    
                    if (isLearned) {
                        label = `✅ [学習済] ${label}`;
                    }
                    
                    select.appendChild(new Option(label, d));
                });
                select.appendChild(new Option("手動で過去の日付・予測を入力する...", "manual"));
            }
            
            if (currentSelectedDate && Array.from(select.options).some(opt => opt.value === currentSelectedDate)) {
                select.value = currentSelectedDate;
            }
            
            this.onChangeLearnDate();
        },

        onChangeLearnDate() {
            const store = State.data.currentStore; const cat = State.data.currentCategory;
            const select = document.getElementById('learnDateSelect');
            const predInput = document.getElementById('fbPredicted');
            const actInput = document.getElementById('fbActual');
            const btnLearn = document.getElementById('btn-learn');
            if(!store || !cat || !select || !predInput || !actInput || !btnLearn) return;
            
            if(select.value === 'manual') {
                predInput.readOnly = false;
                predInput.style.backgroundColor = "#fafafa";
                predInput.value = "";
                predInput.placeholder = "手動入力";
                
                actInput.value = ""; 
                actInput.readOnly = false;
                actInput.style.backgroundColor = "#fff";
                actInput.style.color = "#000";
                
                btnLearn.disabled = false;
                btnLearn.innerText = "AIに学習させる";
                btnLearn.style.background = "var(--seven-red)";
            } else {
                const history = State.data.stores[store].categories[cat].history || {};
                const histItem = history[select.value];
                const predVal = typeof histItem === 'object' ? histItem.pred : histItem;
                const isLearned = typeof histItem === 'object' ? histItem.isLearned : false;
                const actualVal = typeof histItem === 'object' ? histItem.actual : "";
                
                predInput.readOnly = true;
                predInput.style.backgroundColor = "var(--border)";
                predInput.value = predVal || "";

                if (isLearned) {
                    actInput.value = actualVal;
                    actInput.readOnly = true;
                    actInput.style.backgroundColor = "var(--border)";
                    actInput.style.color = "#555";
                    
                    btnLearn.disabled = true;
                    btnLearn.innerText = "学習済み (重複防止ロック中)";
                    btnLearn.style.background = "#999";
                } else {
                    actInput.value = ""; 
                    actInput.readOnly = false;
                    actInput.style.backgroundColor = "#fff";
                    actInput.style.color = "#000";
                    
                    btnLearn.disabled = false;
                    btnLearn.innerText = "AIに学習させる";
                    btnLearn.style.background = "var(--seven-red)";
                }
            }
        },

        onCategoryChange(source) {
            let cat = "";
            if (source === 'simulator') {
                cat = document.getElementById('categoryName').value;
                const learnSelect = document.getElementById('learnCategorySelect');
                if (learnSelect) learnSelect.value = cat;
            } else {
                cat = document.getElementById('learnCategorySelect').value;
                document.getElementById('categoryName').value = cat;
            }
            
            if (cat === State.data.currentCategory) return;
            State.updateInputData(); State.data.currentCategory = cat; State.save();
            this.updateFreshnessDisplay(cat); this.restoreCategoryInputs(); 
            
            if (source === 'learning') {
                this.updateLearnHistoryUI();
                const store = State.data.currentStore;
                if (store && State.data.stores[store] && State.data.stores[store].categories[cat]) {
                    ChartModule.render(State.data.stores[store].categories[cat].history || {});
                }
            } else {
                Logic.calculate(false, false);
            }
        },

        renderStoreDatalist() {
            const select = document.getElementById('storeNameSelect');
            select.innerHTML = '<option value="" disabled>店舗を選択してください</option>';
            Object.keys(State.data.stores).filter(s => s.trim() !== "").forEach(s => {
                let opt = document.createElement('option'); opt.value = s; opt.text = s;
                if (s === State.data.currentStore) opt.selected = true;
                select.appendChild(opt);
            });
            let optNew = document.createElement('option'); optNew.value = '__NEW__'; optNew.text = '＋ 新規店舗を追加...';
            select.appendChild(optNew);
            if (!State.data.currentStore) select.value = "";
        },

        updateFreshnessDisplay(cat) {
            const display = document.getElementById('freshnessDisplay'); const hiddenVal = document.getElementById('freshnessTime');
            const displayInputArea = document.getElementById('displayInputArea'); const stockLabel = document.getElementById('stockLabelText');
            const stockInput = document.getElementById('currentStock');
            
            if (stockLabel) {
                if (cat === "ロール") {
                    stockLabel.innerHTML = `現在庫 <span style="background: rgba(0,161,233,0.1); color: var(--seven-blue); padding: 4px 8px; border-radius: 6px; font-weight: 900; font-size: 0.95rem;">(1便納品前)</span>`;
                    stockInput.style.borderColor = "var(--seven-blue)";
                } else {
                    stockLabel.innerHTML = `現在庫 <span style="background: rgba(238,114,0,0.1); color: var(--seven-red); padding: 4px 8px; border-radius: 6px; font-weight: 900; font-size: 0.95rem;">(2便納品前)</span>`;
                    stockInput.style.borderColor = "var(--seven-red)";
                }
            }

            switch(cat) {
                case "おにぎり": case "こだわりおにぎり": case "弁当": hiddenVal.value = "14"; display.value = "最適化ロジック (14H)"; displayInputArea.style.display = "flex"; break;
                case "寿司": case "サンドイッチ": case "ロール": hiddenVal.value = "23"; display.value = "当日消化ロジック (23H)"; displayInputArea.style.display = "flex"; break;
                case "調理麺": case "カップ麺": case "惣菜": case "サラダ": hiddenVal.value = "38"; display.value = "維持ロジック (38H)"; displayInputArea.style.display = "none"; break;
                case "チルド弁当": case "スパゲティパスタ": case "グラタンドリア": case "カップデリ": hiddenVal.value = "60"; display.value = "維持ロジック (60H)"; displayInputArea.style.display = "none"; break;
                default: hiddenVal.value = "0"; display.value = "分類を選択してください"; displayInputArea.style.display = "none";
            }
        },

        restoreCategoryInputs() {
            const store = State.data.currentStore; const cat = State.data.currentCategory;
            if (!store || !cat) return;
            
            let data = { avgSales: "50", currentStock: "15", maxSales: "65", minSales: "35", avgWaste: "3", avgShortageRate: "0", minDisplayQty: "0", categoryCoeff: "1.0", learnedCoeff: 1.0, ratios: {mon:"1.0", tue:"1.0", wed:"1.0", thu:"1.0", fri:"1.0", sat:"1.0", sun:"1.0"} };
            if (State.data.stores[store] && State.data.stores[store].categories && State.data.stores[store].categories[cat]) {
                data = { ...data, ...State.data.stores[store].categories[cat] };
            }

            ['avgSales', 'currentStock', 'maxSales', 'minSales', 'avgWaste', 'avgShortageRate', 'minDisplayQty'].forEach(id => {
                if(document.getElementById(id)) document.getElementById(id).value = data[id] || "";
            });
            
            if (document.getElementById('categoryCoeff')) document.getElementById('categoryCoeff').value = parseFloat(data.categoryCoeff).toFixed(1) || "1.0";
            if (document.getElementById('currentLearnedCoeffText')) document.getElementById('currentLearnedCoeffText').innerText = parseFloat(data.learnedCoeff).toFixed(2);

            Object.keys(data.ratios || {}).forEach(d => {
                let el = document.getElementById('ratio_' + d);
                if (el) el.value = parseFloat(data.ratios[d] || 1.0).toFixed(1);
            });
            Logic.updateDateUI();
        },

        showSaveIndicator() { const ind = document.getElementById('saveIndicator'); if(ind) { ind.innerText = "✓ 保存済"; setTimeout(() => ind.innerText = "", 2000); } },
        exportBackup() { document.getElementById('backupCode').value = btoa(unescape(encodeURIComponent(JSON.stringify(State.data)))); alert("コードを作成しました！これをコピーして引き継ぎ先の端末で貼り付けてください。"); },
        importBackup() {
            try {
                const parsed = JSON.parse(decodeURIComponent(escape(atob(document.getElementById('backupCode').value.trim()))));
                if (parsed && parsed.stores) { State.data = parsed; State.save(); this.init(); alert("データの復元に成功しました！"); }
            } catch(e) { alert("コードが正しくありません。"); }
        }
    };
    window.UI = UI; 

    const Weather = {
        restoreStoreWeather() {
            const store = State.data.currentStore; if (!store) return; State.ensureStore(store);
            const pref = State.data.stores[store].prefecture; const city = State.data.stores[store].cityArea;
            document.getElementById('prefecture').value = pref;
            if (pref) this.fetchAreaList(pref, city);
        },
        onPrefectureChange() {
            const pref = document.getElementById('prefecture').value; const store = State.data.currentStore;
            if (!store) return; State.data.stores[store].prefecture = pref; State.data.stores[store].cityArea = ""; State.save();
            if (pref) this.fetchAreaList(pref, null);
        },
        onCityAreaChange() {
            const store = State.data.currentStore; if(!store) return;
            State.data.stores[store].cityArea = document.getElementById('cityArea').value; State.save();
        },
        async fetchAreaList(prefCode, targetCityCode) {
            try {
                const res = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${prefCode}.json`);
                if (!res.ok) throw new Error("気象庁データの取得に失敗しました");
                const data = await res.json();
                const areaSelect = document.getElementById('cityArea'); areaSelect.innerHTML = '';
                (data[0].timeSeries[0].areas || []).forEach(a => {
                    let opt = document.createElement('option'); opt.value = a.area.code; opt.text = a.area.name; areaSelect.appendChild(opt);
                });
                if (targetCityCode) areaSelect.value = targetCityCode;
            } catch(e) { 
                console.error("Area Error:", e);
                const areaSelect = document.getElementById('cityArea');
                areaSelect.innerHTML = '<option value="">エリア取得失敗 (都道府県を選び直してください)</option>';
            }
        },

        async fetchWeather(offset) {
            const now = new Date();
            const target = new Date(now);
            target.setDate(now.getDate() + offset);
            
            const tDateStr = target.toISOString().split('T')[0];
            document.getElementById('targetDateInput').value = tDateStr;
            const days = ['sun','mon','tue','wed','thu','fri','sat'];
            document.getElementById('targetDay').value = days[target.getDay()];
            Logic.updateDateUI();
            
            const prefCode = document.getElementById('prefecture').value; 
            const areaCode = document.getElementById('cityArea').value;
            if (!prefCode || !areaCode) return alert("エリアを選択してください");

            const btn = offset === 1 ? document.getElementById('btn-weather-tmw') : document.getElementById('btn-weather-dat');
            const originalText = btn.innerText; 
            btn.innerText = "取得中..."; 
            btn.disabled = true;

            try {
                const res = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${prefCode}.json`);
                if (!res.ok) throw new Error("天気データ取得失敗");
                const data = await res.json();

                let minT = "", maxT = "", weatherText = "不明", pop = 0;
                let tempFound = false;

                for (let block of data) {
                    if (!block.timeSeries) continue;
                    for (let ts of block.timeSeries) {
                        let aData = ts.areas.find(a => a.area.code === areaCode) || ts.areas[0];
                        if (!aData) continue;

                        let idx = ts.timeDefines.findIndex(t => t.startsWith(tDateStr));
                        
                        if (idx !== -1 && aData.weathers && aData.weathers[idx] && weatherText === "不明") {
                            weatherText = aData.weathers[idx];
                        }

                        if (aData.pops) {
                            ts.timeDefines.forEach((t, i) => {
                                if (t.startsWith(tDateStr) && aData.pops[i]) {
                                    let p = parseInt(aData.pops[i].replace('%',''));
                                    if (!isNaN(p) && p > pop) pop = p;
                                }
                            });
                        }

                        if (idx !== -1) {
                            if (aData.tempsMax && aData.tempsMax[idx]) { maxT = aData.tempsMax[idx]; tempFound = true; }
                            if (aData.tempsMin && aData.tempsMin[idx]) { minT = aData.tempsMin[idx]; tempFound = true; }
                        }

                        if (aData.temps && !tempFound) {
                            let dayTemps = [];
                            ts.timeDefines.forEach((t, i) => {
                                if (t.startsWith(tDateStr) && aData.temps[i]) {
                                    dayTemps.push(parseFloat(aData.temps[i]));
                                }
                            });
                            if (dayTemps.length > 0) {
                                maxT = Math.max(...dayTemps).toString();
                                minT = Math.min(...dayTemps).toString();
                                if (maxT === minT) minT = (parseFloat(maxT) - 8).toString();
                                tempFound = true;
                            }
                        }
                    }
                }

                if (tempFound) {
                    if (minT) document.getElementById('minTemp').value = Math.round(parseFloat(minT));
                    if (maxT) document.getElementById('maxTemp').value = Math.round(parseFloat(maxT));
                } else {
                    alert(`【お知らせ】\n気象庁から対象日（${tDateStr}）の予測気温データがまだ配信されていません。\n恐れ入りますが、気温欄は手動でご入力ください。`);
                }
                
                document.getElementById('popRate').value = pop;
                
                let icon = '⛅';
                if (/大雨|豪雨|暴風|大雪/.test(weatherText)) icon='🌧️';
                else if (/雨|雪/.test(weatherText)) icon='🌦️';
                else if (/晴|曇/.test(weatherText)) icon='☀️';

                const disp = document.getElementById('weather-display'); disp.style.display = 'block';
                disp.innerText = `${icon} ${weatherText.replace(/　/g, ' ').substring(0,15)} / 降水確率: ${pop}%`;
                
                Logic.calcWeatherCoeff(); 
                Logic.calculate(false, false);
                
            } catch (e) { 
                console.error(e);
                alert("気象庁サーバーからの取得に失敗しました。"); 
            } 
            finally { 
                btn.innerText = originalText; 
                btn.disabled = false; 
            }
        }
    };
    window.Weather = Weather; 

    const Logic = {
        calcWeatherCoeff() {
            const pop = parseFloat(document.getElementById('popRate').value) || 0;
            let coeff = 1.0;
            if (pop >= 80) coeff = 0.8;
            else if (pop >= 50) coeff = 0.9;
            else if (pop >= 30) coeff = 0.95;
            document.getElementById('weatherCoeff').value = coeff;
            document.getElementById('weatherCoeffDisplay').value = `× ${coeff}`;
        },

        updateDateUI() {
            const dateStr = document.getElementById('targetDateInput').value;
            const badge = document.getElementById('calendarBadge');
            const deadlineText = document.getElementById('orderDeadlineText');
            
            if(!dateStr) { 
                badge.style.display='none'; 
                deadlineText.innerText = ''; 
                return; 
            }
            
            const dObj = new Date(dateStr);
            const orderObj = new Date(dObj);
            orderObj.setDate(orderObj.getDate() - 1); 
            deadlineText.innerText = `※この販売分の発注締切: ${orderObj.getMonth()+1}/${orderObj.getDate()}(${getWeekDayStr(orderObj)}) 午前11時`;

            const d = dObj.getDate();
            if (d === 15 || d === 25) { badge.innerText = `💰 年金/給料日 特需`; badge.style.display='block'; }
            else if (d % 5 === 0 && d !== 31) { badge.innerText = `🚙 五十日(ごとおび) 活発`; badge.style.display='block'; }
            else { badge.style.display='none'; }
        },

        getCalendarCoeff(dateStr) {
            if(!dateStr) return 1.0;
            const d = new Date(dateStr).getDate();
            if (d === 15 || d === 25) return 1.05; 
            if (d % 5 === 0 && d !== 31) return 1.03; 
            return 1.0;
        },

        getTempCoeff(dateStr, catVal, maxTemp, minTemp) {
            let coeff = 1.0, fixed = 0, msg = "";
            const targetDate = dateStr ? new Date(dateStr) : new Date();
            const currentMonth = targetDate.getMonth() + 1; 
            const currentDate = targetDate.getDate();
            
            if (catVal === "調理麺") {
                if (maxTemp >= 26) {
                    coeff = 1.0;
                    const effectiveTemp = Math.min(35, Math.floor(maxTemp));
                    fixed = (effectiveTemp - 26) * 3;
                    
                    if ((currentMonth === 8 && currentDate >= 16) || currentMonth === 9) {
                        fixed = Math.round(fixed * 0.8); 
                        msg = `☀️ お盆以降の食べ飽き考慮（最大35度頭打ち基準 / 補正：＋${fixed}個）`;
                    } else if (currentMonth >= 10 || currentMonth <= 4) {
                        fixed = Math.round(fixed * 0.5); 
                        msg = `🍂 涼期・春期トレンド（最大35度頭打ち基準 / 補正：＋${fixed}個）`;
                    } else {
                        msg = `🔥 夏の冷し麺特需ブースト（最大35度頭打ち基準 / 補正：＋${fixed}個）`;
                    }
                } else if (maxTemp >= 20) {
                    coeff = 1.0 + ((maxTemp - 20) * 0.02);
                    msg = "🌤 20℃超え。調理麺が動き出します";
                } else if (maxTemp < 10) {
                    if (currentMonth >= 11 || currentMonth <= 2) {
                        coeff = 1.0; 
                        msg = `❄️ 冬期のレンジ温麺需要（気温低下による一律のマイナス補正を停止）`;
                    } else {
                        coeff = 1.0 - 0.10 - ((10 - maxTemp) * 0.04);
                        msg = "❄️ 気温低下。冷やし麺は売れにくいです";
                    }
                }
            } else if (["サラダ", "カップデリ"].includes(catVal)) {
                if (maxTemp > 25) coeff = 1.0 + ((maxTemp - 25) * 0.03);
            } else if (["カップ麺", "グラタンドリア", "チルド弁当"].includes(catVal)) {
                if (minTemp < 10) coeff = 1.0 + ((10 - minTemp) * 0.03);
                if (maxTemp > 25) coeff -= ((maxTemp - 25) * 0.02);
            }
            return { coeff: Math.max(0.3, Math.min(2.5, coeff)), fixedBoost: fixed, message: msg };
        },

        getEventCoeff(dateStr, catVal, store) {
            let coeff = 1.0; 
            let msgs = [];
            if(!store || !State.data.stores[store] || !State.data.stores[store].events) return { coeff, msg: "" };
            
            State.data.stores[store].events.forEach(e => {
                if(e.date === dateStr && (e.category === "ALL" || e.category === catVal)) {
                    coeff *= e.coeff;
                    msgs.push(`🎁 イベント適用: ${e.name} (×${e.coeff.toFixed(1)})`);
                }
            });
            return { coeff, msg: msgs.join(" / ") };
        },

        resetLearning() {
            const storeSelect = document.getElementById('storeNameSelect');
            const store = storeSelect.value;
            const cat = State.data.currentCategory;

            if (!store || store === "__NEW__" || !cat) return alert("店舗と分類を選択してください。");
            
            if (!confirm(`【${cat}】のAI学習データ（過去の履歴と現在の補正値）をすべてリセットし、初期状態（1.00倍）に戻しますか？\n※この操作は元に戻せません。`)) return;

            if (State.data.stores[store] && State.data.stores[store].categories[cat]) {
                State.data.stores[store].categories[cat].learnedCoeff = 1.0;
                State.data.stores[store].categories[cat].history = {};
                State.save();
                
                alert(`【${cat}】の学習データをリセットしました。`);
                
                document.getElementById('currentLearnedCoeffText').innerText = "1.00";
                ChartModule.render({});
                UI.updateLearnHistoryUI();
                UI.restoreCategoryInputs();
                this.calculate(false, false);
            }
        },

        executeLearning() {
            const act = parseFloat(document.getElementById('fbActual').value);
            const pred = parseFloat(document.getElementById('fbPredicted').value);
            if (!act || !pred || pred <= 0) return alert("予測数と実際の販売数を正しく入力してください。");
            
            const storeSelect = document.getElementById('storeNameSelect');
            const store = storeSelect.value;
            const cat = State.data.currentCategory;
            const select = document.getElementById('learnDateSelect');
            const targetDateStr = select.value;

            if (!store || store === "__NEW__" || !cat) return;
            
            let currentL = State.data.stores[store].categories[cat].learnedCoeff || 1.0;
            
            if (targetDateStr !== 'manual') {
                 const histItem = State.data.stores[store].categories[cat].history[targetDateStr];
                 if (histItem && typeof histItem === 'object' && histItem.isLearned) {
                     return alert("この日付のデータは既に学習済みです。二重に補正がかかるのを防ぐためロックされています。");
                 }
            }

            let ratio = act / pred;
            let newL = currentL + ((ratio - 1.0) * 0.3);
            newL = Math.max(0.8, Math.min(1.2, newL)); 
            
            State.data.stores[store].categories[cat].learnedCoeff = newL;
            
            if (targetDateStr !== 'manual') {
                if (typeof State.data.stores[store].categories[cat].history[targetDateStr] === 'object') {
                    State.data.stores[store].categories[cat].history[targetDateStr].isLearned = true;
                    State.data.stores[store].categories[cat].history[targetDateStr].actual = act;
                } else {
                    let oldPred = State.data.stores[store].categories[cat].history[targetDateStr];
                    State.data.stores[store].categories[cat].history[targetDateStr] = {
                        pred: oldPred,
                        actual: act,
                        isLearned: true
                    };
                }
            }

            State.save();
            
            document.getElementById('currentLearnedCoeffText').innerText = newL.toFixed(2);
            const msg = document.getElementById('learnSuccessMsg');
            msg.style.display = 'block'; setTimeout(() => msg.style.display='none', 3000);
            
            this.calculate(false, false);
            ChartModule.render(State.data.stores[store].categories[cat].history || {});
            
            UI.onChangeLearnDate();
            UI.updateLearnHistoryUI();
        },

        calculate(silent = false, saveHist = false) {
            const storeSelect = document.getElementById('storeNameSelect');
            const store = storeSelect.value; 
            const cat = document.getElementById('categoryName').value;
            const fHours = parseFloat(document.getElementById('freshnessTime').value);
            const dateStr = document.getElementById('targetDateInput').value;
            
            if (!store || store === "__NEW__" || !cat || fHours === 0) {
                document.getElementById('resultArea').style.display = 'none';
                return false;
            }

            const avgSales = parseFloat(document.getElementById('avgSales').value) || 0;
            const currentStock = parseInt(document.getElementById('currentStock').value) || 0;
            const minQty = (fHours<=24) ? (parseFloat(document.getElementById('minDisplayQty').value) || 0) : 0;
            const waste = parseFloat(document.getElementById('avgWaste').value) || 0;
            const shortage = Math.min(parseFloat(document.getElementById('avgShortageRate').value) || 0, 90);
            
            const dayR = parseFloat(document.getElementById('ratio_' + document.getElementById('targetDay').value).value) || 1.0;
            const weathR = parseFloat(document.getElementById('weatherCoeff').value) || 1.0;
            const calR = this.getCalendarCoeff(dateStr);
            const customR = parseFloat(document.getElementById('customCoeff').value) || 1.0;
            const catR = parseFloat(document.getElementById('categoryCoeff').value) || 1.0;
            const maxT = parseFloat(document.getElementById('maxTemp').value) || 25;
            const minT = parseFloat(document.getElementById('minTemp').value) || 15;
            
            // ★追加: 学習データの蓄積回数をカウント
            let learnedCount = 0;
            if (State.data.stores[store] && State.data.stores[store].categories[cat] && State.data.stores[store].categories[cat].history) {
                const hist = State.data.stores[store].categories[cat].history;
                Object.keys(hist).forEach(k => {
                    if (hist[k] && typeof hist[k] === 'object' && hist[k].isLearned) learnedCount++;
                });
            }
            
            const baseLearnR = (State.data.stores[store] && State.data.stores[store].categories[cat]) ? (State.data.stores[store].categories[cat].learnedCoeff || 1.0) : 1.0;
            
            // ★7回（1週間分）のデータが揃うまでは補正を適用しない（1.0倍）
            const REQUIRED_LEARN_COUNT = 7;
            const learnR = (learnedCount >= REQUIRED_LEARN_COUNT) ? baseLearnR : 1.0;
            
            const evInfo = this.getEventCoeff(dateStr, cat, store);
            const eventR = evInfo.coeff;

            let baseDemand = avgSales;

            let shortR = 1.0, diffShort = 0;
            if (shortage > 20) { shortR = 1.03 + ((shortage-20)*0.004); diffShort = shortage-20; }
            else if (shortage > 5) { shortR = 1.0 + (shortage*0.002); diffShort = shortage*0.5; }
            else if (shortage > 0) { shortR = 1.01; diffShort = shortage; }
            
            const tInfo = this.getTempCoeff(dateStr, cat, maxT, minT);
            
            const maxS = parseFloat(document.getElementById('maxSales').value) || 0;
            const minS = parseFloat(document.getElementById('minSales').value) || 0;
            const stdDev = (Math.max(maxS, minS) - Math.min(maxS, minS)) / 4 * shortR;
            
            let multiplier = dayR * weathR * calR * customR * catR * tInfo.coeff * learnR * eventR;
            let finalDemandRaw = (baseDemand * shortR * multiplier) + tInfo.fixedBoost;
            
            const extraDays = fHours===60 ? 0.5 : (fHours===38 ? 0.2 : 0);
            const safetyStock = 1.645 * stdDev * Math.sqrt(1 + extraDays);
            const sysBuffer = (finalDemandRaw * extraDays) + safetyStock;
            const appliedBuffer = Math.max(minQty, sysBuffer);
            
            let rawOrder = Math.max(0, Math.ceil((finalDemandRaw + appliedBuffer) - currentStock));
            const wasteReduct = waste * Math.max(0, 1 - (diffShort/10));
            let finalOrder = Math.max(0, Math.ceil(rawOrder - wasteReduct));
            
            if (fHours > 24) {
                let limit = Math.max(0, Math.floor((finalDemandRaw * (fHours/24)) - currentStock));
                if (finalOrder > limit) finalOrder = limit;
            }

            if(!silent) this.renderUI(cat, finalDemandRaw, finalOrder, avgSales, shortR, dayR, weathR, calR, customR, catR, learnR, tInfo, evInfo, learnedCount, baseLearnR);
            
            if(saveHist) {
                State.saveHistory(dateStr, Math.ceil(finalDemandRaw));
            }

            return { cat: cat, pred: Math.ceil(finalDemandRaw), order: finalOrder };
        },

        renderUI(cat, predRaw, order, base, shortR, day, weather, cal, custom, catR, learn, temp, evInfo, learnedCount, baseLearnR) {
            document.getElementById('resCategory').innerText = cat;
            document.getElementById('resBaseSales').innerText = base.toFixed(1);
            document.getElementById('resShortageBoost').innerText = shortR > 1.0 ? `(×欠品補正 ${shortR.toFixed(2)})` : '';
            
            document.getElementById('resDayRatio').innerText = day.toFixed(2);
            let multStr = `[天候${weather.toFixed(2)} / 気温${temp.coeff.toFixed(2)} / 学習${learn.toFixed(2)} / 独自${custom.toFixed(2)} / 分類${catR.toFixed(2)}]`;
            document.getElementById('resMultipliers').innerText = multStr;
            
            const evMsgEl = document.getElementById('resEventMessage');
            if (evInfo.msg) {
                evMsgEl.innerText = evInfo.msg;
                evMsgEl.style.display = 'block';
            } else {
                evMsgEl.style.display = 'none';
            }
            
            let learnMsg = "";
            const REQUIRED_LEARN_COUNT = 7;
            if (learnedCount >= REQUIRED_LEARN_COUNT) {
                if (learn !== 1.0) learnMsg = `🧠 店舗独自のAI学習補正 (×${learn.toFixed(2)}) 適用中`;
            } else {
                if (learnedCount > 0) {
                    learnMsg = `⏳ AI学習データ蓄積中 (${learnedCount}/${REQUIRED_LEARN_COUNT}回) ※7回到達で補正開始`;
                }
            }
            
            const learnMsgEl = document.getElementById('resLearningMessage');
            if (learnMsg) {
                learnMsgEl.innerText = learnMsg;
                learnMsgEl.style.display = 'block';
                if (learnedCount >= REQUIRED_LEARN_COUNT) {
                    learnMsgEl.style.color = 'var(--seven-green-dark)';
                } else {
                    learnMsgEl.style.color = '#ee7200';
                }
            } else {
                learnMsgEl.style.display = 'none';
            }

            document.getElementById('resTempMessage').innerText = temp.message;
            document.getElementById('resAdjSales').innerText = Math.ceil(predRaw);
            document.getElementById('resOrderQty').innerText = order;
            
            document.getElementById('stickyAdjSales').innerText = Math.ceil(predRaw);
            document.getElementById('stickyOrderQty').innerText = order;
            
            document.getElementById('resultArea').style.display = 'block';
            document.getElementById('stickyResultBar').classList.add('show');
        },
        
        calculateAll() {
            const store = State.data.currentStore; if(!store || !State.data.stores[store]) return;
            const cats = Object.keys(State.data.stores[store].categories);
            const dateStr = document.getElementById('targetDateInput').value;
            const dateObj = new Date(dateStr);
            const formattedDate = !isNaN(dateObj) ? `${dateObj.getMonth()+1}月${dateObj.getDate()}日` : "未定";

            let results = [];
            cats.forEach(c => {
                document.getElementById('categoryName').value = c;
                UI.onCategoryChange('simulator');
                let res = this.calculate(true, true);
                if(res) results.push(res);
            });

            const container = document.getElementById('allResultsContainer');
            
            let html = `
                <div class="screenshot-header">
                    <div style="font-size: 1.2rem; font-weight: 900; color: var(--primary-dark); margin-bottom: 4px;">${store}</div>
                    <div style="font-size: 0.95rem; font-weight: bold; color: var(--seven-green-dark);">📅 発注対象日: ${formattedDate}</div>
                </div>
            `;
            
            results.forEach(r => {
                html += `
                    <div class="screenshot-item" onclick="document.getElementById('categoryName').value='${r.cat}'; UI.onCategoryChange('simulator'); UI.switchTab('simulator'); window.scrollTo(0,0);">
                        <div class="screenshot-cat">${r.cat}</div>
                        <div class="screenshot-data" style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                            <div style="font-size: 0.85rem; color: #666;">販売予測数: <span style="font-weight: bold; color: #333; font-size: 1rem;">${r.pred}</span></div>
                            <div style="font-size: 0.95rem; font-weight: 800; color: var(--seven-green-dark);">発注目安数: <span style="font-size: 1.6rem; font-weight: 900;">${r.order}</span> <span style="font-size:0.85rem; font-weight:normal;">個</span></div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        },

        async shareScreenshot() {
            const target = document.getElementById('screenshotTargetArea');
            if (!target || typeof html2canvas === 'undefined') {
                return alert("画像生成ツールがまだ読み込まれていません。少し待ってから再度お試しください。");
            }

            const btn = document.getElementById('btn-share-image');
            const originalText = btn.innerText;
            btn.innerText = "⏳ 画像生成中...";
            btn.disabled = true;

            try {
                const canvas = await html2canvas(target, {
                    scale: 2, 
                    useCORS: true, 
                    backgroundColor: "#ffffff"
                });

                canvas.toBlob(async (blob) => {
                    if (!blob) throw new Error("画像データの作成に失敗しました");
                    
                    const dateStr = document.getElementById('targetDateInput').value || "未定";
                    const fileName = `発注目安_${dateStr}.png`;
                    const file = new File([blob], fileName, { type: "image/png" });
                    
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                title: '本日の発注目安',
                                files: [file]
                            });
                        } catch (shareErr) {
                            console.log("シェアがキャンセルされました", shareErr);
                        }
                    } else {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileName;
                        a.click();
                        URL.revokeObjectURL(url);
                    }
                    
                    btn.innerText = originalText;
                    btn.disabled = false;
                }, "image/png");

            } catch (err) {
                console.error("Screenshot error:", err);
                alert("画像の生成に失敗しました。");
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }
    };

    State.load(); UI.init();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('PWA登録成功！', reg.scope))
                .catch(err => console.log('PWA登録失敗:', err));
        });
    }
});
