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
        if(dateInput) {
            const y = target.getFullYear();
            const m = String(target.getMonth() + 1).padStart(2, '0');
            const d = String(target.getDate()).padStart(2, '0');
            
            dateInput.value = `${y}-${m}-${d}`;
            const days = ['sun','mon','tue','wed','thu','fri','sat'];
            document.getElementById('targetDay').value = days[target.getDay()];
            Logic.updateDateUI();
        }
    };

    const State = {
        data: { version: 2, currentStore: "", currentCategory: "", stores: {} },
        load() {
            try {
                const rawV2 = localStorage.getItem('oms_unified_state_v2');
                if (rawV2) {
                    const parsedV2 = JSON.parse(rawV2);
                    if (parsedV2 && parsedV2.stores && Object.keys(parsedV2.stores).length > 0) {
                        this.data = parsedV2;
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
            } catch(e) { console.error("Load Error"); }
        },
        save() { try { localStorage.setItem('oms_unified_state_v2', JSON.stringify(this.data)); UI.showSaveIndicator(); } catch(e){} },
        ensureStore(storeName) {
            if (!storeName) return;
            if (!this.data.stores[storeName]) this.data.stores[storeName] = { prefecture: "230000", cityArea: "", categories: {}, events: [] };
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
            if(!this.data.stores[store].categories[cat].history) this.data.stores[store].categories[cat].history = {};
            
            const now = new Date();
            const proposalDateStr = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
            
            const existing = this.data.stores[store].categories[cat].history[targetDateStr];
            if (existing && typeof existing === 'object' && existing.isLearned) return; 

            this.data.stores[store].categories[cat].history[targetDateStr] = {
                pred: predQty, orderDate: proposalDateStr, isLearned: false, actual: ""        
            };
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
            this.renderList(); Logic.calculate(false, false);
        },
        remove(id) {
            const store = State.data.currentStore;
            if(!store) return;
            State.data.stores[store].events = State.data.stores[store].events.filter(e => e.id !== id);
            State.save();
            this.renderList(); Logic.calculate(false, false);
        },
        renderList() {
            const store = State.data.currentStore;
            const container = document.getElementById('eventListContainer');
            if(!store || !State.data.stores[store] || !State.data.stores[store].events || State.data.stores[store].events.length === 0) {
                container.innerHTML = '<div style="color:var(--text-sub); text-align:center;">登録されているイベントはありません</div>'; return;
            }
            let html = '';
            State.data.stores[store].events.forEach(e => {
                const catLabel = e.category === "ALL" ? "全分類" : e.category;
                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#f2f2f7; padding:12px; border-radius:8px; margin-bottom:8px;">
                        <div>
                            <strong style="color:var(--seven-red); margin-right:8px;">${e.date}</strong> 
                            <span style="font-weight: bold;">${e.name}</span> 
                            <span style="font-size: 0.8rem; margin-left: 4px;">(${catLabel})</span> 
                            <strong style="margin-left: 8px;">×${e.coeff.toFixed(1)}</strong>
                        </div>
                        <button onclick="Events.remove(${e.id})" style="background:none; border:none; font-size:1.4rem; cursor:pointer;">×</button>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
    };
    window.Events = Events;

    const TrendEngine = {
        getTrendCoeff(store, cat) {
            let coeff = 1.0; let msg = ""; let trendStatus = "NONE"; let diffPercent = 0;
            if (!["調理麺", "カップ麺", "スパゲティパスタ"].includes(cat)) return { coeff, msg, trendStatus, diffPercent };

            const history = State.data.stores[store]?.categories[cat]?.history;
            if (!history) return { coeff, msg, trendStatus, diffPercent };

            const dates = Object.keys(history).sort((a, b) => b.localeCompare(a));
            let recentActuals = []; let pastActuals = [];

            dates.forEach(d => {
                const h = history[d];
                if (h && typeof h === 'object' && h.isLearned && h.actual !== "") {
                    const act = parseFloat(h.actual);
                    if (!isNaN(act)) {
                        if (recentActuals.length < 5) recentActuals.push(act);
                        else if (pastActuals.length < 10) pastActuals.push(act);
                    }
                }
            });

            if (recentActuals.length >= 3 && pastActuals.length >= 5) {
                const recentAvg = recentActuals.reduce((a, b) => a + b, 0) / recentActuals.length;
                const pastAvg = pastActuals.reduce((a, b) => a + b, 0) / pastActuals.length;
                if (pastAvg > 0) {
                    const ratio = recentAvg / pastAvg;
                    diffPercent = Math.round((ratio - 1.0) * 100);
                    if (ratio > 1.1) {
                        coeff = Math.min(1.2, 1.0 + ((ratio - 1.0) * 0.5));
                        msg = `📈 上昇トレンド検知: 直近の嗜好高まりを補正 (×${coeff.toFixed(2)})`; trendStatus = "UP";
                    } else if (ratio < 0.9) {
                        coeff = Math.max(0.8, 1.0 - ((1.0 - ratio) * 0.5));
                        msg = `📉 下降トレンド検知: 食べ飽き・嗜好の変化を補正 (×${coeff.toFixed(2)})`; trendStatus = "DOWN";
                    }
                }
            }
            return { coeff, msg, trendStatus, diffPercent };
        }
    };

    const AIStatusDashboard = {
        render() {
            const store = State.data.currentStore; const cat = State.data.currentCategory;
            const container = document.getElementById('aiDashboardContainer');
            if (!container) return; // コンテナが存在しない場合は処理しない
            
            if (!store || !cat) {
                container.innerHTML = '';
                return;
            }

            const history = State.data.stores[store]?.categories[cat]?.history || {};
            let learnedCount = 0;
            Object.keys(history).forEach(dStr => {
                if (history[dStr] && history[dStr].isLearned) learnedCount++;
            });

            const REQUIRED_TARGET = 28;
            const progressPercent = Math.min(100, Math.round((learnedCount / REQUIRED_TARGET) * 100));
            const trendInfo = TrendEngine.getTrendCoeff(store, cat);
            
            let trendBadge = `<span style="color:#8e8e93; font-weight:bold;">➡️ 安定</span>`;
            if (trendInfo.trendStatus === "UP") trendBadge = `<span style="color:#d32f2f; font-weight:900;">📈 上昇傾向 (+${trendInfo.diffPercent}%)</span>`;
            else if (trendInfo.trendStatus === "DOWN") trendBadge = `<span style="color:#1976d2; font-weight:900;">📉 下降傾向 (${trendInfo.diffPercent}%)</span>`;

            const currentLearnedCoeff = State.data.stores[store]?.categories[cat]?.learnedCoeff || 1.0;

            container.innerHTML = `
                <div class="card" style="padding:16px; border: 2px solid var(--border); margin-bottom: 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                        <span style="font-weight:bold; font-size: 1.1rem;">🤖 AI分析情報 <span style="font-size:0.9rem; color:var(--text-sub);">[${cat}]</span></span>
                        <span style="font-weight:bold; color:var(--seven-green);">蓄積データ: ${learnedCount}件</span>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:4px;">
                            <span>最適化目標 (28件)</span>
                            <strong>${progressPercent}%</strong>
                        </div>
                        <div style="width:100%; background:#e5e5ea; height:12px; border-radius:6px; overflow:hidden;">
                            <div style="width:${progressPercent}%; background:var(--seven-red); height:100%;"></div>
                        </div>
                    </div>
                    <div class="grid-2" style="background: #f2f2f7; padding: 12px; border-radius: 8px;">
                        <div>
                            <div style="color:var(--text-sub); font-size:0.85rem; font-weight:bold;">トレンド判定</div>
                            <div style="margin-top:4px; font-size:1rem;">${trendBadge}</div>
                        </div>
                        <div>
                            <div style="color:var(--text-sub); font-size:0.85rem; font-weight:bold;">現在のAI学習補正</div>
                            <div style="margin-top:4px; font-weight:900; font-size:1.1rem;">× ${currentLearnedCoeff.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            `;
        }
    };
    window.AIStatusDashboard = AIStatusDashboard;

    const AIOptimizer = {
        checkAndRenderProposal() {
            const store = State.data.currentStore; const cat = State.data.currentCategory;
            const container = document.getElementById('aiProposalContainer');
            if (!container) return;

            if (!store || !cat) {
                container.style.display = 'none';
                return;
            }

            const history = State.data.stores[store]?.categories[cat]?.history || {};
            let learnedCount = 0; let daySums = {sun:[], mon:[], tue:[], wed:[], thu:[], fri:[], sat:[]};

            Object.keys(history).forEach(dStr => {
                const h = history[dStr];
                if (h && h.isLearned && h.actual !== "") {
                    learnedCount++;
                    const dObj = new Date(dStr);
                    const dayKey = ['sun','mon','tue','wed','thu','fri','sat'][dObj.getDay()];
                    const pred = parseFloat(h.pred); const act = parseFloat(h.actual);
                    if (!isNaN(pred) && !isNaN(act) && pred > 0) daySums[dayKey].push(act / pred);
                }
            });

            if (learnedCount >= 28) {
                let newRatios = {}; let hasDataForCalc = false;
                ['mon','tue','wed','thu','fri','sat','sun'].forEach(d => {
                    if (daySums[d].length > 0) {
                        const avgRatio = daySums[d].reduce((a,b)=>a+b,0) / daySums[d].length;
                        newRatios[d] = Math.max(0.5, Math.min(2.0, Math.round(avgRatio * 10) / 10));
                        hasDataForCalc = true;
                    }
                });

                if (hasDataForCalc) {
                    window._pendingAiRatios = newRatios;
                    container.innerHTML = `
                        <div class="card" style="background: #fff5e6; border: 2px solid var(--seven-red); margin-bottom: 0;">
                            <div style="font-weight:bold; font-size: 1.1rem; color: var(--seven-red); margin-bottom: 8px;">🧠 AI月間最適化の提案</div>
                            <div style="font-size: 0.95rem; margin-bottom: 16px;">約1ヶ月のデータに基づき、曜日の売上比率を自動調整しました。</div>
                            <button onclick="AIOptimizer.applyProposal()" class="btn btn-primary">曜日係数を一括更新する</button>
                        </div>
                    `;
                    container.style.display = 'block';
                    return;
                }
            }
            container.style.display = 'none';
        },
        applyProposal() {
            if (!window._pendingAiRatios) return;
            const r = window._pendingAiRatios;
            ['mon','tue','wed','thu','fri','sat','sun'].forEach(d => {
                const el = document.getElementById('ratio_' + d);
                if (el && r[d]) el.value = r[d].toFixed(1);
            });
            State.updateInputData(); Logic.calculate(false, false);
            alert("曜日比率が更新されました！");
            document.getElementById('aiProposalContainer').style.display = 'none';
        }
    };
    window.AIOptimizer = AIOptimizer;

    const ChartModule = {
        chart: null,
        render(history) {
            const canvas = document.getElementById('learningChart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dates = Object.keys(history).sort((a, b) => b.localeCompare(a));
            
            const labels = dates.map(d => `${new Date(d).getMonth()+1}/${new Date(d).getDate()}`);
            const predData = dates.map(d => typeof history[d] === 'object' ? history[d].pred : history[d]);

            if (this.chart) this.chart.destroy();
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '予測数', data: predData, borderColor: '#ee7200',
                        backgroundColor: 'rgba(238, 114, 0, 0.1)', borderWidth: 3, fill: true, tension: 0.3
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    };

    const UI = {
        init() {
            initializeDateAndTime(); this.renderStoreDatalist();
            if (State.data.currentCategory) {
                document.getElementById('categoryName').value = State.data.currentCategory;
                document.getElementById('learnCategorySelect').value = State.data.currentCategory;
                this.updateFreshnessDisplay(State.data.currentCategory);
                this.restoreCategoryInputs(); 
            }
            Weather.restoreStoreWeather();
            Events.renderList();
            this.setupEventListeners();
            AIStatusDashboard.render(); AIOptimizer.checkAndRenderProposal();
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
                        this.renderStoreDatalist(); this.restoreCategoryInputs(); Weather.restoreStoreWeather();
                    } else storeSelect.value = State.data.currentStore || "";
                } else {
                    State.data.currentStore = storeSelect.value; State.save();
                    this.restoreCategoryInputs(); Weather.restoreStoreWeather();
                }
                Events.renderList(); Logic.calculate(false, false);
                AIStatusDashboard.render(); AIOptimizer.checkAndRenderProposal();
            });

            document.getElementById('categoryName').addEventListener('change', () => this.onCategoryChange('simulator'));
            document.getElementById('learnCategorySelect').addEventListener('change', () => this.onCategoryChange('learning'));

            ['avgSales', 'currentStock', 'maxSales', 'minSales', 'avgWaste', 'avgShortageRate', 'minDisplayQty', 'categoryCoeff', 'popRate'].forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    el.addEventListener('input', () => { 
                        State.updateInputData(); 
                        if(id === 'popRate') Logic.calcWeatherCoeff();
                        Logic.calculate(false, false);
                    });
                    if(el.type === 'number') el.addEventListener('focus', function() { this.select(); });
                }
            });

            ['mon','tue','wed','thu','fri','sat','sun'].forEach(d => {
                const el = document.getElementById('ratio_' + d);
                if (el) el.addEventListener('change', () => { State.updateInputData(); Logic.calculate(false, false); });
            });

            document.getElementById('targetDateInput').addEventListener('change', (e) => {
                const d = new Date(e.target.value);
                if(!isNaN(d)) document.getElementById('targetDay').value = ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()]; 
                Logic.updateDateUI(); Weather.fetchWeather(); Logic.calculate(false, false);
            });
            
            ['targetDay', 'maxTemp', 'minTemp', 'customCoeff'].forEach(id => {
                document.getElementById(id).addEventListener('change', () => Logic.calculate(false, false));
            });

            document.getElementById('btn-weather-tmw').addEventListener('click', () => Weather.fetchWeather(1));
            document.getElementById('btn-weather-dat').addEventListener('click', () => Weather.fetchWeather(2));
            
            document.getElementById('prefecture').addEventListener('change', () => Weather.onPrefectureChange());
            document.getElementById('cityArea').addEventListener('change', () => { Weather.onCityAreaChange(); Weather.fetchWeather(); });

            document.getElementById('btn-calculate').addEventListener('click', () => {
                if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                Logic.calculate(false, true); 
                document.getElementById('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            document.getElementById('btn-add-event').addEventListener('click', () => Events.add());
            document.getElementById('btn-learn').addEventListener('click', () => Logic.executeLearning());
            document.getElementById('btn-reset-learning').addEventListener('click', () => Logic.resetLearning());
            document.getElementById('btn-refresh-all').addEventListener('click', () => Logic.calculateAll());
            document.getElementById('btn-share-image').addEventListener('click', () => Logic.shareScreenshot());
            document.getElementById('learnDateSelect').addEventListener('change', () => this.onChangeLearnDate());
            document.getElementById('btn-export').addEventListener('click', () => this.exportBackup());
            document.getElementById('btn-import').addEventListener('click', () => this.importBackup());

            document.getElementById('btn-force-update').addEventListener('click', async () => {
                try {
                    if ('serviceWorker' in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (let reg of regs) await reg.unregister();
                    }
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                    }
                    alert("アプリを更新します。"); window.location.reload(true);
                } catch (err) { alert("更新に失敗しました。"); }
            });
        },

        switchTab(tabId) {
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            document.querySelectorAll('.tab-content, .tab-button').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
            
            if (tabId === 'all') Logic.calculateAll();
            if (tabId === 'learning') {
                this.updateLearnHistoryUI();
                const store = State.data.currentStore; const cat = State.data.currentCategory;
                if (store && cat && State.data.stores[store]?.categories[cat]) {
                    ChartModule.render(State.data.stores[store].categories[cat].history || {});
                }
            }
            // タブ切り替え時にトップへスクロール
            window.scrollTo(0,0);
        },

        updateLearnHistoryUI() {
            const store = State.data.currentStore; const cat = State.data.currentCategory;
            const select = document.getElementById('learnDateSelect');
            if(!store || !cat || !select) return;
            
            const currentSelected = select.value; select.innerHTML = '';
            const history = State.data.stores[store]?.categories[cat]?.history || {};
            const dates = Object.keys(history).sort((a,b) => b.localeCompare(a));
            
            if(dates.length === 0) {
                select.appendChild(new Option("記録がありません", "manual"));
            } else {
                dates.forEach(d => {
                    let h = history[d]; let p = typeof h === 'object' ? h.pred : h;
                    let label = `${new Date(d).getMonth()+1}/${new Date(d).getDate()} (予測: ${p}個)`;
                    if (h.isLearned) label = `✅ [学習済] ${label}`;
                    select.appendChild(new Option(label, d));
                });
                select.appendChild(new Option("手動で入力する...", "manual"));
            }
            if (currentSelected && Array.from(select.options).some(o => o.value === currentSelected)) select.value = currentSelected;
            this.onChangeLearnDate();
        },

        onChangeLearnDate() {
            const store = State.data.currentStore; const cat = State.data.currentCategory;
            const select = document.getElementById('learnDateSelect');
            const pInput = document.getElementById('fbPredicted'); const aInput = document.getElementById('fbActual');
            if(!store || !cat || !select) return;
            
            if(select.value === 'manual') {
                pInput.readOnly = false; pInput.value = ""; aInput.value = "";
            } else {
                const h = State.data.stores[store].categories[cat].history[select.value];
                pInput.readOnly = true; pInput.value = h.pred || h;
                aInput.value = h.isLearned ? h.actual : "";
            }
        },

        onCategoryChange(source) {
            let cat = source === 'simulator' ? document.getElementById('categoryName').value : document.getElementById('learnCategorySelect').value;
            if (source === 'simulator') document.getElementById('learnCategorySelect').value = cat;
            else document.getElementById('categoryName').value = cat;
            
            if (cat === State.data.currentCategory) return;
            State.updateInputData(); State.data.currentCategory = cat; State.save();
            this.updateFreshnessDisplay(cat); this.restoreCategoryInputs(); 
            
            if (source === 'learning') {
                this.updateLearnHistoryUI();
                ChartModule.render(State.data.stores[State.data.currentStore]?.categories[cat]?.history || {});
            } else {
                Logic.calculate(false, false);
            }
            AIStatusDashboard.render(); AIOptimizer.checkAndRenderProposal();
        },

        renderStoreDatalist() {
            const select = document.getElementById('storeNameSelect');
            select.innerHTML = '<option value="" disabled>店舗を選択してください</option>';
            Object.keys(State.data.stores).filter(s => s.trim() !== "").forEach(s => {
                let opt = document.createElement('option'); opt.value = s; opt.text = s;
                if (s === State.data.currentStore) opt.selected = true;
                select.appendChild(opt);
            });
            select.appendChild(new Option('＋ 新規店舗を追加...', '__NEW__'));
            if (!State.data.currentStore) select.value = "";
        },

        updateFreshnessDisplay(cat) {
            const display = document.getElementById('freshnessDisplay'); const hiddenVal = document.getElementById('freshnessTime');
            const displayInputArea = document.getElementById('displayInputArea'); const stockLabel = document.getElementById('stockLabelText');
            
            if (stockLabel) {
                stockLabel.innerHTML = cat === "ロール" 
                    ? `現在庫 <span style="color: var(--seven-blue);">(1便納品前)</span>`
                    : `現在庫 <span style="color: var(--seven-red);">(2便納品前)</span>`;
            }

            switch(cat) {
                case "おにぎり": case "こだわりおにぎり": case "弁当": hiddenVal.value = "14"; display.value = "最適化ロジック (14H)"; displayInputArea.style.display = "block"; break;
                case "寿司": case "サンドイッチ": case "ロール": hiddenVal.value = "23"; display.value = "当日消化ロジック (23H)"; displayInputArea.style.display = "block"; break;
                case "調理麺": case "カップ麺": case "惣菜": case "サラダ": hiddenVal.value = "38"; display.value = "維持ロジック (38H)"; displayInputArea.style.display = "none"; break;
                case "チルド弁当": case "スパゲティパスタ": case "グラタンドリア": case "カップデリ": hiddenVal.value = "60"; display.value = "維持ロジック (60H)"; displayInputArea.style.display = "none"; break;
                default: hiddenVal.value = "0"; display.value = "分類を選択してください"; displayInputArea.style.display = "none";
            }
        },

        restoreCategoryInputs() {
            const store = State.data.currentStore; const cat = State.data.currentCategory;
            if (!store || !cat) return;
            
            let data = { avgSales: "50", currentStock: "15", maxSales: "65", minSales: "35", avgWaste: "3", avgShortageRate: "0", minDisplayQty: "0", categoryCoeff: "1.0", learnedCoeff: 1.0, ratios: {mon:"1.0", tue:"1.0", wed:"1.0", thu:"1.0", fri:"1.0", sat:"1.0", sun:"1.0"} };
            if (State.data.stores[store]?.categories[cat]) data = { ...data, ...State.data.stores[store].categories[cat] };

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

        showSaveIndicator() {},
        exportBackup() { document.getElementById('backupCode').value = btoa(unescape(encodeURIComponent(JSON.stringify(State.data)))); alert("コードを作成しました！"); },
        importBackup() {
            try {
                const parsed = JSON.parse(decodeURIComponent(escape(atob(document.getElementById('backupCode').value.trim()))));
                if (parsed && parsed.stores) { State.data = parsed; State.save(); this.init(); alert("データを復元しました！"); }
            } catch(e) { alert("コードが正しくありません。"); }
        }
    };
    window.UI = UI; 

    const Weather = {
        restoreStoreWeather() {
            const store = State.data.currentStore; if (!store || !State.data.stores[store]) return;
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
                if (!res.ok) throw new Error("API Error");
                const data = await res.json();
                const areaSelect = document.getElementById('cityArea'); areaSelect.innerHTML = '';
                (data[0].timeSeries[0].areas || []).forEach(a => {
                    areaSelect.appendChild(new Option(a.area.name, a.area.code));
                });
                if (targetCityCode) areaSelect.value = targetCityCode;
            } catch(e) { 
                document.getElementById('cityArea').innerHTML = '<option value="">取得失敗</option>';
            }
        },
        async fetchWeather(offsetOrEvent) {
            let tDateStr = document.getElementById('targetDateInput').value;
            let btn = null;
            if (typeof offsetOrEvent === 'number') {
                const now = new Date(); const target = new Date(now); target.setDate(now.getDate() + offsetOrEvent);
                tDateStr = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`;
                document.getElementById('targetDateInput').value = tDateStr;
                document.getElementById('targetDay').value = ['sun','mon','tue','wed','thu','fri','sat'][target.getDay()];
                Logic.updateDateUI();
                btn = offsetOrEvent === 1 ? document.getElementById('btn-weather-tmw') : document.getElementById('btn-weather-dat');
            }
            
            if (!tDateStr) return;
            
            const prefCode = document.getElementById('prefecture').value; 
            const areaCode = document.getElementById('cityArea').value;
            
            if (!prefCode || !areaCode) {
                if (typeof offsetOrEvent === 'number') {
                    alert("【エラー】\n天気を取得するには、画面上部の「エリア設定」で都道府県と地域を選択してください。");
                }
                return;
            }

            let originalText = "";
            if (btn) { originalText = btn.innerText; btn.innerText = "取得中..."; btn.disabled = true; }

            try {
                const res = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${prefCode}.json`);
                if (!res.ok) throw new Error("Network response was not ok");
                const data = await res.json();
                let minT = "", maxT = "", weatherText = "不明", pop = 0; let tempFound = false;

                for (let block of data) {
                    if (!block.timeSeries) continue;
                    for (let ts of block.timeSeries) {
                        let aData = ts.areas.find(a => a.area.code === areaCode) || ts.areas[0];
                        if (!aData) continue;
                        let idx = ts.timeDefines.findIndex(t => t.startsWith(tDateStr));
                        
                        if (idx !== -1 && aData.weathers && aData.weathers[idx] && weatherText === "不明") weatherText = aData.weathers[idx];
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
                    }
                }

                if (tempFound) {
                    if (minT) document.getElementById('minTemp').value = Math.round(parseFloat(minT));
                    if (maxT) document.getElementById('maxTemp').value = Math.round(parseFloat(maxT));
                }
                document.getElementById('popRate').value = pop;
                
                let icon = '⛅';
                if (/大雨|豪雨|暴風|大雪/.test(weatherText)) icon='🌧️';
                else if (/雨|雪/.test(weatherText)) icon='🌦️';
                else if (/晴|曇/.test(weatherText)) icon='☀️';

                const disp = document.getElementById('weather-display'); disp.style.display = 'block';
                disp.innerText = `${icon} ${weatherText.replace(/　/g, ' ').substring(0,15)} / 降水確率: ${pop}%`;
                Logic.calcWeatherCoeff(); Logic.calculate(false, false);
                
            } catch (e) { 
                console.error(e);
            } finally { 
                if (btn) { btn.innerText = originalText; btn.disabled = false; }
            }
        }
    };
    window.Weather = Weather; 

    const Logic = {
        calcWeatherCoeff() {
            const pop = parseFloat(document.getElementById('popRate').value) || 0;
            let coeff = 1.0;
            if (pop >= 80) coeff = 0.8; else if (pop >= 50) coeff = 0.9; else if (pop >= 30) coeff = 0.95;
            document.getElementById('weatherCoeff').value = coeff;
            document.getElementById('weatherCoeffDisplay').value = `× ${coeff}`;
        },
        updateDateUI() {
            const dateStr = document.getElementById('targetDateInput').value;
            const badge = document.getElementById('calendarBadge');
            const deadlineText = document.getElementById('orderDeadlineText');
            if(!dateStr) return;
            const dObj = new Date(dateStr);
            const orderObj = new Date(dObj); orderObj.setDate(orderObj.getDate() - 1); 
            deadlineText.innerText = `発注締切: ${orderObj.getMonth()+1}/${orderObj.getDate()} 午前11時`;
            const d = dObj.getDate();
            if (d === 15 || d === 25) { badge.innerText = `💰 年金/給料日 特需`; badge.style.display='inline-block'; }
            else if (d % 5 === 0 && d !== 31) { badge.innerText = `🚙 五十日(ごとおび)`; badge.style.display='inline-block'; }
            else badge.style.display='none';
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
            const currentMonth = new Date(dateStr || new Date()).getMonth() + 1; 
            
            if (catVal === "調理麺") {
                if (maxTemp >= 26) {
                    coeff = 1.0; fixed = (Math.min(35, Math.floor(maxTemp)) - 26) * 3;
                    if (currentMonth >= 10 || currentMonth <= 4) fixed = Math.round(fixed * 0.5); 
                } else if (maxTemp >= 20) coeff = 1.0 + ((maxTemp - 20) * 0.02);
                else if (maxTemp < 10 && (currentMonth < 11 && currentMonth > 2)) coeff = 1.0 - 0.10 - ((10 - maxTemp) * 0.04);
            } else if (["サラダ", "カップデリ"].includes(catVal)) {
                if (maxTemp > 25) coeff = 1.0 + ((maxTemp - 25) * 0.03);
            } else if (["カップ麺", "グラタンドリア", "チルド弁当"].includes(catVal)) {
                if (minTemp < 10) coeff = 1.0 + ((10 - minTemp) * 0.03);
                if (maxTemp > 25) coeff -= ((maxTemp - 25) * 0.02);
            }
            return { coeff: Math.max(0.3, Math.min(2.5, coeff)), fixedBoost: fixed, message: msg };
        },
        getEventCoeff(dateStr, catVal, store) {
            let coeff = 1.0; let msgs = [];
            if(State.data.stores[store]?.events) {
                State.data.stores[store].events.forEach(e => {
                    if(e.date === dateStr && (e.category === "ALL" || e.category === catVal)) {
                        coeff *= e.coeff; msgs.push(`🎁 イベント: ${e.name}`);
                    }
                });
            }
            return { coeff, msg: msgs.join(" / ") };
        },
        resetLearning() {
            const store = document.getElementById('storeNameSelect').value; const cat = State.data.currentCategory;
            if (!store || store === "__NEW__" || !cat) return;
            if (!confirm(`【${cat}】のAI学習データをリセットしますか？`)) return;
            if (State.data.stores[store]?.categories[cat]) {
                State.data.stores[store].categories[cat].learnedCoeff = 1.0;
                State.data.stores[store].categories[cat].history = {}; State.save();
                document.getElementById('currentLearnedCoeffText').innerText = "1.00";
                ChartModule.render({}); UI.updateLearnHistoryUI(); UI.restoreCategoryInputs(); this.calculate(false, false);
                AIStatusDashboard.render(); AIOptimizer.checkAndRenderProposal();
            }
        },
        executeLearning() {
            const actStr = document.getElementById('fbActual').value.trim();
            const pred = parseFloat(document.getElementById('fbPredicted').value);
            const store = document.getElementById('storeNameSelect').value; const cat = State.data.currentCategory;
            const targetDateStr = document.getElementById('learnDateSelect').value;
            if (!store || store === "__NEW__" || !cat) return;

            if (targetDateStr !== 'manual' && actStr === "") {
                 const histItem = State.data.stores[store].categories[cat].history[targetDateStr];
                 if (histItem?.isLearned && confirm("学習を解除しますか？")) {
                     histItem.isLearned = false; histItem.actual = "";
                     this.recalcCoeff(store, cat); State.save();
                     document.getElementById('currentLearnedCoeffText').innerText = State.data.stores[store].categories[cat].learnedCoeff.toFixed(2);
                     this.calculate(false, false); ChartModule.render(State.data.stores[store].categories[cat].history || {});
                     UI.updateLearnHistoryUI(); AIStatusDashboard.render(); AIOptimizer.checkAndRenderProposal();
                     return;
                 }
                 return;
            }

            const act = parseFloat(actStr);
            if (isNaN(act) || !pred || pred <= 0) return alert("予測数と実際の販売数を入力してください。");

            if (targetDateStr !== 'manual') {
                const histItem = State.data.stores[store].categories[cat].history[targetDateStr];
                if (typeof histItem === 'object') { histItem.isLearned = true; histItem.actual = act; }
                else State.data.stores[store].categories[cat].history[targetDateStr] = { pred: histItem, actual: act, isLearned: true };
                this.recalcCoeff(store, cat);
            } else {
                let currentL = State.data.stores[store].categories[cat].learnedCoeff || 1.0;
                State.data.stores[store].categories[cat].learnedCoeff = Math.max(0.8, Math.min(1.2, currentL + (((act/pred) - 1.0) * 0.3)));
            }
            State.save();
            document.getElementById('currentLearnedCoeffText').innerText = State.data.stores[store].categories[cat].learnedCoeff.toFixed(2);
            document.getElementById('learnSuccessMsg').style.display = 'block'; setTimeout(() => document.getElementById('learnSuccessMsg').style.display='none', 3000);
            this.calculate(false, false); ChartModule.render(State.data.stores[store].categories[cat].history || {});
            UI.onChangeLearnDate(); UI.updateLearnHistoryUI(); AIStatusDashboard.render(); AIOptimizer.checkAndRenderProposal();
        },
        recalcCoeff(store, cat) {
            let coeff = 1.0; const history = State.data.stores[store].categories[cat].history || {};
            Object.values(history).forEach(h => {
                if (h?.isLearned) {
                    const act = parseFloat(h.actual); const pred = parseFloat(h.pred);
                    if (!isNaN(act) && pred > 0) coeff = Math.max(0.8, Math.min(1.2, coeff + (((act/pred) - 1.0) * 0.3)));
                }
            });
            State.data.stores[store].categories[cat].learnedCoeff = coeff;
        },
        calculate(silent = false, saveHist = false) {
            const store = document.getElementById('storeNameSelect').value; 
            const cat = document.getElementById('categoryName').value;
            const fHours = parseFloat(document.getElementById('freshnessTime').value);
            const dateStr = document.getElementById('targetDateInput').value;
            
            if (!store || store === "__NEW__" || !cat || fHours === 0) { document.getElementById('resultArea').style.display = 'none'; return false; }

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
            
            let learnedCount = 0;
            if (State.data.stores[store]?.categories[cat]?.history) {
                Object.values(State.data.stores[store].categories[cat].history).forEach(h => { if (h?.isLearned) learnedCount++; });
            }
            
            const baseLearnR = State.data.stores[store]?.categories[cat]?.learnedCoeff || 1.0;
            const learnR = (learnedCount >= 7) ? baseLearnR : 1.0;
            const evInfo = this.getEventCoeff(dateStr, cat, store);
            const trendInfo = TrendEngine.getTrendCoeff(store, cat);

            let shortR = 1.0, diffShort = 0;
            if (shortage > 20) { shortR = 1.03 + ((shortage-20)*0.004); diffShort = shortage-20; }
            else if (shortage > 5) { shortR = 1.0 + (shortage*0.002); diffShort = shortage*0.5; }
            else if (shortage > 0) { shortR = 1.01; diffShort = shortage; }
            
            const tInfo = this.getTempCoeff(dateStr, cat, maxT, minT);
            const maxS = parseFloat(document.getElementById('maxSales').value) || 0;
            const minS = parseFloat(document.getElementById('minSales').value) || 0;
            const stdDev = (Math.max(maxS, minS) - Math.min(maxS, minS)) / 4 * shortR;
            
            let multiplier = dayR * weathR * calR * customR * catR * tInfo.coeff * learnR * evInfo.coeff * trendInfo.coeff;
            let finalDemandRaw = (avgSales * shortR * multiplier) + tInfo.fixedBoost;
            
            let safetyFactor = fHours <= 14 ? 0.84 : (fHours <= 24 ? 1.28 : 1.645);
            if (learnedCount >= 7) safetyFactor *= 0.7; 

            const extraDays = fHours===60 ? 0.5 : (fHours===38 ? 0.2 : 0);
            const safetyStock = safetyFactor * stdDev * Math.sqrt(1 + extraDays);
            const appliedBuffer = Math.max(minQty, (finalDemandRaw * extraDays) + safetyStock);
            
            let rawOrder = Math.max(0, Math.ceil((finalDemandRaw + appliedBuffer) - currentStock));
            let finalOrder = Math.max(0, Math.ceil(rawOrder - (waste * Math.max(0.2, 1 - (diffShort/10)))));
            
            if (fHours > 24) {
                let limit = Math.max(0, Math.floor((finalDemandRaw * (fHours/24)) - currentStock));
                if (finalOrder > limit) finalOrder = limit;
            }

            if(!silent) this.renderUI(cat, finalDemandRaw, finalOrder, dayR, weathR, tInfo, evInfo, trendInfo, learnedCount, learnR);
            if(saveHist) State.saveHistory(dateStr, Math.ceil(finalDemandRaw));
            return { cat: cat, pred: Math.ceil(finalDemandRaw), order: finalOrder };
        },

        renderUI(cat, predRaw, order, day, weather, temp, evInfo, trendInfo, learnedCount, learn) {
            document.getElementById('resCategory').innerText = cat;
            document.getElementById('resDayRatio').innerText = day.toFixed(2);
            document.getElementById('resMultipliers').innerText = `[天候${weather.toFixed(2)} / 気温${temp.coeff.toFixed(2)} / 学習${learn.toFixed(2)}]`;
            
            const evMsgEl = document.getElementById('resEventMessage');
            if (evInfo.msg) { evMsgEl.innerText = evInfo.msg; evMsgEl.style.display = 'block'; } else evMsgEl.style.display = 'none';
            
            const learnMsgEl = document.getElementById('resLearningMessage');
            if (learnedCount >= 7 && learn !== 1.0) { learnMsgEl.innerText = `🧠 AI学習補正 (×${learn.toFixed(2)}) 適用`; learnMsgEl.style.display = 'block'; }
            else { learnMsgEl.style.display = 'none'; }

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
            const originalCategory = State.data.currentCategory;
            let results = [];
            cats.forEach(c => {
                document.getElementById('categoryName').value = c; UI.onCategoryChange('simulator');
                let res = this.calculate(true, true); if(res) results.push(res);
            });
            if (originalCategory) { document.getElementById('categoryName').value = originalCategory; UI.onCategoryChange('simulator'); }

            const container = document.getElementById('allResultsContainer');
            let html = `<div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 16px;">${store}</div>`;
            results.forEach(r => {
                html += `
                    <div style="background:#f2f2f7; padding:16px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-weight:bold; font-size:1.1rem;">${r.cat}</div>
                        <div style="text-align:right;">
                            <div style="font-size:0.9rem; color:var(--text-sub);">予測: ${r.pred}</div>
                            <div style="font-size:1.4rem; font-weight:bold; color:var(--seven-red);">発注: ${r.order} <span style="font-size:0.9rem;">個</span></div>
                        </div>
                    </div>`;
            });
            container.innerHTML = html;
        },
        async shareScreenshot() {
            const target = document.getElementById('screenshotTargetArea');
            if (!target) return;
            document.getElementById('btn-share-image').innerText = "生成中...";
            try {
                const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff" });
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], `発注目安.png`, { type: "image/png" });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
                    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "発注目安.png"; a.click(); }
                    document.getElementById('btn-share-image').innerText = "画像を保存・共有する";
                }, "image/png");
            } catch (err) { alert("失敗しました"); }
        }
    };

    State.load(); UI.init();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
    }
});
