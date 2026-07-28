// =============================================================
// GOOGLE DRIVE API — tìm file Google Sheet mục tiêu trong thư mục đã cấp quyền
// =============================================================

let activeSpreadsheetId = null; // Spreadsheet ID đang dùng trong phiên làm việc này

async function driveApiFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + googleAccessToken });
    const res = await fetch(url, options);
    if (res.status === 401) {
        showNotification('Phiên đăng nhập Google đã hết hạn, vui lòng đăng nhập lại.', 'error');
        signOutGoogle();
        throw new Error('Unauthorized (401)');
    }
    return res;
}

// Tìm file Google Sheet ĐẦU TIÊN nằm trực tiếp trong 1 thư mục Drive
async function findSpreadsheetInFolder(folderId) {
    const q = encodeURIComponent(
        `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`;
    const res = await driveApiFetch(url);
    const json = await res.json();
    if (json.files && json.files.length > 0) return json.files[0].id;
    return null;
}

// Xác định Spreadsheet ID sẽ dùng cho cả phiên làm việc:
// ưu tiên SPREADSHEET_ID điền sẵn trong google-config.js, nếu để trống thì tự tìm
// trong DRIVE_FOLDER_ID (thư mục người dùng đã được cấp quyền chỉnh sửa).
async function initSpreadsheetTarget() {
    if (GOOGLE_CONFIG.SPREADSHEET_ID) {
        activeSpreadsheetId = GOOGLE_CONFIG.SPREADSHEET_ID;
        return activeSpreadsheetId;
    }
    if (!GOOGLE_CONFIG.DRIVE_FOLDER_ID || GOOGLE_CONFIG.DRIVE_FOLDER_ID.startsWith('DÁN_')) {
        showNotification('Chưa cấu hình DRIVE_FOLDER_ID trong js/google-config.js', 'error');
        return null;
    }
    try {
        activeSpreadsheetId = await findSpreadsheetInFolder(GOOGLE_CONFIG.DRIVE_FOLDER_ID);
        if (!activeSpreadsheetId) {
            showNotification('Không tìm thấy file Google Sheet nào trong thư mục Drive đã cấu hình. Kiểm tra lại DRIVE_FOLDER_ID hoặc quyền chia sẻ.', 'error');
        }
        return activeSpreadsheetId;
    } catch (e) {
        console.warn('Lỗi tìm Google Sheet trong thư mục Drive:', e);
        return null;
    }
}
