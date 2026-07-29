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

// Người dùng đôi khi dán cả URL thay vì chỉ ID (ví dụ dán nguyên
// "https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0") — tự động lọc lấy đúng ID.
function extractGoogleId(raw) {
    if (!raw) return '';
    const trimmed = raw.trim();
    const match = trimmed.match(/[-\w]{20,}/); // ID Google Drive/Sheets thường dài (≥ ~20 ký tự)
    return match ? match[0] : trimmed;
}

// Đọc phần message lỗi thật từ response JSON của Google (nếu có), để hiện đúng nguyên nhân
async function readGoogleErrorDetail(res) {
    try {
        const json = await res.json();
        if (json && json.error) {
            return (json.error.message || JSON.stringify(json.error)) + ' (status ' + res.status + ')';
        }
        return 'HTTP ' + res.status;
    } catch (e) {
        return 'HTTP ' + res.status;
    }
}

// Tìm file Google Sheet ĐẦU TIÊN nằm trực tiếp trong 1 thư mục Drive, trả về {id, name}
// hoặc { error: '...' } nếu gọi API thất bại
async function findSpreadsheetInFolder(folderId) {
    const q = encodeURIComponent(
        `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`;
    const res = await driveApiFetch(url);
    if (!res.ok) return { error: await readGoogleErrorDetail(res) };
    const json = await res.json();
    if (json.files && json.files.length > 0) return json.files[0];
    return null; // gọi API thành công nhưng không có file nào trong thư mục
}

// Lấy tên file khi đã biết sẵn Spreadsheet ID (trường hợp điền thẳng SPREADSHEET_ID trong config)
// trả về { name: '...' } hoặc { error: '...' }
async function getSpreadsheetName(spreadsheetId) {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title`;
        const res = await driveApiFetch(url);
        if (!res.ok) return { error: await readGoogleErrorDetail(res) };
        const json = await res.json();
        return { name: json.properties ? json.properties.title : null };
    } catch (e) {
        return { error: e.message || String(e) };
    }
}

// Xác định Spreadsheet ID sẽ dùng cho cả phiên làm việc:
// ưu tiên SPREADSHEET_ID điền sẵn trong google-config.js, nếu để trống thì tự tìm
// trong DRIVE_FOLDER_ID (thư mục người dùng đã được cấp quyền chỉnh sửa).
// Mọi thất bại đều được ghi RÕ (kèm nguyên văn lỗi từ Google) vào ô trạng thái kết nối.
async function initSpreadsheetTarget() {
    if (GOOGLE_CONFIG.SPREADSHEET_ID) {
        activeSpreadsheetId = extractGoogleId(GOOGLE_CONFIG.SPREADSHEET_ID);
        const result = await getSpreadsheetName(activeSpreadsheetId);
        if (result.error) {
            showGoogleConfigError('Không mở được file với SPREADSHEET_ID đã điền trong js/google-config.js.\n'
                + 'ID đang dùng: ' + activeSpreadsheetId + '\n'
                + 'Lỗi từ Google: ' + result.error + '\n\n'
                + 'Nguyên nhân thường gặp:\n'
                + '• Tài khoản đang đăng nhập chưa được cấp quyền (share) vào đúng file này\n'
                + '• Google Sheets API chưa được BẬT cho project trong Google Cloud Console\n'
                + '  (Vào console.cloud.google.com → APIs & Services → Library → tìm "Google Sheets API" → Enable)\n'
                + '• SPREADSHEET_ID sai/thiếu ký tự khi copy');
            activeSpreadsheetId = null;
            return null;
        }
        activeSpreadsheetName = result.name;
        return activeSpreadsheetId;
    }

    const folderId = extractGoogleId(GOOGLE_CONFIG.DRIVE_FOLDER_ID);
    if (!folderId || GOOGLE_CONFIG.DRIVE_FOLDER_ID.startsWith('DÁN_')) {
        showGoogleConfigError('Chưa điền DRIVE_FOLDER_ID hợp lệ trong file js/google-config.js.');
        return null;
    }

    const result = await findSpreadsheetInFolder(folderId);
    if (result && result.error) {
        showGoogleConfigError('Không đọc được thư mục Drive (DRIVE_FOLDER_ID: ' + folderId + ').\n'
            + 'Lỗi từ Google: ' + result.error + '\n\n'
            + 'Nguyên nhân thường gặp:\n'
            + '• Tài khoản đang đăng nhập chưa được cấp quyền vào thư mục này\n'
            + '• Google Drive API chưa được BẬT cho project trong Google Cloud Console\n'
            + '• DRIVE_FOLDER_ID sai/thiếu ký tự khi copy');
        activeSpreadsheetId = null;
        activeSpreadsheetName = null;
        return null;
    }
    if (!result) {
        showGoogleConfigError('Đã đăng nhập Google thành công và đọc được thư mục Drive, nhưng KHÔNG tìm thấy file Google Sheet nào nằm trực tiếp trong thư mục đó (DRIVE_FOLDER_ID: ' + folderId + ').\n'
            + 'Kiểm tra lại: (1) đúng thư mục chứa file Sheet chưa, (2) file Sheet có nằm trực tiếp trong thư mục đó (không phải thư mục con).');
        activeSpreadsheetId = null;
        activeSpreadsheetName = null;
        return null;
    }

    activeSpreadsheetId = result.id;
    activeSpreadsheetName = result.name;
    return activeSpreadsheetId;
}
