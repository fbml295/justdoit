// =============================================================
// GOOGLE SHEETS API (v4) — đọc/ghi trực tiếp bằng token OAuth của người dùng,
// giữ ĐÚNG chữ ký/hành vi của sheetsGet() và sheetsPost() bản cũ (dùng Apps Script)
// để toàn bộ phần còn lại của app không cần sửa gì thêm.
// =============================================================

async function sheetsApiFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers, {
        Authorization: 'Bearer ' + googleAccessToken
    });
    return driveApiFetch(url, options); // dùng chung wrapper xử lý lỗi 401 (hết hạn token) với Drive API
}

function sheetsRowsToObjects(values) {
    if (!values || values.length === 0) return [];
    const headers = values[0];
    return values.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
        return obj;
    });
}

// Tạo sẵn 1 sheet (tab) mới trong file nếu tên sheet đó chưa tồn tại
async function ensureSheetExists(sheetName) {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}?fields=sheets.properties.title`;
    const metaRes = await sheetsApiFetch(metaUrl);
    const meta = await metaRes.json();
    const titles = (meta.sheets || []).map(s => s.properties.title);
    if (!titles.includes(sheetName)) {
        await sheetsApiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}:batchUpdate`, {
            method: 'POST',
            body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] })
        });
    }
}

// Đọc toàn bộ 1 sheet (tab), trả về mảng object (dòng đầu = tên cột) — giống hệt bản cũ
async function sheetsGet(sheetName) {
    if (!googleAccessToken || !activeSpreadsheetId) return null;
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/${encodeURIComponent(sheetName)}`;
        const res = await sheetsApiFetch(url);
        if (res.status === 400 || res.status === 404) return []; // sheet chưa tồn tại -> coi như rỗng, không phải lỗi
        if (!res.ok) {
            console.warn('sheetsGet: HTTP ' + res.status);
            return null;
        }
        const json = await res.json();
        return sheetsRowsToObjects(json.values);
    } catch (e) {
        console.warn('Sheets GET lỗi:', e);
        return null;
    }
}

// Ghi đè TOÀN BỘ 1 sheet (tab) bằng headers + dataRows mới — giống hệt hành vi bản cũ
async function sheetsPost(sheetName, headers, dataRows) {
    if (!googleAccessToken || !activeSpreadsheetId) return false;
    try {
        await ensureSheetExists(sheetName);

        // Xóa sạch nội dung cũ trước, tránh sót dữ liệu thừa khi số dòng mới ít hơn số dòng cũ
        await sheetsApiFetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`,
            { method: 'POST', body: '{}' }
        );

        const rows = [headers, ...dataRows];
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=RAW`;
        const res = await sheetsApiFetch(url, { method: 'PUT', body: JSON.stringify({ values: rows }) });
        return res.ok;
    } catch (e) {
        console.warn('Sheets WRITE lỗi:', e);
        return false;
    }
}
