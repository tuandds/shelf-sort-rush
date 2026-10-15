# Level Editor

Editor màn chơi chạy ngay trên web: [mở Level Editor](https://tuandds.github.io/shelf-sort-rush/demo/editor.html) (hoặc nút **Level Editor** ở trang chủ). Khi chạy máy dev: http://localhost:8080/editor.html.

Editor dùng **đúng định dạng màn và đúng bộ sinh màn của game** (`src/game/data.ts`, `src/game/levelgen.ts`), nên những gì thấy ở Board Preview là thứ game sẽ tạo ra.

## Hai chế độ

| Chế độ | Dùng để |
|---|---|
| **Editor** | Sửa một màn: vẽ tranh pixel, chỉnh mảng hình, bật cơ chế, chơi thử |
| **Organizer** | Quản lý cả danh sách màn: xem trước, sắp xếp, nhân bản, xoá, xuất/nhập JSON |

## Thanh công cụ

| Nút | Tác dụng |
|---|---|
| 🏠 | Về trang chủ |
| ▶ | Lưu rồi **chơi thử** màn đang sửa trong khung điện thoại |
| 🤖 | **Auto Play**: bot tự chơi màn đó (cho bay chiếc bắn được ngay; trên trời trống thì cho bay bất kỳ) |
| 💾 | Lưu danh sách màn vào trình duyệt (`Ctrl+S`) |
| ⬆ | Nhập JSON: một màn (thay màn đang sửa) hoặc cả danh sách |
| ⬇ | Tải JSON của màn đang sửa |

## Editor

### Colour Bank
10 màu của game. Phím `1`–`0` chọn màu. Công cụ: ✏️ vẽ (`B`), 🧽 tẩy (`E`), 🪣 đổ màu (`G`), 💧 hút màu (`I`). Chuột phải trên lưới là tẩy. `Ctrl+Z` hoàn tác.

### Wave Editor
- **Kiểm tra** (khung trên cùng): ⛔ lỗi chặn chơi thử (không có khối, đội hình rộng hơn 21 cột); ⚠️ cảnh báo (màu dưới 10 khối, mảng chồng nhau, mảng trống, quá ít máy bay cho số cặp nối đôi); ℹ️ gợi ý.
- **Mảng hình (wave)**: mỗi màn là nhiều mảng. Mỗi mảng có kích thước, **cột bắt đầu `ox`** và **độ lệch dọc `dy`** (âm = nằm phía trên board, trôi vào sau). *＋ Thêm* và *⧉ Nhân bản* đặt mảng mới ngay phía trên mảng cao nhất.
- **Cài đặt màn**: tên màn, popup *tính năng mới* (chỉ nên đặt ở màn đầu tiên có cơ chế đó).
- **Level Mechanics Bank**: ❓ máy bay ẩn (tỉ lệ), 🔗 cặp nối đôi (số cặp), 🧱 khối lớn (số lượng mỗi mảng, độ bền, kích thước), 👑 lõi trùm (khối 5×5 độ bền 20). Bấm lại để tắt.

### Board Preview
Toàn bộ đội hình trên board 21 cột, đã căn giữa như trong game. Khung xanh nét đứt là 10 hàng người chơi thấy đầu tiên; dấu ✕ đỏ là ô bị hai mảng chồng lên nhau; bấm vào một mảng để chọn nó. Bên dưới là số lượt bắn, số màu, số máy bay, và **máy bay trong 3 khoang** sinh thử bằng chính bộ sinh của game (🎲 để sinh lại với số ngẫu nhiên khác; khối lớn, máy bay ẩn và cặp nối đôi đổi theo).

## Lưu và đưa màn vào game

- Danh sách màn lưu trong **localStorage của trình duyệt** (khoá `ps_editor_levels`), không lên server. Muốn chia sẻ: *Xuất tất cả (JSON)* rồi gửi file; người kia *Nhập danh sách*.
- Game chơi danh sách đó khi mở với `?custom=1` (ví dụ `demo/?custom=1&level=3`). Thêm `&autoplay=1` để bot chơi.
- Muốn đưa vào **bản build chính thức**: Organizer → *Copy TypeScript*, dán thay mảng `LEVELS` trong `src/game/data.ts`, rồi `build_demo` / `release_demo`.

## Định dạng JSON một màn

```json
{
  "name": "Trái tim",
  "hidden": 0.4,
  "connected": 3,
  "big": [{ "n": 2, "hp": [5, 10] }, { "n": 1, "hp": [20, 20], "size": 5 }],
  "feature": "hidden",
  "waves": [
    { "ox": 5, "dy": 0, "art": ["..rr...rr..", ".rppr.rrrr."] }
  ]
}
```

Mỗi ký tự trong `art` là một màu (`r p y k w g c o b v`, xem [bảng màu](/gdd/levels)), `.` là ô trống. `feature` là một trong `hidden`, `linked`, `big`, `boss`. Các trường cơ chế bỏ trống thì cơ chế đó tắt.
