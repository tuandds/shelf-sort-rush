# Level Editor

Editor màn chơi chạy ngay trên web: [mở Level Editor](https://tuandds.github.io/shelf-sort-rush/demo/editor.html) (hoặc nút **Level Editor** ở trang chủ). Khi chạy máy dev: http://localhost:8080/editor.html.

Editor dùng **đúng định dạng màn và đúng bộ sinh màn của game** (`src/game/data.ts`, `src/game/levelgen.ts`), nên những gì thấy ở Board Preview là thứ game sẽ tạo ra.

## Hai chế độ

| Chế độ | Dùng để |
|---|---|
| **Editor** | 4 cột: Colour Bank · Wave Editor · Plane Editor · Level Bank |
| **Organizer** | Bảng tổng quan cả danh sách màn: xem trước, sắp xếp, nhân bản, xoá |

## Thanh công cụ

| Nút | Tác dụng |
|---|---|
| 🏠 | Về trang chủ |
| ▶ | Lưu rồi **chơi thử** màn đang sửa trong khung điện thoại |
| 🤖 | **Auto Play**: bot tự chơi màn đó (cho bay chiếc bắn được ngay; trên trời trống thì cho bay bất kỳ) |
| 💾 | Lưu danh sách màn vào trình duyệt (`Ctrl+S`) |
| ⬆ | Nhập JSON: một màn hoặc cả danh sách (thay thế hoặc thêm vào cuối) |
| ⬇ | Tải JSON của màn đang sửa |

## 1. Colour Bank
- **Active Palette**: các màu màn đang dùng (kèm số khối) và màu đang chọn. Phím `1`–`0` chọn màu theo thứ tự trong Active Palette.
- **Bank**: cả 16 màu của bảng màu (lấy từ editor Marble Drop — xem [bảng màu](/gdd/levels)). Bấm một màu để vẽ bằng màu đó; ô có viền nét đứt là màu đang có trong màn.
- Công cụ: ✏️ vẽ (`B`), 🧽 tẩy (`E`), 🪣 đổ màu (`G`), 💧 hút màu (`I`). Chuột phải trên lưới là tẩy. `Ctrl+Z` hoàn tác. Màu đang chọn cũng là màu của máy bay thêm mới ở Plane Editor.

## 2. Wave Editor
- **Kiểm tra** (khung trên cùng): ⛔ lỗi chặn chơi thử; ⚠️ cảnh báo; ℹ️ gợi ý.
- **Mảng hình (wave)**: mỗi màn là nhiều mảng. Mỗi mảng có kích thước, **cột bắt đầu `ox`** và **độ lệch dọc `dy`** (âm = nằm phía trên board, trôi vào sau).
- **Toàn đội hình trên board**: cả đội hình trên 21 cột, căn giữa như trong game. Khung xanh = 10 hàng người chơi thấy đầu tiên; ✕ đỏ = ô bị hai mảng chồng nhau; bấm vào một mảng để chọn.
- **Cài đặt màn**: tên màn, popup *tính năng mới*.
- **Level Mechanics Bank**: ❓ máy bay ẩn và 🔗 cặp nối đôi (thông số cho 🎲 Random và cho màn chưa xếp máy bay), 🧱 khối lớn, 👑 lõi trùm. Bấm lại để tắt.

## 3. Plane Editor

Xếp máy bay cho 3 khoang chứa bằng tay. Game dùng đúng thứ tự đã xếp, không xáo.

- **🎲 Random**: sinh lại cả 3 khoang theo thuật toán của game (chia đạn 10–20 viên mỗi chiếc theo thứ tự khối sẽ bị phá; tỉ lệ ẩn ❓ và số cặp 🔗 lấy từ Wave Editor), rồi chỉnh tiếp. `Ctrl+Z` để quay lại bản trước.
- **🧹 Xoá hết**: làm trống cả 3 khoang.
- Màn **chưa xếp máy bay** (ví dụ 10 màn gốc) thì game tự sinh mỗi lần chơi; Plane Editor hiện một bản sinh thử kèm dòng cảnh báo vàng. Sửa bất kỳ máy bay nào hoặc bấm 🎲 Random là màn chuyển sang xếp tay.

Mỗi máy bay có: **màu** (bấm ô màu), **số đạn**, **?** (ẩn màu và số đạn tới khi lên đầu hàng; chiếc đầu hàng lúc bắt đầu luôn hiện), **🔗 số cặp** (hai máy bay cùng số là một cặp nối đôi: phải đứng đầu hai khoang, hoặc liền nhau trong một khoang). **Kéo thả** để đổi thứ tự hoặc chuyển khoang; hàng trên cùng (vạch xanh) cất cánh trước. *＋* thêm một máy bay màu đang chọn, số đạn tự điền bằng phần còn thiếu của màu đó.

**Đạn theo màu (có / cần)**: xanh = khớp, đỏ = thiếu (màn không thể thắng — game sẽ báo *HẾT MÁY BAY!*), vàng = thừa. Nếu khối lớn có độ bền ngẫu nhiên, số cần có dấu `~`; đặt độ bền min = max để khớp chính xác.

## 4. Level Bank
Danh sách màn với ảnh thu nhỏ, số màu, số khối, khoang (✋ đã xếp / 🎲 game tự sinh) và chấm trạng thái (xanh/vàng/đỏ theo kiểm tra; chấm vàng cạnh tên = chưa lưu). Bấm để mở, ↑↓ để sắp xếp, ＋ màn mới, ⧉ nhân bản, 🗑 xoá.

**Lưu trữ:**

| Nút | Lưu ở đâu |
|---|---|
| 💾 Lưu vào trình duyệt | localStorage của trình duyệt này. Mỗi lần lưu giữ thêm một **bản sao lưu** (15 bản gần nhất), khôi phục hoặc tải về ở 🕘 *Bản sao lưu* |
| ⬇ Xuất file / ⬆ Nhập file | File JSON cả danh sách: giữ lâu dài, gửi cho người khác, chuyển máy |
| ⧉ Copy TS | Mã TypeScript để dán vào `LEVELS` trong `src/game/data.ts` (đưa vào bản build chính thức) |

## Lưu và đưa màn vào game

- Danh sách màn lưu trong **localStorage của trình duyệt** (khoá `ps_editor_levels`, sao lưu ở `ps_editor_backups`), không lên server. Muốn chia sẻ: *Xuất file* rồi gửi; người kia *Nhập file*.
- Game chơi danh sách đó khi mở với `?custom=1` (ví dụ `demo/?custom=1&level=3`). Thêm `&autoplay=1` để bot chơi.
- Muốn đưa vào **bản build chính thức**: Level Bank → *Copy TS*, dán thay mảng `LEVELS` trong `src/game/data.ts`, rồi `build_demo` / `release_demo`.

## Định dạng JSON một màn

```json
{
  "name": "Trái tim",
  "hidden": 0.4,
  "connected": 3,
  "big": [{ "n": 2, "hp": [5, 10] }, { "n": 1, "hp": [20, 20], "size": 5 }],
  "feature": "hidden",
  "queues": [
    [{ "c": "r", "a": 20 }, { "c": "p", "a": 15, "hidden": true }],
    [{ "c": "r", "a": 20, "link": 1 }],
    [{ "c": "y", "a": 12, "link": 1 }]
  ],
  "waves": [
    { "ox": 5, "dy": 0, "art": ["..rr...rr..", ".rppr.rrrr."] }
  ]
}
```

Mỗi ký tự trong `art` là một màu (`r p y k w g c o b v l u n m d s`, xem [bảng màu](/gdd/levels)), `.` là ô trống. `feature` là một trong `hidden`, `linked`, `big`, `boss`. Các trường cơ chế bỏ trống thì cơ chế đó tắt. Có `queues` (3 danh sách, đầu hàng trước) là màn đã xếp máy bay: game dùng nguyên thứ tự đó và cờ trên từng máy bay (`hidden` / `connected` của màn chỉ còn là thông số cho 🎲 Random); không có `queues` thì game tự sinh mỗi lần chơi.
