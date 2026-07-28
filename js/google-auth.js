// =============================================================
// ĐĂNG NHẬP GOOGLE
// Bước 1: dùng ĐÚNG nút chính thức "Sign in with Google" (google.accounts.id) để xác
//         thực danh tính người dùng — nút này do Google tự vẽ ra, không phải nút tự
//         thiết kế, nên ổn định và quen thuộc với người dùng hơn.
// Bước 2: ngay sau khi đăng nhập xong, xin thêm quyền truy cập Sheets + Drive
//         (google.accounts.oauth2) để đọc/ghi dữ liệu — thay thế hoàn toàn Apps Script
//         Web App trung gian của bản cũ.
// =============================================================

const GOOGLE_OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
].join(' ');

const LS_GOOGLE_TOKEN = 'wms_google_token';

let googleAccessToken = null;   // access token OAuth hiện tại (dùng gọi Sheets/Drive API)
let googleTokenClient = null;   // token client của Google Identity Services (xin access token)
let googleUserProfile = null;   // { name, email, picture, ... }

// Client ID chưa được điền / còn để nguyên placeholder trong js/google-config.js
function isClientIdConfigured() {
    const id = (GOOGLE_CONFIG.CLIENT_ID || '').trim();
    return !!id && !id.startsWith('DÁN_') && id.endsWith('.apps.googleusercontent.com');
}

// Gọi 1 lần khi trang tải xong (boot()), sau khi thư viện GIS (accounts.google.com/gsi/client) đã sẵn sàng
function initGoogleAuth() {
    if (!window.google || !google.accounts || !google.accounts.id || !google.accounts.oauth2) {
        setTimeout(initGoogleAuth, 500); // script CDN có thể tải chậm hơn, thử lại sau nửa giây
        return;
    }

    if (!isClientIdConfigured()) {
        showGoogleConfigError('Chưa điền CLIENT_ID hợp lệ trong file js/google-config.js (xem README.md, mục "Thiết lập Google").');
        return;
    }

    // --- Bước 1: nút "Sign in with Google" chính thức ---
    google.accounts.id.initialize({
        client_id: GOOGLE_CONFIG.CLIENT_ID,
        callback: handleGoogleIdentityResponse,
        auto_select: false
    });

    const btnContainer = document.getElementById('g_id_signin_button');
    if (btnContainer) {
        btnContainer.innerHTML = '';
        google.accounts.id.renderButton(btnContainer, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            width: 280
        });
    }

    // --- Bước 2: token client để xin quyền Sheets/Drive (access token) ---
    googleTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.CLIENT_ID,
        scope: GOOGLE_OAUTH_SCOPES,
        callback: handleGoogleTokenResponse
    });

    restoreGoogleSession();
}

// Người dùng bấm xong nút "Sign in with Google" chính thức -> có ID token định danh
function handleGoogleIdentityResponse(response) {
    try {
        const payloadBase64 = response.credential.split('.')[1];
        const payload = JSON.parse(decodeURIComponent(escape(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')))));
        googleUserProfile = { name: payload.name, email: payload.email, picture: payload.picture };
    } catch (e) {
        console.warn('Không đọc được thông tin từ ID token Google:', e);
    }
    updateGoogleAuthUI();
    showNotification('Đăng nhập Google thành công! Đang xin quyền truy cập Sheets/Drive...', 'success');

    // Đăng nhập xong -> xin ngay quyền (access token) để đọc/ghi Sheets + Drive
    if (googleTokenClient) {
        googleTokenClient.requestAccessToken({ prompt: googleAccessToken ? '' : 'consent' });
    }
}

// Đã có access token (đủ quyền Sheets/Drive) -> tìm file Sheet và tải dữ liệu
async function handleGoogleTokenResponse(response) {
    if (response.error) {
        showGoogleConfigError('Không xin được quyền truy cập Google Sheets/Drive: ' + response.error
            + '. Kiểm tra lại CLIENT_ID trong js/google-config.js và Authorized JavaScript origins trong Google Cloud Console.');
        return;
    }
    googleAccessToken = response.access_token;
    localStorage.setItem(LS_GOOGLE_TOKEN, JSON.stringify({
        token: response.access_token,
        expiresAt: Date.now() + (Number(response.expires_in || 3500) * 1000)
    }));

    if (!googleUserProfile) await fetchGoogleUserProfile();
    updateGoogleAuthUI();

    const spreadsheetId = await initSpreadsheetTarget();
    if (spreadsheetId) {
        state.sheetsUrl = spreadsheetId; // tái sử dụng field này làm cờ "đã kết nối" (xem ghi chú trong state.js)
        updateStorageModeUI(true);
        await forceLoadFromSheets();
    }
}

// Nút dự phòng: xin lại quyền truy cập Sheets/Drive (ví dụ khi access token hết hạn
// nhưng người dùng vẫn còn đăng nhập Google trên trình duyệt)
function signInWithGoogle() {
    if (!googleTokenClient) {
        showNotification('Google Identity Services chưa sẵn sàng, thử tải lại trang.', 'error');
        return;
    }
    googleTokenClient.requestAccessToken({ prompt: googleAccessToken ? '' : 'consent' });
}

// Bấm nút "Đăng xuất"
function signOutGoogle() {
    if (googleAccessToken && window.google?.accounts?.oauth2?.revoke) {
        google.accounts.oauth2.revoke(googleAccessToken, () => {});
    }
    if (window.google?.accounts?.id?.disableAutoSelect) {
        google.accounts.id.disableAutoSelect();
    }
    googleAccessToken = null;
    googleUserProfile = null;
    activeSpreadsheetId = null;
    state.sheetsUrl = '';
    localStorage.removeItem(LS_GOOGLE_TOKEN);
    updateGoogleAuthUI();
    updateStorageModeUI(false);
    showNotification('Đã đăng xuất Google. Dữ liệu tạm thời chỉ lưu trong trình duyệt này.', 'success');
}

// Khôi phục phiên đăng nhập cũ (nếu access token đã lưu còn hạn) khi mở lại trang
function restoreGoogleSession() {
    const raw = localStorage.getItem(LS_GOOGLE_TOKEN);
    if (!raw) return;
    try {
        const saved = JSON.parse(raw);
        if (saved.token && saved.expiresAt > Date.now()) {
            googleAccessToken = saved.token;
            fetchGoogleUserProfile().then(async () => {
                updateGoogleAuthUI();
                const spreadsheetId = await initSpreadsheetTarget();
                if (spreadsheetId) {
                    state.sheetsUrl = spreadsheetId;
                    updateStorageModeUI(true);
                    await forceLoadFromSheets();
                }
            });
        } else {
            localStorage.removeItem(LS_GOOGLE_TOKEN);
        }
    } catch (e) { /* dữ liệu lưu bị hỏng, bỏ qua */ }
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

// Hiện lỗi cấu hình rõ ràng ngay trong khối kết quả của tab Kết Nối API,
// thay vì để lỗi kỹ thuật khó hiểu của Google hiện ra
function showGoogleConfigError(message) {
    showNotification(message, 'error');
    const resultBox = document.getElementById('sheets-test-result');
    if (resultBox) {
        resultBox.classList.remove('hidden');
        resultBox.className = 'text-[11px] p-3 rounded-xl bg-[#23262F] border border-rose-500/50 text-rose-400 font-mono whitespace-pre-wrap';
        resultBox.textContent = '❌ ' + message;
    }
}

// Cập nhật hiển thị tên/ảnh người dùng + nút đăng xuất trong tab Kết Nối API
function updateGoogleAuthUI() {
    const signedIn = !!googleUserProfile;
    const btnContainer = document.getElementById('g_id_signin_button');
    const signOutBtn = document.getElementById('btn-google-signout');
    const nameEl     = document.getElementById('google-user-name');
    const emailEl    = document.getElementById('google-user-email');
    const avatarEl   = document.getElementById('google-user-avatar');

    if (btnContainer) btnContainer.classList.toggle('hidden', signedIn);
    if (signOutBtn) signOutBtn.classList.toggle('hidden', !signedIn);
    if (nameEl)  nameEl.textContent  = googleUserProfile ? googleUserProfile.name  : '';
    if (emailEl) emailEl.textContent = googleUserProfile ? googleUserProfile.email : '';
    if (avatarEl) {
        const hasPic = !!(googleUserProfile && googleUserProfile.picture);
        avatarEl.classList.toggle('hidden', !hasPic);
        if (hasPic) avatarEl.src = googleUserProfile.picture;
    }
}
