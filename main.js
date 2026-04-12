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
                    el.addEventListener('input', (e) => { 
                        if (e.target.id === 'maxSales' || e.target.id === 'minSales') {
                            this.updateFluctuationDisplay();
                        }
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

            // 📸 画像保存（スクショ）ボタンの処理
            document.getElementById('btn-screenshot').addEventListener('click', () => {
                const captureArea = document.getElementById('captureArea');
                const btn = document.getElementById('btn-screenshot');
                const originalText = btn.innerText;
                btn.innerText = "⏳ 保存準備中...";
                
                // 余計な説明テキストをスクショ時に隠す
                const desc = document.getElementById('allTabDesc');
                if(desc) desc.style.display = 'none';

                // html2canvasで指定領域を画像化
                html2canvas(captureArea,
