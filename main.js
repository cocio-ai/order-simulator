document.addEventListener("DOMContentLoaded", () => {
    
    // 都道府県リスト生成
    const prefs = {"016000":"北海道","020000":"青森県","030000":"岩手県","040000":"宮城県","050000":"秋田県","060000":"山形県","070000":"福島県","080000":"茨城県","090000":"栃木県","100000":"群馬県","110000":"埼玉県","120000":"千葉県","130000":"東京都","140000":"神奈川県","150000":"新潟県","160000":"富山県","170000":"石川県","180000":"福井県","190000":"山梨県","200000":"長野県","210000":"岐阜県","220000":"静岡県","230000":"愛知県","240000":"三重県","250000":"滋賀県","260000":"京都府","270000":"大阪府","280000":"兵庫県","290000":"奈良県","300000":"和歌山県","310000":"鳥取県","320000":"島根県","330000":"岡山県","340000":"広島県","350000":"山口県","360000":"徳島県","370000":"香川県","380000":"愛媛県","390000":"高知県","400000":"福岡県","410000":"佐賀県","420000":"長崎県","430000":"熊本県","440000":"大分県","450000":"宮崎県","460000":"鹿児島県","471000":"沖縄県"};
    const prefSelect = document.getElementById('prefecture');
    if(prefSelect) {
        prefSelect.innerHTML = '<option value="">-- 都道府県 --</option>';
        Object.keys(prefs).forEach(k => {
            let opt = document.createElement('option');
            opt.value = k; opt.text = prefs[k];
            prefSelect.appendChild(opt);
        });
    }

    // 曜日UI生成
    const daysArr = ['mon','tue','wed','thu','fri','sat','sun'];
    const daysLabel = ['月','火','水','木','金','土','日'];
    const drContainer = document.getElementById('dayRatioBoxes');
    if(drContainer) {
        drContainer.innerHTML = '';
        daysArr.forEach((d, i) => {
            let html = `<div class="day-ratio-box"><label>${daysLabel[i]}</label><select id="ratio_${d}">`;
            for(let v=0.5; v<=2.0; v+=0.1) html += `<option value="${v.toFixed(1)}"${v.toFixed(1)==='1.0'?' selected':''}>${v.toFixed(1)}</option>`;
            html += `</select></div>`;
            drContainer.innerHTML += html;
        });
    }

    // 明日の日付をデフォルト設定
    const tInput = document.getElementById('targetDateInput');
    if(tInput) {
        let tmw = new Date(); tmw.setDate(tmw.getDate() + 1);
        tInput.value = tmw.toISOString().split('T')[0];
    }

    // --- 状態管理 ---
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
                        v2HasData = true;
                        this.data = parsedV2;
                    }
                }

                if (!v2HasData && rawV1) {
                    const parsedV1 = JSON.parse(rawV1);
                    if (parsedV1 && parsedV1.stores && Object.keys(parsedV1.stores).length > 0) {
                        this.data = parsedV1;
                        this.data.version = 2; 

                        Object.keys(this.data.stores).forEach(storeName => {
                            const store = this.data.stores[storeName];
                            if (store.categories) {
                                Object.keys(store.categories).forEach(catName => {
                                    const cat = store.categories[catName];
                                    if (typeof cat.recentSales === 'undefined') cat.recentSales = "";
                                    if (typeof cat.learnedCoeff === 'undefined') cat.learnedCoeff = 1.0;
                                    if (typeof cat.categoryCoeff === 'undefined') cat.categoryCoeff = "1.0";
                                });
                            }
                        });
                        
                        this.save();
                    }
                }
            } catch(e) { console.error("Load Error", e); }
        },
        save() {
            try { localStorage.setItem('oms_unified_state_v2', JSON.stringify(this.data)); UI.showSaveIndicator(); } 
            catch(e) { UI.showSaveError(); }
        },
        ensureStore(storeName) {
            if (!storeName) return;
            if (!this.data.stores[storeName]) this.data.stores[storeName] = { prefecture: "230000", cityArea: "", categories: {} };
        },
        updateInputData() {
            const store = this.data.currentStore; const cat = this.data.currentCategory;
            if (!store || !cat) return;
            this.ensureStore(store);
            if (!this.data.stores[store].categories) this.data.stores[store].categories = {};
            
            const existingLearned = (this.data.stores[store].categories[cat] && this.data.stores[store].categories[cat].learnedCoeff) ? this.data.stores[store].categories[cat].learnedCoeff : 1.0;

            this.data.stores[store].categories[cat] = {
                avgSales: document.getElementById('avgSales').value,
                recentSales: document.getElementById('recentSales').value,
                currentStock: document.getElementById('currentStock').value,
                maxSales: document.getElementById('maxSales').value,
                minSales: document.getElementById('minSales').value,
                avgWaste: document.getElementById('avgWaste').value,
                avgShortageRate: document.getElementById('avgShortageRate').value,
                minDisplayQty: document.getElementById('minDisplayQty').value,
                categoryCoeff: document.getElementById('categoryCoeff').value,
                learnedCoeff: existingLearned, 
                ratios: {
                    mon: document.getElementById('ratio_mon').value, tue: document.getElementById('ratio_tue').value,
                    wed: document.getElementById('ratio_wed').value, thu: document.getElementById('ratio_thu').value,
                    fri: document.getElementById('ratio_fri').value, sat: document.getElementById('ratio_sat').value,
                    sun: document.getElementById('ratio_sun').value
                }
            };
            this.save();
        }
    };

    // --- UI制御 ---
    const UI = {
        init() {
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

            // ★ 店舗選択のプルダウン処理
            const storeSelect = document.getElementById('storeNameSelect');
            storeSelect.addEventListener('change', () => {
                if (storeSelect.value === '__NEW__') {
                    // 新規店舗追加処理
                    const newStore = prompt("新しい店舗名を入力してください\n(例: 2号店)");
                    if (newStore && newStore.trim() !== "") {
                        State.data.currentStore = newStore.trim();
                        State.ensureStore(State.data.currentStore);
                        State.save();
                        this.renderStoreDatalist();
                        this.restoreCategoryInputs();
                        Weather.restoreStoreWeather();
                        Logic.calculate(true);
                    } else {
                        // キャンセルした場合は元の店舗に戻す
                        storeSelect.value = State.data.currentStore || "";
                    }
                } else {
                    // 既存店舗の切り替え処理
                    State.data.currentStore = storeSelect.value;
                    State.save();
                    this.restoreCategoryInputs();
                    Weather.restoreStoreWeather();
                    Logic.calculate(true);
                }
            });

            document.getElementById('categoryName').addEventListener('change', () => this.onCategoryChange());

            const inputs = ['avgSales', 'recentSales', 'currentStock', 'maxSales', 'minSales', 'avgWaste', 'avgShortageRate', 'minDisplayQty', 'categoryCoeff', 'popRate', 'targetDateInput',
                            'ratio_mon', 'ratio_tue', 'ratio_wed', 'ratio_thu', 'ratio_fri', 'ratio_sat', 'ratio_sun'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    el.addEventListener('input', (e) => { 
                        State.updateInputData(); 
                        if(id === 'popRate') Logic.calcWeatherCoeff();
                        if(id === 'targetDateInput') Logic.updateDateUI();
                        Logic.calculate(false); 
                    });
                    if(el.type === 'number') el.addEventListener('focus', function() { this.select(); });
                }
            });

            document.getElementById('targetDay').addEventListener('change', () => Logic.calculate(false));
            document.getElementById('maxTemp').addEventListener('input', () => Logic.calculate(false));
            document.getElementById('minTemp').addEventListener('input', () => Logic.calculate(false));
            document.getElementById('customCoeff').addEventListener('change', () => Logic.calculate(false));
            
            document.getElementById('prefecture').addEventListener('change', () => Weather.onPrefectureChange());
            document.getElementById('cityArea').addEventListener('change', () => { Weather.onCityAreaChange(); Weather.fetchWeather(1); });

            document.getElementById('btn-calculate').addEventListener('click', () => {
                if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                Logic.calculate(false); 
                setTimeout(() => document.getElementById('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
            });

            document.getElementById('btn-learn').addEventListener('click', () => Logic.executeLearning());
            document.getElementById('btn-refresh-all').addEventListener('click', () => Logic.calculateAll());
            document.getElementById('btn-export').addEventListener('click', () => this.exportBackup());
            document.getElementById('btn-import').addEventListener('click', () => this.importBackup());
        },

        switchTab(tabId) {
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            document.getElementById('tabContainer').setAttribute('data-active-tab', tabId);
            document.querySelectorAll('.tab-content, .tab-button').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
            if (tabId === 'all') Logic.calculateAll();
            if (tabId === 'learning') {
                document.getElementById('learnTargetCategory').innerText = State.data.currentCategory || "未選択";
                document.getElementById('learnSuccessMsg').style.display = 'none';
            }
        },

        onCategoryChange() {
            const cat = document.getElementById('categoryName').value;
            if (cat === State.data.currentCategory) return;
            State.updateInputData(); State.data.currentCategory = cat; State.save();
            this.updateFreshnessDisplay(cat); this.restoreCategoryInputs(); Logic.calculate(true);
        },

        renderStoreDatalist() {
            const select = document.getElementById('storeNameSelect');
            select.innerHTML = '<option value="" disabled>店舗を選択してください</option>';
            
            // 保存されている店舗をオプションに追加
            Object.keys(State.data.stores).filter(s => s.trim() !== "").forEach(s => {
                let opt = document.createElement('option');
                opt.value = s;
                opt.text = s;
                if (s === State.data.currentStore) opt.selected = true;
                select.appendChild(opt);
            });
            
            // 最後に「＋ 新規店舗を追加...」を追加
            let optNew = document.createElement('option');
            optNew.value = '__NEW__';
            optNew.text = '＋ 新規店舗を追加...';
            select.appendChild(optNew);

            // 選択されていない場合の初期表示
            if (!State.data.currentStore) {
                select.value = "";
            }
        },

        updateFreshnessDisplay(cat) {
            const display = document.getElementById('freshnessDisplay'); const hiddenVal = document.getElementById('freshnessTime');
            const displayInputArea = document.getElementById('displayInputArea'); const stockLabel = document.getElementById('stockLabelText');
            
            if (stockLabel) {
                stockLabel.innerHTML = cat === "ロール" ? `現在庫 (1便納品前)` : `現在庫 (2便納品前)`;
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
            
            let data = { avgSales: "50", recentSales: "", currentStock: "15", maxSales: "65", minSales: "35", avgWaste: "3", avgShortageRate: "0", minDisplayQty: "0", categoryCoeff: "1.0", learnedCoeff: 1.0, ratios: {mon:"1.0", tue:"1.0", wed:"1.0", thu:"1.0", fri:"1.0", sat:"1.0", sun:"1.0"} };
            if (State.data.stores[store] && State.data.stores[store].categories && State.data.stores[store].categories[cat]) {
                data = { ...data, ...State.data.stores[store].categories[cat] };
            }

            ['avgSales', 'recentSales', 'currentStock', 'maxSales', 'minSales', 'avgWaste', 'avgShortageRate', 'minDisplayQty'].forEach(id => {
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
        exportBackup() { document.getElementById('backupCode').value = btoa(unescape(encodeURIComponent(JSON.stringify(State.data)))); alert("コードを作成しました"); },
        importBackup() {
            try {
                const parsed = JSON.parse(decodeURIComponent(escape(atob(document.getElementById('backupCode').value.trim()))));
                if (parsed && parsed.stores) { State.data = parsed; State.save(); this.init(); alert("復元に成功しました！"); }
            } catch(e) { alert("コードエラー"); }
        }
    };
    window.UI = UI; 

    // --- 気象庁・外部データ連携 ---
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
                const data = await res.json();
                const areaSelect = document.getElementById('cityArea'); areaSelect.innerHTML = '';
                (data[0].timeSeries[0].areas || []).forEach(a => {
                    let opt = document.createElement('option'); opt.value = a.area.code; opt.text = a.area.name; areaSelect.appendChild(opt);
                });
                if (targetCityCode) areaSelect.value = targetCityCode;
            } catch(e) { console.error("Area Error"); }
        },
        async fetchWeather(offset) {
            const prefCode = document.getElementById('prefecture').value; const areaCode = document.getElementById('cityArea').value;
            if (!prefCode || !areaCode) return alert("都道府県とエリアを選択してください");
            
            const btn = offset === 1 ? document.getElementById('btn-weather-tmw') : document.getElementById('btn-weather-dat');
            const originalText = btn.innerText; btn.innerText = "取得中..."; btn.disabled = true;

            try {
                const res = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${prefCode}.json`);
                const data = await res.json();

                const tDate = new Date(); tDate.setDate(tDate.getDate() + offset);
                const tDateStr = `${tDate.getFullYear()}-${String(tDate.getMonth()+1).padStart(2,'0')}-${String(tDate.getDate()).padStart(2,'0')}`; 
                document.getElementById('targetDateInput').value = tDateStr;

                let minT = "", maxT = "", weatherText = "不明", pop = "0";
                const getArea = (series) => series.areas.find(a => a.area.code === areaCode) || series.areas[0];

                if (data[0] && data[0].timeSeries) {
                    let wSeries = data[0].timeSeries.find(ts => ts.areas && ts.areas[0].weathers);
                    let pSeries = data[0].timeSeries.find(ts => ts.areas && ts.areas[0].pops); // 降水確率
                    
                    if (wSeries) {
                        let idx = wSeries.timeDefines.findIndex(t => t.startsWith(tDateStr));
                        if (idx === -1) idx = offset; 
                        let aData = getArea(wSeries); if (aData && aData.weathers[idx]) weatherText = aData.weathers[idx];
                    }
                    if (pSeries) {
                        let idx = pSeries.timeDefines.findIndex(t => t.startsWith(tDateStr));
                        if(idx !== -1) { let pData = getArea(pSeries); if(pData && pData.pops[idx]) pop = pData.pops[idx]; }
                    }
                }
                if (data[1] && data[1].timeSeries) {
                    let tSeries = data[1].timeSeries.find(ts => ts.areas && ts.areas[0].tempsMax);
                    if (tSeries) {
                        let idx = tSeries.timeDefines.findIndex(t => t.startsWith(tDateStr));
                        if(idx !== -1) {
                            let aData = getArea(tSeries);
                            if (aData.tempsMin && aData.tempsMin[idx]) minT = aData.tempsMin[idx];
                            if (aData.tempsMax && aData.tempsMax[idx]) maxT = aData.tempsMax[idx];
                        }
                    }
                }

                if (minT) document.getElementById('minTemp').value = minT;
                if (maxT) document.getElementById('maxTemp').value = maxT;
                if (pop) document.getElementById('popRate').value = pop.replace('%','');
                
                let icon = '⛅';
                if (/大雨|豪雨|暴風|大雪/.test(weatherText)) icon='🌧️';
                else if (/雨|雪/.test(weatherText)) icon='🌦️';
                else if (/晴|曇/.test(weatherText)) icon='☀️';

                const disp = document.getElementById('weather-display'); disp.style.display = 'inline-flex';
                disp.innerText = `${icon} ${weatherText.replace(/　/g, ' ').substring(0,20)} (降水確率: ${pop}%)`;
                
                document.getElementById('targetDay').value = ['sun','mon','tue','wed','thu','fri','sat'][tDate.getDay()];
                Logic.updateDateUI(); Logic.calcWeatherCoeff(); Logic.calculate(false);
            } catch (e) { alert("天気取得失敗"); } 
            finally { btn.innerText = originalText; btn.disabled = false; }
        }
    };
    window.Weather = Weather; 

    // --- メイン計算ロジック ---
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
            if(!dateStr) { badge.style.display='none'; return; }
            const d = new Date(dateStr).getDate();
            if (d === 15 || d === 25) { badge.innerText = `💰 年金/給料日 特需`; badge.style.display='block'; }
            else if (d % 5 === 0 && d !== 31) { badge.innerText = `🚙 五十日(ごとおび) 活発`; badge.style.display='block'; }
            else { badge.style.display='none'; }
        },

        getCalendarCoeff(dateStr) {
            if(!dateStr) return 1.0;
            const d = new Date(dateStr).getDate();
            if (d === 15 || d === 25) return 1.05; // 給料日ブースト
            if (d % 5 === 0 && d !== 31) return 1.03; // 五十日ブースト
            return 1.0;
        },

        getTempCoeff(catVal, maxTemp, minTemp) {
            let coeff = 1.0, fixed = 0, msg = "";
            if (catVal === "調理麺") {
                if (maxTemp >= 26) { coeff = 1.0; fixed = 10 + (Math.floor(maxTemp)-26)*3; msg = `🔥 猛暑日！冷やし麺ダイレクト+${fixed}個加算`; }
                else if (maxTemp >= 20) { coeff = 1.0 + ((maxTemp - 20) * 0.02); msg = "🌤 20℃超え。調理麺が動き出します"; }
                else if (maxTemp < 10) { coeff = 1.0 - 0.10 - ((10 - maxTemp) * 0.04); msg = "❄️ 10℃未満。冷やし麺は売れにくいです"; }
            } else if (["サラダ", "カップデリ"].includes(catVal)) {
                if (maxTemp > 25) coeff = 1.0 + ((maxTemp - 25) * 0.03);
            } else if (["カップ麺", "グラタンドリア", "チルド弁当"].includes(catVal)) {
                if (minTemp < 10) coeff = 1.0 + ((10 - minTemp) * 0.03);
                if (maxTemp > 25) coeff -= ((maxTemp - 25) * 0.02);
            }
            return { coeff: Math.max(0.3, Math.min(2.5, coeff)), fixedBoost: fixed, message: msg };
        },

        executeLearning() {
            const act = parseFloat(document.getElementById('fbActual').value);
            const pred = parseFloat(document.getElementById('fbPredicted').value);
            if (!act || !pred || pred <= 0) return alert("予測数と実際の販売数を正しく入力してください。");
            
            // ★ storeNameSelect から現在の店舗を取得するように変更
            const storeSelect = document.getElementById('storeNameSelect');
            const store = storeSelect.value;
            const cat = State.data.currentCategory;
            if (!store || store === "__NEW__" || !cat) return;
            
            let currentL = State.data.stores[store].categories[cat].learnedCoeff || 1.0;
            let ratio = act / pred;
            // 乖離率をマイルドに反映 (学習率30%)
            let newL = currentL + ((ratio - 1.0) * 0.3);
            newL = Math.max(0.8, Math.min(1.2, newL)); // 安全のため0.8〜1.2倍に制限
            
            State.data.stores[store].categories[cat].learnedCoeff = newL;
            State.save();
            
            document.getElementById('currentLearnedCoeffText').innerText = newL.toFixed(2);
            const msg = document.getElementById('learnSuccessMsg');
            msg.style.display = 'block'; setTimeout(() => msg.style.display='none', 3000);
            
            this.calculate(false);
        },

        calculate(silent = false) {
            // ★ storeNameSelect から現在の店舗を取得するように変更
            const storeSelect = document.getElementById('storeNameSelect');
            const store = storeSelect.value; 
            const cat = document.getElementById('categoryName').value;
            const fHours = parseFloat(document.getElementById('freshnessTime').value);
            
            if (!store || store === "__NEW__" || !cat || fHours === 0) return false;

            // 基礎データ
            const avgSales = parseFloat(document.getElementById('avgSales').value) || 0;
            const recentSales = parseFloat(document.getElementById('recentSales').value);
            const currentStock = parseInt(document.getElementById('currentStock').value) || 0;
            const minQty = (fHours<=24) ? (parseFloat(document.getElementById('minDisplayQty').value) || 0) : 0;
            const waste = parseFloat(document.getElementById('avgWaste').value) || 0;
            const shortage = Math.min(parseFloat(document.getElementById('avgShortageRate').value) || 0, 90);
            
            // 係数関連
            const dayR = parseFloat(document.getElementById('ratio_' + document.getElementById('targetDay').value).value) || 1.0;
            const weathR = parseFloat(document.getElementById('weatherCoeff').value) || 1.0;
            const calR = this.getCalendarCoeff(document.getElementById('targetDateInput').value);
            const customR = parseFloat(document.getElementById('customCoeff').value) || 1.0;
            const catR = parseFloat(document.getElementById('categoryCoeff').value) || 1.0;
            const maxT = parseFloat(document.getElementById('maxTemp').value) || 25;
            const minT = parseFloat(document.getElementById('minTemp').value) || 15;
            
            // 学習係数
            const learnR = (State.data.stores[store] && State.data.stores[store].categories[cat]) ? (State.data.stores[store].categories[cat].learnedCoeff || 1.0) : 1.0;

            // 1. 直近トレンドブースト
            let baseDemand = avgSales;
            let trendBoostVal = 0;
            if (!isNaN(recentSales) && recentSales > (avgSales * 1.1)) {
                trendBoostVal = (recentSales - avgSales) * 0.6; // 勢いの60%を基礎値に上乗せ
                baseDemand += trendBoostVal;
            }

            // 2. 欠品ブースト
            let shortR = 1.0, diffShort = 0;
            if (shortage > 20) { shortR = 1.03 + ((shortage-20)*0.004); diffShort = shortage-20; }
            else if (shortage > 5) { shortR = 1.0 + (shortage*0.002); diffShort = shortage*0.5; }
            else if (shortage > 0) { shortR = 1.01; diffShort = shortage; }
            
            // 3. 気温補正
            const tInfo = this.getTempCoeff(cat, maxT, minT);
            
            // 標準偏差算出 (安全在庫用)
            const maxS = parseFloat(document.getElementById('maxSales').value) || 0;
            const minS = parseFloat(document.getElementById('minSales').value) || 0;
            const stdDev = (Math.max(maxS, minS) - Math.min(maxS, minS)) / 4 * shortR;
            
            // 最終需要予測算出 (基本 × 曜日 × 天候 × カレンダー × 全体補正 × 分類補正 × AI学習補正)
            let multiplier = dayR * weathR * calR * customR * catR * tInfo.coeff * learnR;
            let finalDemandRaw = (baseDemand * shortR * multiplier) + tInfo.fixedBoost;
            
            // 発注量計算 (ロス削減・バッファ確保ロジック)
            const extraDays = fHours===60 ? 0.5 : (fHours===38 ? 0.2 : 0);
            const safetyStock = 1.645 * stdDev * Math.sqrt(1 + extraDays);
            const sysBuffer = (finalDemandRaw * extraDays) + safetyStock;
            const appliedBuffer = Math.max(minQty, sysBuffer);
            
            let rawOrder = Math.max(0, Math.ceil((finalDemandRaw + appliedBuffer) - currentStock));
            const wasteReduct = waste * Math.max(0, 1 - (diffShort/10));
            let finalOrder = Math.max(0, Math.ceil(rawOrder - wasteReduct));
            
            // 鮮度上限チェック
            if (fHours > 24) {
                let limit = Math.max(0, Math.floor((finalDemandRaw * (fHours/24)) - currentStock));
                if (finalOrder > limit) finalOrder = limit;
            }

            if(!silent) this.renderUI(cat, finalDemandRaw, finalOrder, avgSales, trendBoostVal, shortR, dayR, weathR, calR, customR, catR, learnR, tInfo, appliedBuffer, minQty, sysBuffer, wasteReduct);
            return true;
        },

        renderUI(cat, predRaw, order, base, trend, shortR, day, weather, cal, custom, catR, learn, temp, buffer, minQ, sysB, waste) {
            document.getElementById('resCategory').innerText = cat;
            document.getElementById('resBaseSales').innerText = base.toFixed(1);
            document.getElementById('resTrendBoost').innerText = trend > 0 ? `(+トレンド ${trend.toFixed(1)})` : '';
            document.getElementById('resShortageBoost').innerText = shortR > 1.0 ? `(×欠品補正 ${shortR.toFixed(2)})` : '';
            
            document.getElementById('resDayRatio').innerText = day.toFixed(2);
            let multStr = `[天候 ${weather.toFixed(2)} × 気温 ${temp.coeff.toFixed(2)} × カレンダー ${cal.toFixed(2)} × 学習 ${learn.toFixed(2)} × 独自/分類 ${custom.toFixed(2)}/${catR.toFixed(2)}]`;
            document.getElementById('resMultipliers').innerText = multStr;
            
            if(learn !== 1.0) document.getElementById('resLearningMessage').innerText = `🧠 AI学習による店舗独自のクセ補正 (×${learn.toFixed(2)}) が適用されています。`;
            else document.getElementById('resLearningMessage').innerText = "";

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
            let html = "";
            cats.forEach(c => {
                document.getElementById('categoryName').value = c;
                UI.onCategoryChange();
                if(this.calculate(true)) {
                    let o = document.getElementById('resOrderQty').innerText;
                    let p = document.getElementById('resAdjSales').innerText;
                    html += `<div class="all-result-item" onclick="document.getElementById('categoryName').value='${c}'; UI.onCategoryChange(); UI.switchTab('simulator'); window.scrollTo(0,0);">
                        <div class="all-result-cat">${c}</div><div class="all-result-numbers">予測: <strong>${p}</strong> | 発注: <strong>${o}</strong></div></div>`;
                }
            });
            document.getElementById('allResultsContainer').innerHTML = html;
        }
    };

    State.load(); UI.init();
});
