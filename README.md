# Hệ Thống Quản Trị Công Việc — MDF CMMS

Ứng dụng quản lý công việc / bảo trì / sơ đồ tổ chức, chạy hoàn toàn trên trình duyệt,
dữ liệu lưu trên Google Sheets, có trợ lý Gemini AI.

## 1. Cấu trúc thư mục

```
mdf-cmms/
├── index.html                  ← Trang chính (chỉ chứa cấu trúc HTML)
├── css/
│   └── styles.css              ← Toàn bộ CSS tuỳ chỉnh (ngoài Tailwind)
├── js/
│   ├── google-config.js        ← ⚠️ BẠN CẦN ĐIỀN Client ID + Folder ID vào đây
│   ├── state.js                ← Dữ liệu trạng thái app (state), hằng số localStorage
│   ├── google-auth.js          ← Đăng nhập/đăng xuất Google (OAuth2)
│   ├── google-drive-api.js     ← Tìm file Google Sheet trong thư mục Drive
│   ├── google-sheets-api.js    ← Đọc/ghi Google Sheets trực tiếp (Sheets API v4)
│   ├── google-sheets-sync.js   ← Chuyển đổi dữ liệu app <-> dòng trong Sheets
│   ├── sync-queue.js           ← Hàng đợi đồng bộ offline, Gemini Key, trạng thái kết nối
│   ├── gemini-api.js           ← Gọi Gemini AI (gợi ý, tóm tắt, chatbot...)
│   ├── tasks.js                ← Logic tab Công Việc (khu vực, phân quyền...)
│   ├── views.js                ← Render giao diện (Sơ đồ tổ chức, Đối tác, Lịch, Sáng kiến...)
│   ├── ui-actions.js           ← Thông báo, hộp thoại xác nhận, thêm/xoá đơn vị-nhân sự
│   └── app-init.js             ← Khởi động app (luôn load SAU CÙNG)
└── README.md                   ← File này
```

Vì sao tách nhiều file? Để khi cần sửa 1 phần (ví dụ chỉ sửa Sơ đồ tổ chức), bạn chỉ
cần mở đúng `js/views.js` thay vì kéo qua một file HTML khổng lồ.

**Lưu ý kỹ thuật:** các file JS ở trên là script thường (không phải ES module), nên
chúng dùng chung 1 "không gian biến toàn cục". Thứ tự `<script src="...">` trong
`index.html` **rất quan trọng** — không được đổi thứ tự khi thêm/sửa file.

---

## 2. Thiết lập Google (bắt buộc, làm 1 lần)

Ứng dụng này đăng nhập bằng tài khoản Google của người dùng và gọi thẳng
**Google Sheets API** + **Google Drive API** từ trình duyệt — không còn cần Apps Script
Web App trung gian như bản cũ nữa.

### Bước 1 — Tạo OAuth Client ID

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → tạo 1 Project mới (hoặc dùng project có sẵn).
2. Vào **APIs & Services → Library**, bật 3 API sau:
   - `Google Sheets API`
   - `Google Drive API`
   - `Google Tasks API` (dùng cho tính năng "G-Task" — đưa công việc sang Google Tasks)
3. Vào **APIs & Services → OAuth consent screen**:
   - User type: **External** (nếu không dùng Google Workspace riêng) → điền tên app, email.
   - Ở mục **Test users** (nếu app đang ở chế độ Testing), thêm email của những người sẽ dùng app.
     *(Nếu để ở chế độ Testing, chỉ các email trong danh sách Test users mới đăng nhập được.
     Muốn ai có tài khoản Google cũng đăng nhập được, cần bấm "Publish App".)*
4. Vào **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins**: điền đúng địa chỉ bạn sẽ host trang này, ví dụ:
     ```
     https://<ten-tai-khoan-github>.github.io
     ```
     (Không điền đường dẫn con, không điền `file://`. Đăng nhập Google **không hoạt động**
     nếu mở trực tiếp file từ ổ đĩa.)
   - Bấm **Create**, copy **Client ID** (dạng `xxxxxxxx.apps.googleusercontent.com`).

### Bước 2 — Chuẩn bị thư mục Google Drive + file Google Sheet

1. Tạo (hoặc dùng lại) 1 thư mục trên Google Drive, bên trong có sẵn 1 file Google Sheet
   dùng làm nơi lưu dữ liệu (có thể là file bạn đang dùng ở bản cũ).
2. Mở thư mục đó, copy **Folder ID** từ URL:
   ```
   https://drive.google.com/drive/folders/ĐÂY_LÀ_FOLDER_ID
   ```
3. Chia sẻ (Share) thư mục này cho tất cả những người cần dùng app, với quyền
   **Editor (Người chỉnh sửa)**.

### Bước 3 — Điền vào `js/google-config.js`

Mở file `js/google-config.js`, điền 2 giá trị đã lấy ở trên:

```js
const GOOGLE_CONFIG = {
    CLIENT_ID: '123456-abc...apps.googleusercontent.com',
    DRIVE_FOLDER_ID: '1aBcD3fGhIjKlmNoPqRsTuVwXyZ',
    SPREADSHEET_ID: '' // để trống, app tự tìm file Sheet trong thư mục ở trên
};
```

> Nếu thư mục có nhiều hơn 1 file Google Sheet, app sẽ lấy file **đầu tiên tìm thấy**.
> Muốn chỉ định chính xác 1 file, điền `SPREADSHEET_ID` (lấy từ URL file Sheet đó:
> `https://docs.google.com/spreadsheets/d/ĐÂY_LÀ_SPREADSHEET_ID/edit`).

---

## 3. Đưa lên GitHub Pages

1. Tạo 1 repository trên GitHub, đẩy (push) toàn bộ nội dung thư mục `mdf-cmms/` lên.
2. Vào **Settings → Pages** của repo → chọn nhánh (branch) để publish (thường là `main`,
   thư mục `/root`) → Save.
3. Chờ vài phút, GitHub sẽ cấp địa chỉ dạng `https://<ten-tai-khoan>.github.io/<ten-repo>/`.
4. **Quan trọng:** quay lại Google Cloud Console → OAuth Client ID đã tạo ở Bước 1 →
   đảm bảo **Authorized JavaScript origins** khớp đúng phần gốc domain của địa chỉ này
   (chỉ cần `https://<ten-tai-khoan>.github.io`, không cần phần `/<ten-repo>/`).

---

## 4. Sử dụng hằng ngày

1. Mở địa chỉ GitHub Pages của app.
2. Vào **Cấu Hình → Kết Nối API** → bấm **"Đăng Nhập Bằng Google"**, chọn đúng tài khoản
   đã được cấp quyền ở Bước 2.
3. App tự tìm file Google Sheet trong thư mục đã cấu hình và tải dữ liệu về.
4. (Tuỳ chọn) Dán **Gemini API Key** vào ô bên cạnh để dùng các tính năng AI. Key này
   **chỉ lưu tạm trong trình duyệt (localStorage)** của máy đang dùng — mỗi máy/mỗi lần
   xoá dữ liệu trình duyệt sẽ cần dán lại. Lấy key miễn phí tại
   [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).

---

## 5. Một vài lưu ý vận hành

- **Ai đăng nhập được?** Bất kỳ ai có tài khoản Google, miễn là đã được cấp quyền
  **Editor** vào thư mục Drive ở Bước 2. Google sẽ tự chặn nếu tài khoản đó chưa được
  chia sẻ quyền truy cập file Sheet.
- **Quyền truy cập:** app xin quyền `spreadsheets` (đọc/ghi Sheets) và `drive` (tìm file
  trong thư mục, cho các tính năng liên quan Drive sau này). Mỗi người dùng chỉ thao tác
  được trên những file họ đã được chia sẻ — Google tự giới hạn, app không thể vượt qua
  giới hạn quyền của Google.
- **Không dùng Apps Script Web App nữa.** Nếu trước đây bạn có triển khai 1 Apps Script
  Web App cho bản cũ, có thể gỡ bỏ (không còn dùng tới).
- **Lỗi 401 / "phiên đăng nhập hết hạn":** access token của Google chỉ có hạn khoảng
  1 giờ. App tự phát hiện và yêu cầu đăng nhập lại khi cần — bấm lại nút "Đăng Nhập
  Bằng Google" là được, không mất dữ liệu.
- **Lỗi `401: invalid_client` (flowName=GeneralOAuthFlow):** lỗi này luôn có nghĩa là
  giá trị `CLIENT_ID` trong `js/google-config.js` chưa đúng. Kiểm tra lại:
  - Đã thay đúng chuỗi placeholder `DÁN_CLIENT_ID_CỦA_BẠN_VÀO_ĐÂY...` bằng Client ID
    thật copy từ Google Cloud Console chưa?
  - Client ID có bị dính dấu nháy thừa, khoảng trắng, hoặc bị cắt ngắn khi copy không?
  - Client ID đó có đúng loại **Web application** không (không phải Android/iOS/Desktop)?
  - Client ID đó còn tồn tại trong Google Cloud Console không (chưa bị xoá/thu hồi)?
  App sẽ tự phát hiện nếu `CLIENT_ID` còn để nguyên placeholder và báo lỗi rõ ràng
  ngay trong khối kết quả của tab Kết Nối API, thay vì để lỗi kỹ thuật của Google hiện ra.
- **Không tìm thấy Google Sheet:** kiểm tra lại `DRIVE_FOLDER_ID` trong
  `js/google-config.js`, và đảm bảo tài khoản đang đăng nhập đã được share quyền vào
  đúng thư mục đó.
- **Đang dùng app từ trước, giờ không tích được "G-Task":** tính năng Google Tasks cần thêm 1 quyền OAuth mới (`tasks`) không có trong lần đăng nhập trước đó. Vào tab Kết Nối API, bấm **Đăng xuất** rồi **Đăng Nhập Bằng Google** lại để được hỏi cấp thêm quyền này.
- **App "tự nhảy ra trang đăng nhập Google" bất ngờ giữa lúc đang dùng:** đây là giới hạn
  của chính trình duyệt, không phải lỗi app. Google Identity Services cần đọc được cookie
  đăng nhập của `accounts.google.com` để làm mới phiên **hoàn toàn im lặng**; nếu trình
  duyệt đang **chặn cookie bên thứ 3** (mặc định trên Safari, và ngày càng phổ biến trên
  Chrome/Firefox ở chế độ chống theo dõi mạnh, hoặc trên Brave), Google buộc phải hiện 1
  cửa sổ xác nhận thật. App đã được thiết kế để **không tự động bật popup đó lên bất ngờ**
  — thay vào đó sẽ hiện 1 banner nhỏ "🔑 Phiên đăng nhập Google cần xác thực lại", bạn chỉ
  cần bấm nút trong banner đó (không mất dữ liệu, không cần đăng nhập lại từ đầu).
  Muốn hết hẳn hiện tượng này (làm mới hoàn toàn im lặng): vào cài đặt trình duyệt →
  cho phép cookie bên thứ 3 (hoặc thêm ngoại lệ) cho domain `google.com` /
  `accounts.google.com`.

---

## 6. Ghi chú cho việc chỉnh sửa sau này

- Sửa giao diện Sơ đồ tổ chức / Đối tác / Lịch / Sáng kiến → `js/views.js`
- Sửa logic tạo/lọc/chọn khu vực trong tab Công việc → `js/tasks.js`
- Thêm/xoá Phòng ban, Tổ, Nhà máy, Đối tác, Nhân sự → `js/ui-actions.js`
- Thêm tính năng Gemini AI mới → `js/gemini-api.js`
- Sửa tính năng Kế Hoạch Năm (ma trận Năm/Tháng/Tuần) → `js/roadmap.js` (dữ liệu lưu trong
  4 sheet riêng trên Google Sheet đang kết nối: `ke_hoach_nam_years`, `ke_hoach_nam_goals`,
  `ke_hoach_nam_pool`, `ke_hoach_nam_weeks` — tự tạo khi lần đầu lưu, không cần tạo tay)
- Đổi cách đọc/ghi Google Sheets (ví dụ đổi tên cột) → `js/google-sheets-sync.js`
- Đổi màu sắc / font chữ chung → `css/styles.css` (Tailwind dùng trực tiếp qua class
  trong `index.html`, không cần sửa CSS cho phần lớn trường hợp)
