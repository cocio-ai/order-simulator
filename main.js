document.addEventListener("DOMContentLoaded", () => {
    
    // --- 状態管理 ---
    const State = {
        data: {
            version: 1, 
            currentStore: "", 
            currentCategory: "",
            stores: {} 
        },

        load() {
            try {
                const raw = localStorage.getItem('oms_unified_state_v1');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && parsed.stores) this.data = parsed;
                }
            } catch(e) { console.error("データ読み込みエラー", e); }
        },

        save() {
            try { 
                localStorage.setItem('oms_unified_state_v1', JSON.stringify(this.data));
                UI.showSaveIndicator();
            } catch(e) {
                UI.showSaveError();
            }
        },

        ensureStore(storeName) {
            if (!storeName) return;
            if (!this.data.stores[storeName]) {
                this.data.stores[storeName] = { prefecture: "", cityArea: "", categories: {} };
            }
        },

        updateInputData() {
            const store = this.data.currentStore;
            const cat = this.data.currentCategory;
            if (!store || !cat) return;
            
            this.ensureStore(store);
            if (!this.data.stores[store].categories) this.data.stores[store].categories = {};
            
            this.data.stores[store].categories[cat] = {
                avgSales: document.getElementById('avgSales').value,
                currentStock: document.getElementById('currentStock').value,
                maxSales: document.getElementById('maxSales').value,
                minSales: document.getElementById('minSales').value,
                avgWaste: document.getElementById('avgWaste').value,
                avgShortageRate: document.getElementById('avgShortageRate').value,
                minDisplayQty: document.getElementById('minDisplayQty').value,
                ratios: {
                    mon: document.getElementById('ratio_mon').value,
                    tue: document.getElementById('ratio_tue').value,
                    wed: document.getElementById('ratio_wed').value,
                    thu: document.getElementById('ratio_thu').value,
                    fri: document.getElementById('ratio_fri').value,
                    sat: document.getElementById('ratio_sat').value,
                    sun: document.getElementById('ratio_sun').value
                }
            };
            this.save();
        }
    };

    // --- UI制御 ---
    const UI = {
        init() {
            if (State.data.currentStore) {
                document.getElementById('storeName').value = State.data.currentStore;
            }
            this.renderStoreDatalist();

            if (State.data.currentCategory) {
                document.getElementById('categoryName').value = State.data.currentCategory;
                this.updateFreshnessDisplay(State.data.currentCategory);
                this.restoreCategoryInputs(); 
            }
            
            Weather.restoreStoreWeather();
            this.setupEventListeners();
        },

        setupEventListeners() {
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
            });

            const storeInput = document.getElementById('storeName');
            storeInput.addEventListener('change', () => this.onStoreChange());
            storeInput.addEventListener('blur', () => this.onStoreChange());
            storeInput.addEventListener('focus', function() { this.select(); });

            document.getElementById('categoryName').addEventListener('change', () => this.onCategoryChange());

            const inputs = ['avgSales', 'currentStock', 'maxSales', 'minSales', 'avgWaste', 'avgShortageRate', 'minDisplayQty',
                            'ratio_mon', 'ratio_tue', 'ratio_wed', 'ratio_thu', 'ratio_fri', 'ratio_sat', 'ratio_sun'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    el.addEventListener('input', () => { 
                        State.updateInputData(); 
                        Logic.calculate(false); 
                    });
                    if(el.type === 'number') el.addEventListener('focus', function() { this.select(); });
                }
            });

            document.getElementById('targetDay').addEventListener('change', () => Logic.calculate(false));
            document.getElementById('maxTemp').addEventListener('input', () => Logic.calculate(false));
            document.getElementById('minTemp').addEventListener('input', () => Logic.calculate(false));
            
            document.getElementById('prefecture').addEventListener('change', () => Weather.onPrefectureChange());
            document.getElementById('cityArea').addEventListener('change', () => { Weather.onCityAreaChange(); Weather.fetchWeather(1); });

            const calcBtn = document.getElementById('btn-calculate');
            const calcText = document.getElementById('btn-calc-text');
            calcBtn.addEventListener('click', () => {
                if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                calcBtn.classList.add('loading');
                calcText.innerText = "データ解析中...";
                
                setTimeout(() => {
                    const success = Logic.calculate(false);
                    calcBtn.classList.remove('loading');
                    calcText.innerText = "⚡ AI 発注シミュレーション実行";
                    
                    if (success) {
                        setTimeout(() => document.getElementById('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                    } else {
                        alert("店舗名と対象分類を選択してください。");
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }, 400); 
            });

            document.getElementById('btn-refresh-all').addEventListener('click', () => { Logic.calculateAll(); });
            document.getElementById('btn-export').addEventListener('click', () => this.exportBackup());
            document.getElementById('btn-copy').addEventListener('click', () => this.copyBackup());
            document.getElementById('btn-import').addEventListener('click', () => this.importBackup());
        },

        switchTab(tabId) {
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            document.getElementById('tabContainer').setAttribute('data-active-tab', tabId);
            document.querySelectorAll('.tab-content, .tab-button').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
            if (tabId === 'all') Logic.calculateAll();
        },

        onStoreChange() {
            const s = document.getElementById('storeName').value.trim();
            if (!s) return;
            State.data.currentStore = s;
            State.ensureStore(s);
            State.save();
            this.renderStoreDatalist();
            this.restoreCategoryInputs();
            Weather.restoreStoreWeather();
            Logic.calculate(true);
        },

        onCategoryChange() {
            const cat = document.getElementById('categoryName').value;
            State.data.currentCategory = cat;
            State.save();
            this.updateFreshnessDisplay(cat);
            this.restoreCategoryInputs(); 
            Logic.calculate(true);
        },

        renderStoreDatalist() {
            const dataList = document.getElementById('storeList');
            dataList.innerHTML = '';
            const stores = Object.keys(State.data.stores).filter(s => s.trim() !== "");
            stores.forEach(store => {
                let option = document.createElement('option');
                option.value = store;
                dataList.appendChild(option);
            });
        },

        updateFreshnessDisplay(category) {
            const display = document.getElementById('freshnessDisplay');
            const hiddenVal = document.getElementById('freshnessTime');
            const displayInputArea = document.getElementById('displayInputArea');
            const stockInputArea = document.getElementById('stockInputArea');
            const stockMessageArea = document.getElementById('stockMessageArea');

            // 安全装置：HTMLが見つからなくてもエラーで止まらないようにする
            if (stockInputArea) stockInputArea.style.display = "block";
            if (stockMessageArea) stockMessageArea.style.display = "none";

            switch(category) {
                case "おにぎり": case "こだわりおにぎり": case "弁当":
                    hiddenVal.value = "14"; display.value = "最適化ロジック (約14H)"; displayInputArea.style.display = "flex"; 
                    if (stockInputArea) stockInputArea.style.display = "none";
                    if (stockMessageArea) stockMessageArea.style.display = "block";
                    break;
                case "寿司": case "サンドイッチ": case "ロール":
                    hiddenVal.value = "23"; display.value = "当日消化ロジック (約23H)"; displayInputArea.style.display = "flex"; 
                    if (stockInputArea) stockInputArea.style.display = "none";
                    if (stockMessageArea) stockMessageArea.style.display = "block";
                    break;
                case "調理麺": case "カップ麺": case "惣菜": case "サラダ":
                    hiddenVal.value = "38"; display.value = "維持ロジック (38H: +0.2日分)"; displayInputArea.style.display = "none"; break;
                case "チルド弁当": case "スパゲティパスタ": case "グラタンドリア": case "カップデリ":
                    hiddenVal.value = "60"; display.value = "維持ロジック (60H: +0.5日分)"; displayInputArea.style.display = "none"; break;
                default:
                    hiddenVal.value = "0"; display.value = "上の分類を選択してください"; displayInputArea.style.display = "none";
            }
        },

        restoreCategoryInputs() {
            const store = State.data.currentStore;
            const cat = State.data.currentCategory;
            if (!store || !cat) return;
            
            const defaults = {
                avgSales: "50", currentStock: "15", maxSales: "65", minSales: "35", avgWaste: "3", avgShortageRate: "0", minDisplayQty: "0",
                ratios: {mon:"50", tue:"50", wed:"50", thu:"50", fri:"55", sat:"60", sun:"55"}
            };

            let data = defaults;
            if (State.data.stores[store] && State.data.stores[store].categories && State.data.stores[store].categories[cat]) {
                const saved = State.data.stores[store].categories[cat];
                data = { ...defaults, ...saved, ratios: { ...defaults.ratios, ...(saved.ratios || {}) } };
            }

            document.getElementById('avgSales').value = data.avgSales;
            document.getElementById('currentStock').value = data.currentStock;
            document.getElementById('maxSales').value = data.maxSales;
            document.getElementById('minSales').value = data.minSales;
            document.getElementById('avgWaste').value = data.avgWaste;
            document.getElementById('avgShortageRate').value = data.avgShortageRate; 
            document.getElementById('minDisplayQty').value = data.minDisplayQty;

            Object.keys(data.ratios).forEach(d => {
                document.getElementById('ratio_' + d).value = data.ratios[d];
            });
        },

        setCorr(btn) {
            document.querySelectorAll('.corr-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('weatherCoeff').value = btn.dataset.val;
            Logic.calculate(false);
        },

        showSaveIndicator() {
            const ind = document.getElementById('saveIndicator');
            if(ind) { ind.innerText = "✓ 保存済"; setTimeout(() => { ind.innerText = ""; }, 2000); }
        },
        showSaveError() {
            const ind = document.getElementById('saveIndicator');
            if(ind) { ind.innerText = "⚠️ エラー"; }
        },
        exportBackup() {
            const dataStr = JSON.stringify(State.data);
            const encoded = btoa(unescape(encodeURIComponent(dataStr)));
            const textArea = document.getElementById('backupCode');
            textArea.value = encoded;
            textArea.select();
            alert("コードを作成しました！");
        },
        copyBackup() {
            const textArea = document.getElementById('backupCode');
            if (!textArea.value) return alert("先にコードを作成してください。");
            textArea.select();
            if (navigator.clipboard) { navigator.clipboard.writeText(textArea.value).then(() => alert("✅ コピーしました！")); } 
            else { document.execCommand('copy'); alert("✅ コピーしました！"); }
        },
        importBackup() {
            const textArea = document.getElementById('backupCode');
            const encoded = textArea.value.trim();
            if (!encoded) return alert("コードが入力されていません。");
            try {
                const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded))));
                if (parsed && parsed.stores) {
                    State.data = parsed; State.save(); this.init(); 
                    alert("復元に成功しました！"); textArea.value = ""; 
                    this.switchTab('simulator'); window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } catch(e) { alert("コードの形式が間違っています。"); }
        }
    };

    window.UI = UI; 
    const Weather = {
        restoreStoreWeather() {
            const store = State.data.currentStore;
            if (!store) return;
            State.ensureStore(store);
            const pref = State.data.stores[store].prefecture;
            const city = State.data.stores[store].cityArea;

            document.getElementById('prefecture').value = pref;
            if (pref) {
                this.fetchAreaList(pref, city);
            } else {
                document.getElementById('cityArea').innerHTML = '<option value="">-- エリア --</option>';
            }
        },

        onPrefectureChange() {
            const pref = document.getElementById('prefecture').value;
            const store = State.data.currentStore;
            if (!store) return;
            State.ensureStore(store);
            State.data.stores[store].prefecture = pref;
            State.data.stores[store].cityArea = ""; 
            State.save();
            
            if (pref) this.fetchAreaList(pref, null);
        },

        onCityAreaChange() {
            const store = State.data.currentStore;
            if(!store) return;
            State.ensureStore(store);
            State.data.stores[store].cityArea = document.getElementById('cityArea').value;
            State.save();
        },

        async fetchAreaList(prefCode, targetCityCode) {
            const areaSelect = document.getElementById('cityArea');
            try {
                const response = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${prefCode}.json`);
                const data = await response.json();
                let series = data[0].timeSeries.find(ts => ts.areas && ts.areas[0] && ts.areas[0].weathers) || data[0].timeSeries[0];
                areaSelect.innerHTML = '';
                series.areas.forEach((area) => {
                    let opt = document.createElement('option');
                    opt.value = area.area.code; opt.text = area.area.name; 
                    areaSelect.appendChild(opt);
                });
                if (targetCityCode && Array.from(areaSelect.options).some(o => o.value === targetCityCode)) {
                    areaSelect.value = targetCityCode;
                }
            } catch(e) { console.error("エリア取得失敗"); }
        },

        async fetchWeather(offset) {
            const prefCode = document.getElementById('prefecture').value;
            const areaCode = document.getElementById('cityArea').value;
            if (!prefCode || !areaCode) { alert("都道府県とエリアを選択してください"); return; }
            
            const btn = offset === 1 ? document.getElementById('btn-weather-tmw') : document.getElementById('btn-weather-dat');
            const originalText = btn.innerText;
            btn.innerText = "取得中...";
            btn.disabled = true;

            try {
                const response = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${prefCode}.json`);
                const data = await response.json();

                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + offset);
                const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`; 

                let minT = "", maxT = "", weatherText = "不明", wDate = targetDate;
                
                const getArea = (series) => {
                    if (!series || !series.areas) return null;
                    return series.areas.find(a => a.area && a.area.code === areaCode) || series.areas[0];
                };

                if (data[0] && data[0].timeSeries) {
                    let wSeries = data[0].timeSeries.find(ts => ts.areas && ts.areas[0].weathers);
                    if (wSeries) {
                        let idx = wSeries.timeDefines.findIndex(t => t.startsWith(targetDateStr));
                        if (idx !== -1) {
                            let aData = getArea(wSeries);
                            if (aData && aData.weathers && aData.weathers[idx]) { weatherText = aData.weathers[idx]; wDate = new Date(wSeries.timeDefines[idx]); }
                        } else if (wSeries.timeDefines.length > offset) {
                            let aData = getArea(wSeries);
                            if (aData && aData.weathers && aData.weathers[offset]) { weatherText = aData.weathers[offset]; wDate = new Date(wSeries.timeDefines[offset]); }
                        }
                    }
                }
                if (data[1] && data[1].timeSeries) {
                    let tSeries = data[1].timeSeries.find(ts => ts.areas && ts.areas[0].tempsMax);
                    if (tSeries) {
                        let idx = tSeries.timeDefines.findIndex(t => t.startsWith(targetDateStr));
                        if (idx !== -1) {
                            let aData = getArea(tSeries);
                            if (aData) {
                                if (aData.tempsMin && aData.tempsMin[idx]) min
