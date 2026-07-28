// =============================================================
// GOOGLE DRIVE API — tìm file Google Sheet mục tiêu trong thư mục đã cấp quyền
// =============================================================

let activeSpreadsheetId = null;    // Spreadsheet ID đang dùng trong phiên làm việc này
let activeSpreadsheetName = null;  // Tên file (hiển thị cho người dùng biết đang kết nối file nào)

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

// Tìm file Google Sheet ĐẦU TIÊN nằm trực tiếp trong 1 thư mục Drive, trả về {id, name}
async function findSpreadsheetInFolder(folderId) {
    const q = encodeURIComponent(
        `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`;
    const res = await driveApiFetch(url);
    const json = await res.json();
    if (json.files && json.files.length > 0) return json.files[0];
    return null;
}

// Lấy tên file khi đã biết sẵn Spreadsheet ID (trường hợp điền thẳng SPREADSHEET_ID trong config)
async function getSpreadsheetName(spreadsheetId) {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title`;
        const res = await driveApiFetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        return json.properties ? json.properties.title : null;
    } catch (e) {
        return null;
    }
}

// Xác định Spreadsheet ID sẽ dùng cho cả phiên làm việc:
// ưu tiên SPREADSHEET_ID điền sẵn trong google-config.js, nếu để trống thì tự tìm
// trong DRIVE_FOLDER_ID (thư mục người dùng đã được cấp quyền chỉnh sửa).
// Mọi thất bại đều được ghi RÕ vào ô trạng thái kết nối (không chỉ hiện thoáng qua),
// để người dùng luôn biết chính xác đang kết nối với file nào (hoặc vì sao chưa kết nối được).
async function initSpreadsheetTarget() {
    if (GOOGLE_CONFIG.SPREADSHEET_ID) {
        activeSpreadsheetId = GOOGLE_CONFIG.SPREADSHEET_ID;
        activeSpreadsheetName = await getSpreadsheetName(activeSpreadsheetId);
        if (!activeSpreadsheetName) {
            showGoogleConfigError('Không mở được file với SPREADSHEET_ID đã điền trong js/google-config.js. Kiểm tra lại ID hoặc quyền truy cập của tài khoản đang đăng nhập vào file này.');
            activeSpreadsheetId = null;
            return null;
        }
        return activeSpreadsheetId;
    }

    if (!GOOGLE_CONFIG.DRIVE_FOLDER_ID || GOOGLE_CONFIG.DRIVE_FOLDER_ID.startsWith('DÁN_')) {
        showGoogleConfigError('Chưa điền DRIVE_FOLDER_ID hợp lệ trong file js/google-config.js.');
        return null;
    }

    try {
        const file = await findSpreadsheetInFolder(GOOGLE_CONFIG.DRIVE_FOLDER_ID);
        if (!file) {
            showGoogleConfigError('Đã đăng nhập Google thành công, nhưng KHÔNG tìm thấy file Google Sheet nào nằm trực tiếp trong thư mục Drive đã cấu hình (DRIVE_FOLDER_ID). '
                + 'Kiểm tra lại: (1) DRIVE_FOLDER_ID có đúng thư mục chứa file Sheet không, (2) file Sheet có nằm trực tiếp trong thư mục đó (không phải thư mục con), '
                + '(3) tài khoản vừa đăng nhập đã được cấp quyền truy cập thư mục đó chưa.');
            activeSpreadsheetId = null;
            activeSpreadsheetName = null;
            return null;
        }
        activeSpreadsheetId = file.id;
        activeSpreadsheetName = file.name;
        return activeSpreadsheetId;
    } catch (e) {
        console.warn('Lỗi tìm Google Sheet trong thư mục Drive:', e);
        return null;
    }
}
