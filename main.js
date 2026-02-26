document.addEventListener("DOMContentLoaded", () => {
    
    // --- 状態管理 (State Management) ---
    const State = {
        data: {
            version: 1, 
            currentStore: "", 
            currentCategory: "",
            targetDateOffset: "1",
            stores: {} 
        },
        weatherCache: null,

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

    // --- UI制御 (UI Manager) ---
    const UI = {
        init() {
            this.updateDateOptions();
            this.setupRatios();
            
            if (State.data.currentStore) {
                document.getElementById('storeName').value = State.data.currentStore;
            }
            if (State.data.targetDateOffset) {
                document.getElementById('targetDateOffset').value = State.data.targetDateOffset;
            }
            
            this.renderStoreDatalist();

            if (State.data.currentCategory) {
                document.getElementById('categoryName').value = State.data.currentCategory;
                this.updateFreshnessDisplay(State.data.currentCategory);
                this.restoreCategoryInputs(); 
            }
            
            Weather.restoreStoreWeather();
            Logic.calculate();
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

            const inputs = ['avgSales', 'currentStock', 'maxSales', 'minSales', 'avgWaste', 'minDisplayQty',
                            'ratio_mon', 'ratio_tue', 'ratio_wed', 'ratio_thu', 'ratio_fri', 'ratio_sat', 'ratio_sun'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    el.addEventListener('input', () => { State.updateInputData(); Logic.calculate(); });
                    if(el.type === 'number') el.addEventListener('focus', function() { this.select(); });
                }
            });

            document.getElementById('targetDay').addEventListener('change', () => Logic.calculate());
            document.getElementById('weather').addEventListener('change', () => Logic.calculate());
            document.getElementById('maxTemp').addEventListener('input', () => Logic.calculate());
            document.getElementById('minTemp').addEventListener('input', () => Logic.calculate());
            
            document.getElementById('prefecture').addEventListener('change', () => Weather.onPrefectureChange());
            document.getElementById('cityArea').addEventListener('change', () => Weather.onCityAreaChange());
            document.getElementById('targetDateOffset').addEventListener('change', () => Weather.onDateOffsetChange());

            document.getElementById('btn-calculate').addEventListener('click', () => {
                if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                if (Logic.calculate()) {
                    setTimeout(() => document.getElementById('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
                } else {
                    alert("店舗名と対象分類を選択してください。");
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });

            document.getElementById('btn-export').addEventListener('click', () => this.exportBackup());
            document.getElementById('btn-import').addEventListener('click', () => this.importBackup());
        },

        switchTab(tabId) {
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            document.querySelectorAll('.tab-content, .tab-button').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
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
            Logic.calculate();
        },

        onCategoryChange() {
            const cat = document.getElementById('categoryName').value;
            State.data.currentCategory = cat;
            State.save();
            this.updateFreshnessDisplay(cat);
            this.restoreCategoryInputs(); 
            Logic.calculate();
        },

        updateDateOptions() {
            const today = new Date();
            const tmw = new Date(today); tmw.setDate(today.getDate() + 1);
            const dat = new Date(today); dat.setDate(today.getDate() + 2);
            const days = ['日', '月', '火', '水', '木', '金', '土'];
            document.getElementById('opt-tomorrow').innerText = `${tmw.getMonth() + 1}/${tmw.getDate()}(${days[tmw.getDay()]}) [明日] の予報を取得`;
            document.getElementById('opt-dayafter').innerText = `${dat.getMonth() + 1}/${dat.getDate()}(${days[dat.getDay()]}) [明後日] の予報を取得`;
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

            switch(category) {
                case "おにぎり": case "こだわりおにぎり": case "弁当":
                    hiddenVal.value = "14"; display.value = "最適化ロジック (約14H)"; displayInputArea.style.display = "block"; break;
                case "寿司": case "サンドイッチ": case "ロール":
                    hiddenVal.value = "23"; display.value = "当日消化ロジック (約23H)"; displayInputArea.style.display = "block"; break;
                case "調理麺": case "カップ麺": case "惣菜": case "サラダ":
                    hiddenVal.value = "38"; display.value = "維持ロジック (38H: +0.2日分)"; displayInputArea.style.display = "none"; break;
                case "チルド弁当": case "スパゲティパスタ": case "グラタンドリア": case "カップデリ":
                    hiddenVal.value = "60"; display.value = "維持ロジック (60H: +0.5日分)"; displayInputArea.style.display = "none"; break;
                default:
                    hiddenVal.value = "0"; display.value = "上の分類を選択してください"; displayInputArea.style.display = "none";
            }
        },

        setupRatios() {
            const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
            days.forEach(d => {
                const select = document.getElementById('ratio_' + d);
                for (let i = 0.5; i <= 3.01; i += 0.1) {
                    let valStr = i.toFixed(1);
                    let option = document.createElement('option');
                    option.value = valStr; option.text = valStr;
                    select.appendChild(option);
                }
            });
        },

        restoreCategoryInputs() {
            const store = State.data.currentStore;
            const cat = State.data.currentCategory;
            if (!store || !cat) return;
            
            const defaults = {
                avgSales: "50", currentStock: "15", maxSales: "65", minSales: "35", avgWaste: "3", minDisplayQty: "0",
                ratios: {mon:"1.0", tue:"1.0", wed:"1.0", thu:"1.0", fri:"1.0", sat:"1.2", sun:"1.3"}
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
            document.getElementById('minDisplayQty').value = data.minDisplayQty;

            Object.keys(data.ratios).forEach(d => {
                document.getElementById('ratio_' + d).value = Number(data.ratios[d]).toFixed(1);
            });
        },

        showSaveIndicator() {
            const ind = document.getElementById('saveIndicator');
            if(ind) {
                ind.innerText = "✓"; ind.style.color = "var(--success)";
                setTimeout(() => { ind.innerText = ""; }, 2000);
            }
        },

        showSaveError() {
            const ind = document.getElementById('saveIndicator');
            if(ind) { ind.innerText = "⚠️"; ind.style.color = "var(--danger)"; }
        },

        exportBackup() {
            const dataStr = JSON.stringify(State.data);
            const encoded = btoa(unescape(encodeURIComponent(dataStr)));
            const textArea = document.getElementById('backupCode');
            textArea.value = encoded;
            textArea.select();
            alert("コードを作成しました！コピーして保存してください。");
        },

        importBackup() {
            const textArea = document.getElementById('backupCode');
            const encoded = textArea.value.trim();
            if (!encoded) return alert("コードが入力されていません。");

            try {
                const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded))));
                if (parsed && parsed.stores) {
                    State.data = parsed;
                    State.save(); 
                    this.init(); 
                    alert("復元に成功しました！");
                    textArea.value = ""; 
                    this.switchTab('simulator');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } catch(e) { alert("コードの形式が間違っています。"); }
        }
    };

    // --- 気象情報連携 (Weather Service) ---
    const Weather = {
        restoreStoreWeather() {
            const store = State.data.currentStore;
            if (!store) return;
            State.ensureStore(store);
            const pref = State.data.stores[store].prefecture;
            const city = State.data.stores[store].cityArea;

            document.getElementById('prefecture').value = pref;
            if (pref) {
                this.fetchWeather(pref, city);
            } else {
                document.getElementById('cityArea').innerHTML = '<option value="">-- エリア --</option>';
                document.getElementById('acquiredDateDisplay').style.display = 'none';
                State.weatherCache = null;
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
            
            if (pref) this.fetchWeather(pref, null);
            else { this.restoreStoreWeather(); Logic.calculate(); }
        },

        onCityAreaChange() {
            const store = State.data.currentStore;
            if(!store) return;
            State.ensureStore(store);
            State.data.stores[store].cityArea = document.getElementById('cityArea').value;
            State.save();
            this.applyWeatherData();
        },

        onDateOffsetChange() {
            State.data.targetDateOffset = document.getElementById('targetDateOffset').value;
            State.save();
            this.applyWeatherData();
        },

        async fetchWeather(prefCode, targetCityCode) {
            const statusText = document.getElementById('weatherStatus');
            const areaSelect = document.getElementById('cityArea');
            statusText.innerText = "データ取得中...";
            try {
                const response = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${prefCode}.json`);
                const data = await response.json();
                State.weatherCache = data;

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
                statusText.innerText = "✓ 取得完了";
                setTimeout(() => { statusText.innerText = ""; }, 3000);
                this.applyWeatherData();
            } catch(e) {
                statusText.innerText = "取得失敗"; statusText.style.color = "red";
            }
        },

        applyWeatherData() {
            if (!State.weatherCache) return;
            const data = State.weatherCache;
            const areaCode = document.getElementById('cityArea').value;
            if (!areaCode) return;
            
            const offset = parseInt(State.data.targetDateOffset);
            try {
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + offset);
                const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`; 

                let minT = "", maxT = "", weatherText = "予報データなし", wDate = targetDate;
                
                // 1. 週間予報（data[1]）からの取得
                if (data[1] && data[1].timeSeries) {
                    let wSeries = data[1].timeSeries.find(ts => ts.areas && ts.areas[0].weathers);
                    if (wSeries) {
                        let idx = wSeries.timeDefines.findIndex(t => t.startsWith(targetDateStr));
                        if (idx !== -1) {
                            let aData = wSeries.areas.find(a => a.area.code === areaCode) || wSeries.areas[0];
                            weatherText = aData.weathers[idx] || weatherText;
                            wDate = new Date(wSeries.timeDefines[idx]);
                        }
                    }
                    let tSeries = data[1].timeSeries.find(ts => ts.areas && ts.areas[0].tempsMax);
                    if (tSeries) {
                        let idx = tSeries.timeDefines.findIndex(t => t.startsWith(targetDateStr));
                        if (idx !== -1) {
                            let aData = tSeries.areas.find(a => a.area.code === areaCode) || tSeries.areas[0];
                            minT = aData.tempsMin[idx] || minT; maxT = aData.tempsMax[idx] || maxT;
                        }
                    }
                }

                // 2. 短期予報（data[0]）からの取得（オリジナル版のロジックを復元）
                if (data[0] && data[0].timeSeries) {
                    let shortWeatherSeries = data[0].timeSeries.find(ts => ts.areas && ts.areas[0] && ts.areas[0].weathers);
                    if (shortWeatherSeries) {
                        let wIndex = shortWeatherSeries.timeDefines.findIndex(t => t.startsWith(targetDateStr));
                        if (wIndex !== -1) {
                            let areaData = shortWeatherSeries.areas.find(a => a.area.code === areaCode) || shortWeatherSeries.areas[0];
                            weatherText = areaData.weathers[wIndex] || weatherText;
                            wDate = new Date(shortWeatherSeries.timeDefines[wIndex]);
                        }
                    }
                    
                    let shortTempSeries = data[0].timeSeries.find(ts => ts.areas && ts.areas[0] && ts.areas[0].temps);
                    if (shortTempSeries) {
                        let areaData = shortTempSeries.areas.find(a => a.area.code === areaCode) || shortTempSeries.areas[0];
                        if (areaData && areaData.temps) {
                            let minCandidates = [];
                            let maxCandidates = [];
                            shortTempSeries.timeDefines.forEach((t, idx) => {
                                if (t.startsWith(targetDateStr)) {
                                    let hr = new Date(t).getHours();
                                    if (hr === 0 || hr === 6) minCandidates.push(areaData.temps[idx]);
                                    if (hr === 9 || hr === 12 || hr === 15) maxCandidates.push(areaData.temps[idx]);
                                }
                            });
                            if (offset === 1 && minCandidates.length === 0 && maxCandidates.length === 0) {
                                let len = areaData.temps.length;
                                if (len >= 2) { minT = areaData.temps[len - 2]; maxT = areaData.temps[len - 1]; }
                            } else {
                                if (minCandidates.length > 0) minT = minCandidates[0];
                                if (maxCandidates.length > 0) maxT = maxCandidates[maxCandidates.length - 1];
                            }
                        }
                    }
                }

                if (minT !== "" && !isNaN(minT)) document.getElementById('minTemp').value = minT;
                if (maxT !== "" && !isNaN(maxT)) document.getElementById('maxTemp').value = maxT;
                
                // --- 新しい天候倍率ロジック ---
                let wRatio = 1.0;
                if (weatherText.includes("雨") || weatherText.includes("雪")) {
                    if (weatherText.includes("一時") || weatherText.includes("時々") || weatherText.includes("小雨")) {
                        wRatio = 0.9; 
                    } else if (weatherText.includes("夜遅く") || weatherText.includes("夕方から") || weatherText.includes("明け方")) {
                        wRatio = 1.0; 
                    } else if (weatherText.includes("のち")) {
                        wRatio = 0.9; 
                    } else {
                        wRatio = 0.8; 
                    }
                }
                document.getElementById('weather').value = wRatio.toFixed(1);
                
                document.getElementById('actualWeatherText').innerText = weatherText.replace(/　/g, ' ');
                document.getElementById('acquiredDateDisplay').style.display = 'block';
                document.getElementById('acquiredDateText').innerText = `${wDate.getMonth() + 1}月${wDate.getDate()}日 (${['日', '月', '火', '水', '木', '金', '土'][wDate.getDay()]})`;
                document.getElementById('targetDay').value = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][wDate.getDay()];

                Logic.calculate();
            } catch (e) { console.error("天気データ反映エラー:", e); }
        }
    };

    // --- 計算ロジック (Order Logic) ---
    const Logic = {
        calculateCoreOrderQty(baseAdjustedSales, stdDev, leadTime, extraStockDays, minDisplayQty, currentStock, avgWaste, freshnessHours) {
            const safetyStock = 1.645 * stdDev * Math.sqrt(leadTime + extraStockDays);
            const systemBuffer = (baseAdjustedSales * extraStockDays) + safetyStock;
            let appliedBuffer = (minDisplayQty > systemBuffer) ? minDisplayQty : systemBuffer;

            const baseDemand = (baseAdjustedSales * leadTime) + appliedBuffer;
            let rawOrderQty = Math.max(0, Math.ceil(baseDemand - currentStock));
            let finalOrderQty = Math.max(0, rawOrderQty - avgWaste);

            if (freshnessHours > 24) {
                let maxOrderableQty = Math.max(0, Math.floor((baseAdjustedSales * (freshnessHours / 24)) - currentStock));
                if (finalOrderQty > maxOrderableQty) finalOrderQty = maxOrderableQty;
            }

            return { finalOrderQty, baseDemand, appliedBuffer, systemBuffer };
        },

        calculate() {
            const storeName = document.getElementById('storeName').value.trim();
            const catSelect = document.getElementById('categoryName');
            const catVal = catSelect.value;
            const freshnessHours = parseFloat(document.getElementById('freshnessTime').value);
            
            const maxS = parseFloat(document.getElementById('maxSales').value) || 0;
            const minS = parseFloat(document.getElementById('minSales').value) || 0;
            const diff = Math.max(maxS, minS) - Math.min(maxS, minS);
            const stdDev = diff / 4; 
            
            document.getElementById('dispMax').innerText = Math.max(maxS, minS);
            document.getElementById('dispMin').innerText = Math.min(maxS, minS);
            document.getElementById('dispDiff').innerText = diff;
            document.getElementById('dispStdDev').innerText = stdDev.toFixed(1);

            if (!storeName || !catVal || freshnessHours === 0) {
                document.getElementById('resultArea').style.display = 'none';
                document.getElementById('warningArea').style.display = 'none';
                return false; 
            }

            const avgSales = parseFloat(document.getElementById('avgSales').value) || 0;
            const currentStock = parseInt(document.getElementById('currentStock').value) || 0;
            const avgWaste = parseFloat(document.getElementById('avgWaste').value) || 0;
            const minDisplayQty = (freshnessHours === 14 || freshnessHours === 23) ? (parseFloat(document.getElementById('minDisplayQty').value) || 0) : 0;
            
            const targetDay = document.getElementById('targetDay').value;
            const dayRatio = parseFloat(document.getElementById('ratio_' + targetDay).value) || 1.0;
            const weatherCoeff = parseFloat(document.getElementById('weather').value);
            const maxTemp = parseFloat(document.getElementById('maxTemp').value) || 25;
            const minTemp = parseFloat(document.getElementById('minTemp').value) || 15;

            let tempCoeff = 1.0; let tempMessage = "";
            if (catVal === "調理麺") {
                if (maxTemp >= 35) { tempCoeff = 1.0 + 0.10 + 0.30 + 0.50 + ((maxTemp - 35) * 0.15); tempMessage = "🌋 35℃超え！調理麺が爆発的に売れる暑さです"; }
                else if (maxTemp >= 30) { tempCoeff = 1.0 + 0.10 + 0.30 + ((maxTemp - 30) * 0.10); tempMessage = "☀️ 30℃超え！調理麺の飛躍的な売上増を予測"; }
                else if (maxTemp >= 25) { tempCoeff = 1.0 + 0.10 + ((maxTemp - 25) * 0.06); tempMessage = "🔥 25℃超え。調理麺がよく動く気温です"; }
                else if (maxTemp >= 20) { tempCoeff = 1.0 + ((maxTemp - 20) * 0.02); tempMessage = "🌤 20℃超え。調理麺が少しずつ動き出します"; }
                else if (maxTemp < 10) { tempCoeff = 1.0 - 0.10 - ((10 - maxTemp) * 0.04); tempMessage = "❄️ 10℃未満の冷え込み。調理麺の動きはかなり鈍ります"; }
                else if (maxTemp < 15) { tempCoeff = 1.0 - ((15 - maxTemp) * 0.02); tempMessage = "↓ 気温低下により調理麺予測をマイナス補正"; }
                else { tempCoeff = 1.0; tempMessage = "☁️ 過ごしやすい気温。調理麺は通常通りの動きです"; }
            } else if (catVal === "サラダ" || catVal === "カップデリ") {
                if (maxTemp > 25) { tempCoeff = 1.0 + ((maxTemp - 25) * 0.03); tempMessage = "↑ 暑さにより予測をプラス補正（夏型商材）"; }
                else if (maxTemp < 15) { tempCoeff = 1.0 - ((15 - maxTemp) * 0.02); tempMessage = "↓ 気温低下により予測をマイナス補正"; }
            } else if (["カップ麺", "グラタンドリア", "スパゲティパスタ", "チルド弁当"].includes(catVal)) {
                if (minTemp < 10) { tempCoeff = 1.0 + ((10 - minTemp) * 0.03); tempMessage = "↑ 冷え込みにより予測をプラス（冬型商材）"; }
                if (maxTemp > 25) { tempCoeff = tempCoeff - ((maxTemp - 25) * 0.02); tempMessage = "↓ 暑さにより予測をマイナス補正"; }
            } else {
                if (maxTemp > 30) { tempCoeff = 0.95; tempMessage = "↓ 猛暑による食欲減退を考慮して微減"; }
                else if (maxTemp < 10) { tempCoeff = 0.95; tempMessage = "↓ 極寒による客数減を考慮して微減"; }
            }
            tempCoeff = Math.max(0.3, Math.min(2.5, tempCoeff));

            const extraStockDays = (freshnessHours === 60) ? 0.5 : (freshnessHours === 38 ? 0.2 : 0); 
            const adjustedSales = avgSales * dayRatio * weatherCoeff * tempCoeff;
            const result = this.calculateCoreOrderQty(adjustedSales, stdDev, 1, extraStockDays, minDisplayQty, currentStock, avgWaste, freshnessHours);
            const normalResult = this.calculateCoreOrderQty(avgSales * dayRatio * weatherCoeff, stdDev, 1, extraStockDays, minDisplayQty, currentStock, avgWaste, freshnessHours);

            this.renderResult(catSelect.options[catSelect.selectedIndex].text, result, normalResult, tempCoeff, tempMessage, adjustedSales, currentStock, avgSales, dayRatio, weatherCoeff, minDisplayQty, extraStockDays, freshnessHours, avgWaste);
            return true;
        },

        renderResult(catName, result, normalResult, tempCoeff, tempMessage, adjustedSales, currentStock, avgSales, dayRatio, weatherCoeff, minDisplayQty, extraStockDays, freshnessHours, avgWaste) {
            document.getElementById('resCategory').innerText = catName;
            document.getElementById('resFreshnessText').innerText = document.getElementById('freshnessDisplay').value;
            document.getElementById('resBaseSales').innerText = avgSales;
            document.getElementById('resDayRatio').innerText = dayRatio.toFixed(1);
            document.getElementById('resWeatherRatio').innerText = weatherCoeff.toFixed(1);
            document.getElementById('resTempRatio').innerText = tempCoeff.toFixed(2);
            document.getElementById('resTempMessage').innerText = tempMessage;
            document.getElementById('resAdjSales').innerText = adjustedSales.toFixed(1);
            document.getElementById('resOrderQty').innerText = result.finalOrderQty;

            let boostQty = result.finalOrderQty - normalResult.finalOrderQty;
            const boostDiv = document.getElementById('boostBreakdown');
            if (boostQty > 0 && tempCoeff > 1.0) {
                document.getElementById('resNormalQty').innerText = normalResult.finalOrderQty;
                document.getElementById('resBoostQty').innerText = boostQty;
                const label = document.getElementById('boostLabelText');
                label.innerText = tempCoeff >= 1.4 ? "🌋 超絶気温ブースト:" : "🔥 気温ブースト:";
                label.style.color = tempCoeff >= 1.4 ? "#f43f5e" : "#f59e0b";
                boostDiv.style.display = 'block';
            } else { boostDiv.style.display = 'none'; }

            const targetStockArea = document.getElementById('targetStockArea');
            if (minDisplayQty > result.systemBuffer || extraStockDays > 0 || (result.systemBuffer > 0 && minDisplayQty > 0)) {
                document.getElementById('resTargetStock').innerText = Math.ceil(result.baseDemand);
                document.getElementById('targetStockLabel').innerText = minDisplayQty > result.systemBuffer ? `(予測数 ＋ 設定最低陳列量 ${minDisplayQty}個 確保)` : (extraStockDays > 0 ? `(予測数 ＋ ${extraStockDays}日分の売場・安全在庫を上乗せ)` : `(予測数 ＋ 安全在庫確保 ※指定陳列量はクリア)`);
                targetStockArea.style.display = 'block';
            } else { targetStockArea.style.display = 'none'; }

            let warningTriggered = false, warningMsg = "", stockLabel = "", stockValue = "";
            let rawOrderQty = Math.ceil(result.baseDemand - currentStock);
            
            if (freshnessHours === 14) {
                if (rawOrderQty > (rawOrderQty - avgWaste)) { warningTriggered = true; warningMsg = "⚠️ [ロス削減] 平均廃棄数を差し引き、無駄を削りました。"; stockLabel = "平均廃棄数マイナス調整"; stockValue = "-" + avgWaste + " 個"; }
                else { stockLabel = "鮮度上限チェック"; stockValue = "対象外 (短鮮度)"; }
            } else {
                let maxOrderableQty = Math.max(0, Math.floor((adjustedSales * (freshnessHours / 24)) - currentStock));
                if (result.finalOrderQty === maxOrderableQty && maxOrderableQty < (rawOrderQty - avgWaste)) { warningTriggered = true; warningMsg = "⚠️ [鮮度警告] 鮮度時間を超えるため、上限でカットしました。"; stockLabel = "販売時間に基づく理論上限"; stockValue = maxOrderableQty + " 個"; }
                else if (rawOrderQty > (rawOrderQty - avgWaste)) { warningTriggered = true; warningMsg = "⚠️ [ロス削減] 平均廃棄数を差し引き、無駄を削りました。"; stockLabel = "上限内 / 廃棄削減を適用"; stockValue = "-" + avgWaste + " 個"; }
                else { stockLabel = "鮮度上限チェック"; stockValue = "クリア (問題なし)"; }
            }

            document.getElementById('resMaxStockLabel').innerText = stockLabel;
            document.getElementById('resMaxStock').innerText = stockValue;
            
            document.getElementById('resultArea').style.display = 'block';
            const warnArea = document.getElementById('warningArea');
            if (warningTriggered) { document.getElementById('warningMessageText').innerHTML = warningMsg; warnArea.style.display = 'block'; }
            else { warnArea.style.display = 'none'; }
        }
    };

    State.load();
    UI.init();
});
