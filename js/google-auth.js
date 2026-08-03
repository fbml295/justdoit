// =============================================================
// ĐĂNG NHẬP GOOGLE (gộp 1 bước) + GIỮ PHIÊN ĐĂNG NHẬP BỀN VỮNG
//
// Vấn đề cũ: access token chỉ sống 1h, sau đó hết hạn và mất kết nối.
// Giải pháp:
// 1. Lưu email + expiresAt vào localStorage để nhận biết "đã đăng nhập, chưa đăng xuất"
//    ngay cả khi token đã hết hạn (phân biệt với "chưa từng đăng nhập").
// 2. Khi mở lại trang: nếu token còn hạn -> dùng ngay; nếu hết hạn nhưng có email đã lưu
//    -> tự động xin lại token âm thầm (silent re-auth, không cần bấm gì).
// 3. Timer tự động xin lại token mới trước khi hết hạn 5 phút (liên tục trong phiên làm việc).
// 4. Khi gọi API gặp lỗi 401 -> tự refresh token rồi gọi lại thay vì văng lỗi ra ngoài.
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
let _tokenRefreshTimer = null;       // timer tự refresh trước khi hết hạn
let _silentRefreshResolvers = [];    // danh sách Promise đang chờ silent refresh

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

// --- Đăng nhập (bấm nút) ---
function signInWithGoogle() {
    if (!googleTokenClient) {
        showNotification('Google Identity Services chưa sẵn sàng, thử tải lại trang.', 'error');
        return;
    }
    // prompt='consent' lần đầu (chưa từng đăng nhập), '' các lần sau (đã có session trình duyệt)
    const session = _getSession();
    googleTokenClient.requestAccessToken({ prompt: session ? '' : 'consent' });
}

// --- Xử lý token nhận về (cả lần đầu lẫn silent refresh) ---
async function handleGoogleTokenResponse(response) {
    if (response.error) {
        // silent refresh thất bại (session trình duyệt đã hết) -> mất phiên
        if (_silentRefreshResolvers.length > 0) {
            _silentRefreshResolvers.forEach(r => r.reject(new Error(response.error)));
            _silentRefreshResolvers = [];
        } else {
            showGoogleConfigError('Đăng nhập Google thất bại: ' + response.error);
        }
        return;
    }

    const expiresIn = Number(response.expires_in || 3500);
    googleAccessToken = response.access_token;

    // Lưu token (có ttl) và session (vĩnh viễn tới khi đăng xuất)
    localStorage.setItem(LS_GOOGLE_TOKEN, JSON.stringify({
        token: response.access_token,
        expiresAt: Date.now() + expiresIn * 1000
    }));

    // Đặt timer refresh token trước 5 phút để không bao giờ hết hạn trong lúc đang dùng
    _scheduleTokenRefresh(expiresIn);

    // Nếu đây là luồng silent refresh (có resolver đang chờ) -> giải phóng tất cả
    if (_silentRefreshResolvers.length > 0) {
        _silentRefreshResolvers.forEach(r => r.resolve(googleAccessToken));
        _silentRefreshResolvers = [];
        console.log('[Auth] Silent refresh thành công.');
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

// --- Timer tự refresh ---
function _scheduleTokenRefresh(expiresInSeconds) {
    clearTimeout(_tokenRefreshTimer);
    const refreshAfterMs = Math.max((expiresInSeconds - 300) * 1000, 10000); // refresh trước 5 phút, ít nhất 10s
    _tokenRefreshTimer = setTimeout(() => {
        console.log('[Auth] Token sắp hết hạn, đang tự refresh...');
        _doSilentRefresh().catch(e => console.warn('[Auth] Auto-refresh thất bại:', e));
    }, refreshAfterMs);
}

// Xin lại token âm thầm — không hiện cửa sổ nào nếu session trình duyệt còn sống.
// Trả về Promise<token> để driveApiFetch() dùng khi gặp 401 (retry ngay sau khi có token mới).
function _doSilentRefresh() {
    return new Promise((resolve, reject) => {
        if (!googleTokenClient) { reject(new Error('tokenClient chưa sẵn sàng')); return; }
        _silentRefreshResolvers.push({ resolve, reject });
        // prompt='' -> Google không hỏi lại người dùng nếu session còn sống
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

    // Token hết hạn nhưng session còn -> silent refresh (không hiện cửa sổ)
    console.log('[Auth] Token hết hạn, thử silent refresh...');
    setLoginGateLoading('⏳ Đang làm mới phiên đăng nhập...');
    try {
        await _doSilentRefresh();
        await _continueRestoreSession();
    } catch (e) {
        // Session trình duyệt cũng hết (hiếm, thường sau nhiều ngày không dùng) -> cần đăng nhập lại
        console.warn('[Auth] Silent refresh thất bại:', e.message, '— cần đăng nhập lại.');
        setLoginGateLoading(null);
        showGoogleConfigError('Phiên đăng nhập đã hết. Vui lòng bấm "Đăng Nhập Bằng Google" để tiếp tục.');
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

// --- Wrapper gọi API với tự động retry 1 lần khi gặp 401 (token vừa hết hạn) ---
// driveApiFetch (trong google-drive-api.js) gọi hàm này; google-tasks-api cũng dùng chung.
async function _apiFetchWithAutoRefresh(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + googleAccessToken });
    let res = await fetch(url, options);

    if (res.status === 401) {
        console.warn('[Auth] 401 khi gọi API, thử silent refresh...');
        try {
            const newToken = await _doSilentRefresh();
            options.headers['Authorization'] = 'Bearer ' + newToken;
            res = await fetch(url, options); // retry 1 lần với token mới
        } catch (refreshErr) {
            showNotification('Phiên đăng nhập hết hạn. Vui lòng bấm "Đăng Nhập Bằng Google" để tiếp tục.', 'error');
            throw new Error('Unauthorized (401) — không thể refresh token');
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
