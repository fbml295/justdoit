// =============================================================
// ĐĂNG NHẬP GOOGLE (OAuth2 qua Google Identity Services)
// Cấp quyền truy cập trực tiếp Google Sheets + Google Drive từ trình duyệt,
// không cần Apps Script Web App trung gian nữa.
// =============================================================

const GOOGLE_OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
].join(' ');

const LS_GOOGLE_TOKEN = 'wms_google_token';

let googleAccessToken = null;   // access token OAuth hiện tại
let googleTokenClient = null;   // token client của Google Identity Services
let googleUserProfile = null;   // { name, email, picture, ... }

// Gọi 1 lần khi trang tải xong (boot()), sau khi thư viện GIS (accounts.google.com/gsi/client) đã sẵn sàng
function initGoogleAuth() {
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
        console.warn('Google Identity Services chưa sẵn sàng — kiểm tra lại kết nối mạng hoặc script gsi/client trong index.html.');
        setTimeout(initGoogleAuth, 500); // thử lại sau nửa giây, phòng trường hợp script CDN tải chậm
        return;
    }

    googleTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.CLIENT_ID,
        scope: GOOGLE_OAUTH_SCOPES,
        callback: async (response) => {
            if (response.error) {
                showNotification('Đăng nhập Google thất bại: ' + response.error, 'error');
                return;
            }
            googleAccessToken = response.access_token;
            localStorage.setItem(LS_GOOGLE_TOKEN, JSON.stringify({
                token: response.access_token,
                expiresAt: Date.now() + (Number(response.expires_in || 3500) * 1000)
            }));

            await fetchGoogleUserProfile();
            updateGoogleAuthUI();
            showNotification('Đăng nhập Google thành công! Đang tìm Google Sheet trong thư mục đã cấu hình...', 'success');

            const spreadsheetId = await initSpreadsheetTarget();
            if (spreadsheetId) {
                state.sheetsUrl = spreadsheetId; // tái sử dụng field này làm cờ "đã kết nối" (xem ghi chú trong state.js)
                updateStorageModeUI(true);
                await forceLoadFromSheets();
            }
        }
    });

    restoreGoogleSession();
}

// Bấm nút "Đăng nhập Google"
function signInWithGoogle() {
    if (!googleTokenClient) {
        showNotification('Google Identity Services chưa sẵn sàng, thử tải lại trang.', 'error');
        return;
    }
    // Lần đầu (chưa có token) -> bắt buộc hiện màn hình đồng ý quyền truy cập.
    // Các lần sau (token hết hạn) -> xin lại token âm thầm nếu có thể.
    googleTokenClient.requestAccessToken({ prompt: googleAccessToken ? '' : 'consent' });
}

// Bấm nút "Đăng xuất"
function signOutGoogle() {
    if (googleAccessToken && window.google?.accounts?.oauth2?.revoke) {
        google.accounts.oauth2.revoke(googleAccessToken, () => {});
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

// Khôi phục phiên đăng nhập cũ (nếu token đã lưu còn hạn) khi mở lại trang
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

// Cập nhật nút Đăng nhập/Đăng xuất + tên/ảnh người dùng trong tab Kết Nối API
function updateGoogleAuthUI() {
    const signedIn = !!googleAccessToken;
    const signInBtn  = document.getElementById('btn-google-signin');
    const signOutBtn = document.getElementById('btn-google-signout');
    const nameEl     = document.getElementById('google-user-name');
    const emailEl    = document.getElementById('google-user-email');
    const avatarEl   = document.getElementById('google-user-avatar');

    if (signInBtn)  signInBtn.classList.toggle('hidden', signedIn);
    if (signOutBtn) signOutBtn.classList.toggle('hidden', !signedIn);
    if (nameEl)  nameEl.textContent  = googleUserProfile ? googleUserProfile.name  : '';
    if (emailEl) emailEl.textContent = googleUserProfile ? googleUserProfile.email : '';
    if (avatarEl) {
        const hasPic = !!(googleUserProfile && googleUserProfile.picture);
        avatarEl.classList.toggle('hidden', !hasPic);
        if (hasPic) avatarEl.src = googleUserProfile.picture;
    }
}
