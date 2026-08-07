// =============================================================
// ĐĂNG NHẬP GOOGLE (gộp 1 bước) + GIỮ PHIÊN ĐĂNG NHẬP BỀN VỮNG
//
// Vấn đề cũ: access token chỉ sống 1h, sau đó hết hạn và mất kết nối.
// Giải pháp:
// 1. Lưu email + expiresAt vào localStorage để nhận biết "đã đăng nhập, chưa đăng xuất"
//    ngay cả khi token đã hết hạn (phân biệt với "chưa từng đăng nhập").
// 2. Khi mở lại trang: nếu token còn hạn -> dùng ngay; nếu hết hạn nhưng có email đã lưu
//    -> tự động xin lại token âm thầm (silent re-auth, không cần bấm gì).
// 3. Timer thử làm mới token trước khi hết hạn 5 phút — CHỈ THỬ 1 LẦN, im lặng.
//
// QUAN TRỌNG — vì sao KHÔNG tự động thử lại liên tục khi refresh ngầm thất bại:
// Khi trình duyệt chặn cookie bên thứ 3 (Safari, Chrome/Firefox chế độ chống theo dõi
// mạnh, Brave...), Google KHÔNG THỂ làm mới token hoàn toàn im lặng — nó cần hiện 1
// cửa sổ xác nhận thật. Nếu ta cứ tự động gọi lại requestAccessToken() từ code (không
// phải từ 1 cú bấm chuột thật của người dùng), cửa sổ đó sẽ bật ra BẤT NGỜ giữa lúc
// đang thao tác — đúng hiện tượng "tự nhảy ra trang đăng nhập Google". Trình duyệt chỉ
// đảm bảo KHÔNG chặn popup khi nó được mở trực tiếp từ 1 sự kiện click thật. Vì vậy,
// nếu refresh ngầm thất bại, ta KHÔNG thử lại tự động — chỉ hiện 1 banner nhỏ mời người
// dùng bấm nút, và popup chỉ mở ra từ trong đúng hàm xử lý click đó.
// =============================================================

const GOOGLE_OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/tasks'
].join(' ');

const LS_GOOGLE_TOKEN   = 'wms_google_token';
const LS_GOOGLE_SESSION = 'wms_google_session'; // chứa { email } — tồn tại tới khi bấm Đăng xuất

let googleAccessToken = null;
let googleTokenClient = null;
let googleUserProfile = null;
let _tokenRefreshTimer = null;       // timer thử refresh trước khi hết hạn (chỉ thử 1 lần, im lặng)
let _silentRefreshResolvers = [];    // danh sách Promise đang chờ silent refresh
let _silentRefreshInFlight = false;  // chặn gọi chồng nhiều silent refresh cùng lúc

// --- Hiện/ẩn màn hình chặn ---
function showAppContent() {
    document.getElementById('login-gate')?.classList.add('hidden');
    document.getElementById('app-main-content')?.classList.remove('hidden');
}
function showLoginGate() {
    document.getElementById('app-main-content')?.classList.add('hidden');
    document.getElementById('login-gate')?.classList.remove('hidden');
}
function setLoginGateLoading(text) {
    const el = document.getElementById('login-gate-loading');
    if (!el) return;
    if (text) { el.classList.remove('hidden'); el.textContent = text; }
    else el.classList.add('hidden');
}

// --- Banner "Cần xác thực lại" — chỉ hiện khi refresh ngầm thất bại, KHÔNG tự bấm hộ ---
function showReauthBanner() {
    const banner = document.getElementById('reauth-banner');
    if (banner) { banner.classList.remove('hidden'); return; }
    // Tạo động nếu HTML chưa có sẵn (phòng trường hợp index.html chưa cập nhật kịp)
    const el = document.createElement('div');
    el.id = 'reauth-banner';
    el.className = 'fixed top-3 left-1/2 -translate-x-1/2 z-[500] bg-[#14161C] border border-amber-500/50 rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-3';
    el.innerHTML = `
        <span class="text-xs text-amber-400">🔑 Phiên đăng nhập Google cần xác thực lại</span>
        <button id="reauth-banner-btn" class="text-xs px-3 py-1.5 rounded-lg bg-[#B6FF2E] text-[#14161C] font-bold hover:opacity-90">Xác Thực Lại</button>
    `;
    document.body.appendChild(el);
    document.getElementById('reauth-banner-btn').onclick = handleReauthClick;
}
function hideReauthBanner() {
    document.getElementById('reauth-banner')?.classList.add('hidden');
}
// Được gọi TRỰC TIẾP từ sự kiện click (không qua await/setTimeout trước đó) -> trình
// duyệt luôn coi đây là user gesture hợp lệ -> popup Google không bao giờ bị chặn.
function handleReauthClick() {
    hideReauthBanner();
    if (!googleTokenClient) { showNotification('Google Identity Services chưa sẵn sàng, thử tải lại trang.', 'error'); return; }
    googleTokenClient.requestAccessToken({ prompt: '' });
}

function isClientIdConfigured() {
    const id = (GOOGLE_CONFIG.CLIENT_ID || '').trim();
    return !!id && !id.startsWith('DÁN_') && id.endsWith('.apps.googleusercontent.com');
}

// --- Khởi tạo ---
function initGoogleAuth() {
    if (!window.google?.accounts?.oauth2) {
        setTimeout(initGoogleAuth, 500);
        return;
    }
    if (!isClientIdConfigured()) {
        setLoginGateLoading(null);
        showGoogleConfigError('Chưa điền CLIENT_ID hợp lệ trong file js/google-config.js (xem README.md).');
        return;
    }

    googleTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.CLIENT_ID,
        scope: GOOGLE_OAUTH_SCOPES,
        callback: handleGoogleTokenResponse
    });

    setLoginGateLoading(null);
    restoreGoogleSession();
}

// --- Đăng nhập (bấm nút — luôn là user gesture thật, an toàn 100% với popup blocker) ---
function signInWithGoogle() {
    if (!googleTokenClient) {
        showNotification('Google Identity Services chưa sẵn sàng, thử tải lại trang.', 'error');
        return;
    }
    hideReauthBanner();
    const session = _getSession();
    googleTokenClient.requestAccessToken({ prompt: session ? '' : 'consent' });
}

// --- Xử lý token nhận về (cả lần đầu lẫn silent refresh) ---
async function handleGoogleTokenResponse(response) {
    if (response.error) {
        _silentRefreshInFlight = false;
        // silent refresh thất bại -> KHÔNG tự thử lại (tránh popup bất ngờ lần nữa),
        // chỉ hiện banner mời người dùng chủ động bấm khi tiện.
        if (_silentRefreshResolvers.length > 0) {
            _silentRefreshResolvers.forEach(r => r.reject(new Error(response.error)));
            _silentRefreshResolvers = [];
            console.warn('[Auth] Refresh ngầm thất bại (' + response.error + ') — hiện banner mời xác thực lại thay vì tự thử lại.');
            showReauthBanner();
        } else {
            showGoogleConfigError('Đăng nhập Google thất bại: ' + response.error);
        }
        return;
    }

    hideReauthBanner();
    const expiresIn = Number(response.expires_in || 3500);
    googleAccessToken = response.access_token;

    localStorage.setItem(LS_GOOGLE_TOKEN, JSON.stringify({
        token: response.access_token,
        expiresAt: Date.now() + expiresIn * 1000
    }));

    // Đặt timer thử refresh ngầm 1 LẦN trước khi hết hạn 5 phút — không lặp lại nếu thất bại
    _scheduleTokenRefresh(expiresIn);

    if (_silentRefreshResolvers.length > 0) {
        _silentRefreshInFlight = false;
        _silentRefreshResolvers.forEach(r => r.resolve(googleAccessToken));
        _silentRefreshResolvers = [];
        console.log('[Auth] Refresh ngầm thành công.');
        return;
    }

    // Lần đăng nhập thật (người dùng bấm nút) -> tiếp tục luồng khởi động đầy đủ
    setLoginGateLoading('⏳ Đang lấy thông tin tài khoản...');
    await fetchGoogleUserProfile();
    if (googleUserProfile) {
        _saveSession(googleUserProfile.email);
    }
    updateGoogleAuthUI();

    setLoginGateLoading('⏳ Đang tìm file Google Sheet...');
    const spreadsheetId = await initSpreadsheetTarget();
    if (spreadsheetId) {
        state.sheetsUrl = spreadsheetId;
        updateStorageModeUI(true);
        setLoginGateLoading('⏳ Đang tải dữ liệu...');
        await forceLoadFromSheets();
        setLoginGateLoading(null);
        showAppContent();
    } else {
        setLoginGateLoading(null);
    }
}

// --- Timer thử refresh 1 LẦN duy nhất trước khi hết hạn (không tự lặp lại nếu thất bại) ---
function _scheduleTokenRefresh(expiresInSeconds) {
    clearTimeout(_tokenRefreshTimer);
    const refreshAfterMs = Math.max((expiresInSeconds - 300) * 1000, 10000); // trước 5 phút, ít nhất 10s
    _tokenRefreshTimer = setTimeout(() => {
        console.log('[Auth] Token sắp hết hạn, thử refresh ngầm (1 lần)...');
        _doSilentRefresh().catch(e => {
            // Đã hiện banner trong handleGoogleTokenResponse rồi, ở đây chỉ log, KHÔNG đặt lại timer
            console.warn('[Auth] Refresh ngầm theo lịch thất bại:', e.message);
        });
    }, refreshAfterMs);
}

// Thử xin token âm thầm (prompt=''). Nếu cookie bên thứ 3 bị chặn, Google có thể cần
// hiện cửa sổ thật -> lúc đó callback sẽ trả lỗi thay vì token, KHÔNG có popup ẩn nào
// hiện ra ngoài ý muốn từ chính lệnh gọi này.
function _doSilentRefresh() {
    return new Promise((resolve, reject) => {
        if (!googleTokenClient) { reject(new Error('tokenClient chưa sẵn sàng')); return; }
        if (_silentRefreshInFlight) { _silentRefreshResolvers.push({ resolve, reject }); return; } // gộp các lời gọi trùng lúc
        _silentRefreshInFlight = true;
        _silentRefreshResolvers.push({ resolve, reject });
        googleTokenClient.requestAccessToken({ prompt: '' });
    });
}

// --- Khôi phục phiên khi mở lại trang ---
async function restoreGoogleSession() {
    const session = _getSession(); // { email } nếu chưa đăng xuất, null nếu chưa từng đăng nhập hoặc đã đăng xuất
    if (!session) {
        setLoginGateLoading(null); // chưa từng đăng nhập -> hiện nút đăng nhập, không làm gì thêm
        return;
    }

    // Có session -> người dùng đã đăng nhập trước đó, chưa bấm Đăng xuất
    setLoginGateLoading('⏳ Đang khôi phục phiên đăng nhập (' + session.email + ')...');

    // Thử dùng token đã lưu trước (nếu còn hạn)
    const raw = localStorage.getItem(LS_GOOGLE_TOKEN);
    if (raw) {
        try {
            const saved = JSON.parse(raw);
            if (saved.token && saved.expiresAt > Date.now() + 60000) { // còn hơn 1 phút
                googleAccessToken = saved.token;
                const remainingSec = Math.round((saved.expiresAt - Date.now()) / 1000);
                _scheduleTokenRefresh(remainingSec);
                console.log('[Auth] Dùng lại token cũ, còn hạn trong', remainingSec, 'giây.');
                await _continueRestoreSession();
                return;
            }
        } catch (e) { /* bỏ qua, xuống silent refresh */ }
    }

    // Token hết hạn nhưng session còn -> thử silent refresh 1 LẦN (đây là lúc mở trang,
    // chưa vào app, nên popup nếu có hiện ra ở đây là hợp lý/dễ hiểu, không "bất ngờ")
    console.log('[Auth] Token hết hạn, thử silent refresh...');
    setLoginGateLoading('⏳ Đang làm mới phiên đăng nhập...');
    try {
        await _doSilentRefresh();
        await _continueRestoreSession();
    } catch (e) {
        console.warn('[Auth] Silent refresh thất bại:', e.message, '— cần đăng nhập lại.');
        setLoginGateLoading(null);
        showGoogleConfigError('Phiên đăng nhập cần xác thực lại (trình duyệt có thể đang chặn cookie bên thứ 3 của Google). Vui lòng bấm "Đăng Nhập Bằng Google" để tiếp tục.');
        _clearSession(); // bỏ session cũ đã hết
    }
}

// Sau khi đã có token hợp lệ, hoàn thành nốt luồng khôi phục phiên
async function _continueRestoreSession() {
    await fetchGoogleUserProfile();
    if (googleUserProfile) _saveSession(googleUserProfile.email);
    updateGoogleAuthUI();

    const spreadsheetId = await initSpreadsheetTarget();
    if (spreadsheetId) {
        state.sheetsUrl = spreadsheetId;
        updateStorageModeUI(true);
        setLoginGateLoading('⏳ Đang tải dữ liệu...');
        await forceLoadFromSheets();
        setLoginGateLoading(null);
        showAppContent();
    } else {
        setLoginGateLoading(null);
    }
}

// --- Đăng xuất ---
function signOutGoogle() {
    clearTimeout(_tokenRefreshTimer);
    hideReauthBanner();
    if (googleAccessToken && window.google?.accounts?.oauth2?.revoke) {
        google.accounts.oauth2.revoke(googleAccessToken, () => {});
    }
    googleAccessToken = null;
    googleUserProfile = null;
    activeSpreadsheetId = null;
    activeSpreadsheetName = null;
    state.sheetsUrl = '';
    localStorage.removeItem(LS_GOOGLE_TOKEN);
    _clearSession();
    updateGoogleAuthUI();
    updateStorageModeUI(false);
    showLoginGate();
    showNotification('Đã đăng xuất Google.', 'success');
}

// --- Lấy thông tin user ---
async function fetchGoogleUserProfile() {
    if (!googleAccessToken) return;
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + googleAccessToken }
        });
        if (res.ok) googleUserProfile = await res.json();
    } catch (e) {
        console.warn('[Auth] Không lấy được thông tin tài khoản:', e);
    }
}

// --- Session (lưu vĩnh viễn tới khi đăng xuất, dùng để nhận biết "chưa đăng xuất") ---
function _saveSession(email)  { try { localStorage.setItem(LS_GOOGLE_SESSION, JSON.stringify({ email })); } catch (e) {} }
function _clearSession()      { localStorage.removeItem(LS_GOOGLE_SESSION); }
function _getSession()        { try { return JSON.parse(localStorage.getItem(LS_GOOGLE_SESSION) || 'null'); } catch (e) { return null; } }

// --- Wrapper gọi API: thử refresh ngầm 1 lần nếu 401, KHÔNG tự lặp lại nếu thất bại ---
// driveApiFetch (trong google-drive-api.js) gọi hàm này; google-tasks-api cũng dùng chung.
async function _apiFetchWithAutoRefresh(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + googleAccessToken });
    let res = await fetch(url, options);

    if (res.status === 401) {
        console.warn('[Auth] 401 khi gọi API, thử refresh ngầm...');
        try {
            const newToken = await _doSilentRefresh();
            options.headers['Authorization'] = 'Bearer ' + newToken;
            res = await fetch(url, options); // retry 1 lần với token mới
        } catch (refreshErr) {
            // Không tự mở popup ở đây (tránh popup bất ngờ) — chỉ hiện banner mời bấm tay
            showReauthBanner();
            throw new Error('Unauthorized (401) — cần xác thực lại Google (xem banner phía trên)');
        }
    }
    return res;
}

// --- Hiện lỗi rõ ràng ---
function showGoogleConfigError(message) {
    showNotification(message, 'error');
    const mainHidden = document.getElementById('app-main-content')?.classList.contains('hidden');
    const boxId = mainHidden ? 'login-gate-status' : 'sheets-test-result';
    const resultBox = document.getElementById(boxId);
    if (resultBox) {
        resultBox.classList.remove('hidden');
        resultBox.className = 'text-[11px] p-3 rounded-xl bg-[#23262F] border border-rose-500/50 text-rose-400 font-mono whitespace-pre-wrap' + (boxId === 'login-gate-status' ? ' text-left' : '');
        resultBox.textContent = '❌ ' + message;
    }
}

// --- Cập nhật UI hiển thị tên/ảnh người dùng ---
function updateGoogleAuthUI() {
    const signedIn = !!googleUserProfile;
    const signOutBtn = document.getElementById('btn-google-signout');
    const nameEl     = document.getElementById('google-user-name');
    const emailEl    = document.getElementById('google-user-email');
    const avatarEl   = document.getElementById('google-user-avatar');

    if (signOutBtn) signOutBtn.classList.toggle('hidden', !signedIn);
    if (nameEl)  nameEl.textContent  = googleUserProfile?.name  || '';
    if (emailEl) emailEl.textContent = googleUserProfile?.email || '';
    if (avatarEl) {
        const hasPic = !!googleUserProfile?.picture;
        avatarEl.classList.toggle('hidden', !hasPic);
        if (hasPic) avatarEl.src = googleUserProfile.picture;
    }
}

