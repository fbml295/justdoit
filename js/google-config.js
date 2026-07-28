// =============================================================
// CẤU HÌNH GOOGLE — ĐIỀN CÁC GIÁ TRỊ BÊN DƯỚI TRƯỚC KHI DÙNG
// (Xem hướng dẫn lấy từng giá trị trong README.md, mục "Thiết lập Google")
// =============================================================
const GOOGLE_CONFIG = {
    // 1. OAuth 2.0 Client ID (loại "Web application") lấy tại:
    //    https://console.cloud.google.com/apis/credentials
    //    Authorized JavaScript origins PHẢI khớp đúng địa chỉ bạn dùng để mở trang này,
    //    ví dụ: https://ten-tai-khoan-github.github.io
    CLIENT_ID: '464267721766-jp1uii17bnju6248u1ei2416a8hbhvbh.apps.googleusercontent.com',

    // 2. ID của thư mục Google Drive chứa file Google Sheet dữ liệu (thư mục bạn sẽ
    //    cấp quyền truy cập cho mọi người dùng). Lấy từ URL khi mở thư mục đó trên
    //    Google Drive: https://drive.google.com/drive/folders/ĐÂY_LÀ_FOLDER_ID
    DRIVE_FOLDER_ID: '1RG_AstKeBggmI2syG7sg7xajt6iJ4dPP',

    // 3. (Tuỳ chọn) Nếu biết chính xác Spreadsheet ID muốn dùng, điền vào đây để app
    //    khỏi phải tự tìm trong thư mục ở trên. Để trống ('') thì app sẽ tự tìm file
    //    Google Sheet ĐẦU TIÊN tìm thấy trong DRIVE_FOLDER_ID.
    //    Lấy từ URL file Sheet: https://docs.google.com/spreadsheets/d/ĐÂY_LÀ_SPREADSHEET_ID/edit
    SPREADSHEET_ID: ''
};
