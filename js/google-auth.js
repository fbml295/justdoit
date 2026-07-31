// =============================================================
// ĐĂNG NHẬP GOOGLE (gộp 1 bước) + CHẶN MÀN HÌNH CHÍNH (login gate)
// Dùng google.accounts.oauth2 (OAuth2 token client) để vừa đăng nhập vừa xin quyền
// truy cập Sheets/Drive trong CÙNG 1 cửa sổ Google — chỉ hiện 1 lần, không hỏi 2 lần.
// Chỉ khi đăng nhập xong VÀ tìm thấy đúng file Google Sheet trong thư mục đã cấu hình,
// nội dung chính của app (#app-main-content) mới được hiện ra. Trước đó, người dùng
// luôn thấy màn hình chặn #login-gate.
// =============================================================

const GOOGLE_OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/tasks'
].join(' ');

const LS_GOOGLE_TOKEN = 'wms_google_token';

let googleAccessToken = null;   // access token OAuth hiện tại (dùng gọi Sheets/Drive API)
let googleTokenClient = null;   // token client của Google Identity Services (xin access token)
let googleUserProfile = null;   // { name, email, picture, ... }

// --- Hiện/ẩn màn hình chặn vs. nội dung chính ---
function showAppContent() {
    const gate = document.getElementById('login-gate');
    const main = document.getElementById('app-main-content');
    if (gate) gate.classList.add('hidden');
    if (main) main.classList.remove('hidden');
}

function showLoginGate() {
    const gate = document.getElementById('login-gate');
    const main = document.getElementById('app-main-content');
    if (main) main.classList.add('hidden');
    if (gate) gate.classList.remove('hidden');
}

function setLoginGateLoading(text) {
    const el = document.getElementById('login-gate-loading');
    if (!el) return;
    if (text) { el.classList.remove('hidden'); el.textContent = text; }
    else { el.classList.add('hidden'); }
}

// Client ID chưa được điền / còn để nguyên placeholder trong js/google-config.js
function isClientIdConfigured() {
    const id = (GOOGLE_CONFIG.CLIENT_ID || '').trim();
    return !!id && !id.startsWith('DÁN_') && id.endsWith('.apps.googleusercontent.com');
}

// Gọi 1 lần khi trang tải xong (boot()), sau khi thư viện GIS (accounts.google.com/gsi/client) đã sẵn sàng
function initGoogleAuth() {
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
        setTimeout(initGoogleAuth, 500); // script CDN có thể tải chậm hơn, thử lại sau nửa giây
        return;
    }

    if (!isClientIdConfigured()) {
        setLoginGateLoading(null);
        showGoogleConfigError('Chưa điền CLIENT_ID hợp lệ trong file js/google-config.js (xem README.md, mục "Thiết lập Google").');
        return;
    }

    // Token client: 1 cửa sổ Google duy nhất, vừa chọn tài khoản vừa xin quyền Sheets/Drive
    googleTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.CLIENT_ID,
        scope: GOOGLE_OAUTH_SCOPES,
        callback: handleGoogleTokenResponse
    });

    setLoginGateLoading(null); // sẵn sàng -> ẩn chữ "Đang chuẩn bị...", hiện nút bấm
    restoreGoogleSession();
}

// Bấm nút "Đăng Nhập Bằng Google" ở màn hình chặn (hoặc nút dự phòng trong tab Cấu Hình)
function signInWithGoogle() {
    if (!googleTokenClient) {
        showNotification('Google Identity Services chưa sẵn sàng, thử tải lại trang.', 'error');
        return;
    }
    googleTokenClient.requestAccessToken({ prompt: googleAccessToken ? '' : 'consent' });
}

// Đã có access token (đủ quyền Sheets/Drive) -> lấy thông tin tài khoản, tìm file Sheet
// và tải dữ liệu. CHỈ khi bước này xong xuôi, nội dung chính của app mới được hiện ra.
async function handleGoogleTokenResponse(response) {
    if (response.error) {
        showGoogleConfigError('Đăng nhập/cấp quyền Google thất bại: ' + response.error
            + '. Kiểm tra lại CLIENT_ID trong js/google-config.js và Authorized JavaScript origins trong Google Cloud Console.');
        return;
    }
    googleAccessToken = response.access_token;
    localStorage.setItem(LS_GOOGLE_TOKEN, JSON.stringify({
        token: response.access_token,
        expiresAt: Date.now() + (Number(response.expires_in || 3500) * 1000)
    }));

    setLoginGateLoading('⏳ Đăng nhập thành công, đang lấy thông tin tài khoản...');
    await fetchGoogleUserProfile();
    updateGoogleAuthUI();

    setLoginGateLoading('⏳ Đang tìm file Google Sheet trong thư mục đã cấu hình...');
    const spreadsheetId = await initSpreadsheetTarget();
    if (spreadsheetId) {
        state.sheetsUrl = spreadsheetId; // tái sử dụng field này làm cờ "đã kết nối" (xem ghi chú trong state.js)
        updateStorageModeUI(true);
        setLoginGateLoading('⏳ Đang tải dữ liệu...');
        await forceLoadFromSheets();
        setLoginGateLoading(null);
        showAppContent(); // MỞ KHOÁ nội dung chính — chỉ tới đây mới cho xem app
    } else {
        setLoginGateLoading(null); // showGoogleConfigError() (gọi trong initSpreadsheetTarget) đã hiện lý do cụ thể
    }
}

// Bấm nút "Đăng xuất" (trong tab Cấu Hình) -> khoá lại app, hiện màn hình chặn
function signOutGoogle() {
    if (googleAccessToken && window.google?.accounts?.oauth2?.revoke) {
        google.accounts.oauth2.revoke(googleAccessToken, () => {});
    }
    googleAccessToken = null;
    googleUserProfile = null;
    activeSpreadsheetId = null;
    activeSpreadsheetName = null;
    state.sheetsUrl = '';
    localStorage.removeItem(LS_GOOGLE_TOKEN);
    updateGoogleAuthUI();
    updateStorageModeUI(false);
    showLoginGate();
    showNotification('Đã đăng xuất Google.', 'success');
}

// Khôi phục phiên đăng nhập cũ (nếu access token đã lưu còn hạn) khi mở lại trang
function restoreGoogleSession() {
    const raw = localStorage.getItem(LS_GOOGLE_TOKEN);
    if (!raw) {
        setLoginGateLoading(null);
        return;
    }
    try {
        const saved = JSON.parse(raw);
        if (saved.token && saved.expiresAt > Date.now()) {
            googleAccessToken = saved.token;
            setLoginGateLoading('⏳ Đang khôi phục phiên đăng nhập trước đó...');
            fetchGoogleUserProfile().then(async () => {
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
            });
        } else {
            localStorage.removeItem(LS_GOOGLE_TOKEN);
            setLoginGateLoading(null);
        }
    } catch (e) {
        setLoginGateLoading(null);
    }
}

async function fetchGoogleUserProfile() {
    if (!googleAccessToken) return;
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + googleAccessToken }
        });
        if (res.ok) googleUserProfile = await res.json();
    } catch (e) {
        console.warn('Không lấy được thông tin người dùng Google:', e);
    }
}

// Hiện lỗi rõ ràng — nếu app CHƯA mở khoá (còn đang ở màn hình chặn) thì hiện ngay tại
// đó; nếu app ĐÃ mở khoá rồi (đang ở trong tab Kết Nối API) thì hiện trong ô kết quả
// của tab đó, đỡ phải khoá lại app chỉ vì 1 lỗi nhỏ khi thao tác sau này (ví dụ bấm
// "Tải Lại Từ Sheets" mà token vừa hết hạn).
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

// Cập nhật hiển thị tên/ảnh người dùng + nút đăng xuất trong tab Kết Nối API
function updateGoogleAuthUI() {
    const signedIn = !!googleUserProfile;
    const signOutBtn = document.getElementById('btn-google-signout');
    const nameEl     = document.getElementById('google-user-name');
    const emailEl    = document.getElementById('google-user-email');
    const avatarEl   = document.getElementById('google-user-avatar');

    if (signOutBtn) signOutBtn.classList.toggle('hidden', !signedIn);
    if (nameEl)  nameEl.textContent  = googleUserProfile ? googleUserProfile.name  : '';
    if (emailEl) emailEl.textContent = googleUserProfile ? googleUserProfile.email : '';
    if (avatarEl) {
        const hasPic = !!(googleUserProfile && googleUserProfile.picture);
        avatarEl.classList.toggle('hidden', !hasPic);
        if (hasPic) avatarEl.src = googleUserProfile.picture;
    }
}
