document.addEventListener('DOMContentLoaded', () => {
    // ----- DOM 요소 (변경 없음) -----
    const views = { setup: document.getElementById('setup-view'), main: document.getElementById('main-view'), detail: document.getElementById('detail-view') };
    const loadingOverlay = document.getElementById('loading-overlay');
    // ... (이하 동일)
    const loadingStatusText = document.getElementById('loading-status-text');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const searchBtn = document.getElementById('search-btn');
    const voiceSearchBtn = document.getElementById('voice-search-btn');
    const wordListContainer = document.getElementById('word-list-container');
    const backButton = document.getElementById('back-button');
    const flashcard = document.querySelector('.flashcard');
    const flashcardFront = document.getElementById('flashcard-front');
    const flashcardBack = document.getElementById('flashcard-back');
    const flashcardEng = document.getElementById('flashcard-eng');
    const flashcardKor = document.getElementById('flashcard-kor');
    const speakButton = document.getElementById('speak-button');
    const favoriteButton = document.getElementById('favorite-button');
    const settingsBtn = document.getElementById('settings-btn');
    const favoritesListBtn = document.getElementById('favorites-list-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const resetDataBtn = document.getElementById('reset-data-btn');
    const fileInput = document.getElementById('file-input');
    const setupStatus = document.getElementById('setup-status');
    const increaseFontBtn = document.getElementById('increase-font-btn');
    const decreaseFontBtn = document.getElementById('decrease-font-btn');
    const fontSizeDisplay = document.getElementById('font-size-display');
    const toast = document.getElementById('toast');
    const wordCountDisplay = document.getElementById('word-count-display');
    
    // ----- 상태 변수 (변경 없음) -----
    let db;
    let currentWord = null;
    let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    let currentFontSize = parseInt(localStorage.getItem('fontSize')) || 16;
    let isFavoritesView = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitRecognition;
    
    // ----- 상수 (변경 없음) -----
    const DB_NAME = "MyDictionaryDB", STORE_NAME = "words", DB_VERSION = 3;

    // ----- 뷰 관리 (변경 없음) -----
    function showView(viewName) { Object.values(views).forEach(v => v.classList.add('hidden')); views[viewName].classList.remove('hidden'); }
    
    // ★★★★★ [수정사항 해결] 최종 단어/품사 분리 함수 ★★★★★
    const KNOWN_PARTS_OF_SPEECH = new Set(['n', 'v', 'vi', 'vt', 'a', 'ad', 'adj', 'pron', 'prep', 'conj', 'x']);
    function parseEnglishWord(rawEng) {
        // 1. 끝에 붙은 품사 처리 (예: 'windn' -> 'wind (n)')
        for (let len = 3; len > 0; len--) {
            if (rawEng.length <= len + 1) continue;
            const tail = rawEng.slice(-len);
            const head = rawEng.slice(0, -len);
            if (KNOWN_PARTS_OF_SPEECH.has(tail) && /^[a-zA-Z]+$/.test(head)) {
                return `${head} <span style="font-size: 0.8em; color: #b8ddff;">(${tail})</span>`;
            }
        }
        
        // 2. 공백으로 분리된 보조 정보 처리 (예: 'clear x' -> 'clear (x)')
        const parts = rawEng.split(' ');
        if (parts.length > 1) {
            const head = parts[0];
            const tail = parts.slice(1).join(' ');
            return `${head} <span style="font-size: 0.8em; color: #b8ddff;">(${tail})</span>`;
        }
        
        // 3. 어떤 규칙에도 해당하지 않으면 원본 반환
        return rawEng;
    }

    // ----- UI 렌더링 -----
    function displayWords(words) {
        wordListContainer.innerHTML = '';
        if (words.length === 0) {
            wordListContainer.innerHTML = `<p class="placeholder">${isFavoritesView ? '즐겨찾기한 단어가 없습니다.' : '검색 결과가 없습니다.'}</p>`;
            return;
        }
        // 성능 향상을 위해 DocumentFragment 사용
        const fragment = document.createDocumentFragment();
        words.forEach(word => {
            const item = document.createElement('div');
            item.className = 'word-item';
            const summary = word.korean.length > 40 ? word.korean.substring(0, 40) + '...' : word.korean;
            item.innerHTML = `<span class="word-item-eng">${parseEnglishWord(word.english)}</span><span class="word-item-kor">${summary}</span>`;
            item.addEventListener('click', () => showDetailView(word));
            fragment.appendChild(item);
        });
        wordListContainer.appendChild(fragment);
    }
    
    function showDetailView(word) {
        currentWord = word;
        flashcardEng.innerHTML = parseEnglishWord(word.english); 
        flashcardKor.textContent = word.korean;
        flashcard.classList.remove('flipped');
        updateFavoriteButton();
        showView('detail');
        flashcardFront.scrollTop = 0;
        flashcardBack.scrollTop = 0;
        history.pushState({ view: 'detail' }, '', `#word`);
    }

    // ----- 음성 출력(TTS) 기능 수정 -----
    speakButton.addEventListener('click', () => {
        if (currentWord && 'speechSynthesis' in window) {
            // ★★★★★ 품사와 보조 정보를 모두 제거한 순수 단어만 읽도록 수정 ★★★★★
            let pureWord = currentWord.english.split(' ')[0];
            for (const pos of KNOWN_PARTS_OF_SPEECH) {
                if (pureWord.endsWith(pos)) {
                    const head = pureWord.slice(0, -pos.length);
                    if (/^[a-zA-Z]+$/.test(head)) {
                        pureWord = head;
                        break;
                    }
                }
            }
            const utterance = new SpeechSynthesisUtterance(pureWord);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        }
    });

    // ----- 나머지 모든 코드는 이전과 동일합니다 -----
    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = e => reject("DB 열기 오류: " + e.target.errorCode);
            request.onsuccess = e => { db = e.target.result; resolve(db); };
            request.onupgradeneeded = e => {
                const db = e.target.result;
                let store;
                if (!db.objectStoreNames.contains(STORE_NAME)) { store = db.createObjectStore(STORE_NAME, { keyPath: "id" }); } 
                else { store = e.target.transaction.objectStore(STORE_NAME); }
                if (!store.indexNames.contains('english_idx')) { store.createIndex("english_idx", "english", { unique: false }); }
                if (!store.indexNames.contains('korean_idx')) { store.createIndex("korean_idx", "korean", { unique: false }); }
                if (!store.indexNames.contains('searchTags_idx')) { store.createIndex("searchTags_idx", "searchTags", { unique: false, multiEntry: true }); }
            };
        });
    }
    function importDataToDB(wordsData) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.clear();
            wordsData.forEach(word => {
                if (word.korean) { word.searchTags = word.korean.split(/[,/]/).map(tag => tag.trim()).filter(tag => tag.length > 0); } 
                else { word.searchTags = []; }
                store.add(word);
            });
            tx.oncomplete = () => resolve();
            tx.onerror = e => reject("데이터 저장 오류: " + e.target.error);
        });
    }
    function searchWords(term) {
        return new Promise((resolve, reject) => {
            const searchTerm = term.trim();
            if (!db || searchTerm.length === 0) { resolve([]); return; }
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const results = new Map();
            const searches = [
                cursorSearch(store.index("english_idx"), IDBKeyRange.bound(searchTerm.toLowerCase(), searchTerm.toLowerCase() + '\uffff')),
                cursorSearch(store.index("korean_idx"), IDBKeyRange.bound(searchTerm, searchTerm + '\uffff')),
                cursorSearch(store.index("searchTags_idx"), IDBKeyRange.only(searchTerm))
            ];
            Promise.all(searches).then(allFoundWords => {
                allFoundWords.forEach(foundWords => {
                    foundWords.forEach(word => results.set(word.id, word));
                });
                resolve(Array.from(results.values()).slice(0, 100));
            }).catch(reject);
        });
    }
    function cursorSearch(index, range) {
        return new Promise((resolve, reject) => {
            const foundWords = [];
            const request = index.openCursor(range);
            request.onerror = e => reject(e.target.error);
            request.onsuccess = e => {
                const cursor = e.target.result;
                if (cursor) { foundWords.push(cursor.value); cursor.continue(); } 
                else { resolve(foundWords); }
            };
        });
    }
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        loadingOverlay.classList.remove('hidden');
        loadingStatusText.textContent = '파일을 읽는 중입니다...';
        setupStatus.textContent = '';
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const wordsData = JSON.parse(e.target.result);
                loadingStatusText.textContent = `총 ${wordsData.length.toLocaleString()}개의 단어를 저장 중입니다...`;
                await importDataToDB(wordsData);
                setupStatus.textContent = '✅ 설정 완료!';
                setTimeout(() => { location.reload(); }, 1500);
            } catch (err) {
                setupStatus.textContent = '오류: 올바른 JSON 파일이 아닙니다.';
                alert("파일 처리 오류: " + err);
                loadingOverlay.classList.add('hidden');
            }
        };
        reader.onerror = () => {
            setupStatus.textContent = '파일을 읽는 데 실패했습니다.';
            loadingOverlay.classList.add('hidden');
        };
        reader.readAsText(file);
    });
    function checkDBStatus() { return new Promise((resolve) => { if (!db) { resolve(false); return; } const tx = db.transaction(STORE_NAME, "readonly"); const store = tx.objectStore(STORE_NAME); const countReq = store.count(); countReq.onsuccess = () => resolve(countReq.result > 0); countReq.onerror = () => resolve(false); }); }
    function clearDB() { return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, "readwrite"); const store = tx.objectStore(STORE_NAME); const req = store.clear(); req.onsuccess = () => resolve(); req.onerror = e => reject("DB 초기화 오류: " + e.target.error); }); }
    function getWordCount() { return new Promise((resolve) => { if (!db) { resolve(0); return; } const tx = db.transaction(STORE_NAME, "readonly"); const store = tx.objectStore(STORE_NAME); const countReq = store.count(); countReq.onsuccess = () => resolve(countReq.result); countReq.onerror = () => resolve(0); }); }
    function getWordsByIds(ids) { return new Promise((resolve) => { if (!db || ids.length === 0) { resolve([]); return; } const tx = db.transaction(STORE_NAME, "readonly"); const store = tx.objectStore(STORE_NAME); const results = []; let processed = 0; ids.forEach(id => { const req = store.get(id); req.onsuccess = () => { if (req.result) results.push(req.result); processed++; if (processed === ids.length) resolve(results); }; }); }); }
    function updateFavoriteButton() { if (favorites.includes(currentWord.id)) { favoriteButton.classList.add('favorited'); favoriteButton.innerHTML = '<i class="fas fa-star"></i>'; } else { favoriteButton.classList.remove('favorited'); favoriteButton.innerHTML = '<i class="far fa-star"></i>'; } }
    function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); }, 2000); }
    function applyFontSize() { document.documentElement.style.fontSize = `${currentFontSize}px`; fontSizeDisplay.textContent = `${currentFontSize}px`; localStorage.setItem('fontSize', currentFontSize); }
    async function performSearch() { if(isFavoritesView) { isFavoritesView = false; favoritesListBtn.classList.remove('active'); } const term = searchInput.value; const words = await searchWords(term); displayWords(words); }
    searchInput.addEventListener('input', () => clearSearchBtn.classList.toggle('hidden', searchInput.value.length === 0));
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    clearSearchBtn.addEventListener('click', () => { searchInput.value = ''; clearSearchBtn.classList.add('hidden'); if(!isFavoritesView) wordListContainer.innerHTML = `<p class="placeholder">검색어를 입력하여 단어를 찾아보세요.</p>`; });
    searchBtn.addEventListener('click', performSearch);
    if (SpeechRecognition) { voiceSearchBtn.addEventListener('click', () => { const recognition = new SpeechRecognition(); recognition.lang = 'ko-KR'; recognition.onresult = (event) => { let transcript = event.results[0][0].transcript; if (transcript.endsWith('.')) { transcript = transcript.slice(0, -1); } searchInput.value = transcript; clearSearchBtn.classList.remove('hidden'); performSearch(); }; recognition.start(); }); } else { voiceSearchBtn.style.display = 'none'; }
    backButton.addEventListener('click', () => { history.back(); });
    flashcard.addEventListener('click', () => flashcard.classList.toggle('flipped'));
    favoriteButton.addEventListener('click', () => { const wordId = currentWord.id; const index = favorites.indexOf(wordId); if (index > -1) { favorites.splice(index, 1); showToast('즐겨찾기에서 삭제되었습니다.'); } else { favorites.push(wordId); showToast('즐겨찾기에 추가되었습니다.'); } localStorage.setItem('favorites', JSON.stringify(favorites)); updateFavoriteButton(); });
    favoritesListBtn.addEventListener('click', async () => { isFavoritesView = !isFavoritesView; favoritesListBtn.classList.toggle('active', isFavoritesView); searchInput.value = ''; clearSearchBtn.classList.add('hidden'); if (isFavoritesView) { const favoriteWords = await getWordsByIds(favorites); displayWords(favoriteWords); } else { wordListContainer.innerHTML = `<p class="placeholder">검색어를 입력하여 단어를 찾아보세요.</p>`; } });
    settingsBtn.addEventListener('click', async () => { const count = await getWordCount(); wordCountDisplay.textContent = `${count.toLocaleString()}개 단어`; settingsModal.classList.remove('hidden'); });
    closeModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });
    resetDataBtn.addEventListener('click', async () => { if (confirm('정말로 모든 단어와 즐겨찾기 데이터를 삭제하시겠습니까?')) { try { await clearDB(); localStorage.clear(); showToast('모든 데이터가 초기화되었습니다.'); location.reload(); } catch (error) { alert(error); } } });
    increaseFontBtn.addEventListener('click', () => { currentFontSize = Math.min(45, currentFontSize + 1); applyFontSize(); });
    decreaseFontBtn.addEventListener('click', () => { currentFontSize = Math.max(12, currentFontSize - 1); applyFontSize(); });
    async function init() {
        applyFontSize();
        try {
            await openDB();
            const isDataReady = await checkDBStatus();
            if (isDataReady) { showView('main'); } else { showView('setup'); }
            history.replaceState({ view: 'main' }, '', location.pathname);
        } catch (error) {
            alert("앱 초기화 오류: " + error);
            document.body.innerHTML = "<h1>앱 로딩 실패</h1><p>앱 데이터를 초기화하고 다시 시도해주세요.</p>";
        }
    }
    window.addEventListener('popstate', async (event) => { if (!event.state || event.state.view === 'main') { showView('main'); if (isFavoritesView) { const favoriteWords = await getWordsByIds(favorites); displayWords(favoriteWords); } } });
    init();
});