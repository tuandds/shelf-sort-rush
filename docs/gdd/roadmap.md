# 6. Lộ trình & câu hỏi mở

## 6.1 Đã có <Badge type="tip" text="Live" />

- Toàn bộ gameplay của prototype HTML gốc, port sang Phaser 4: 10 màn, máy bay ẩn, máy bay nối đôi, khối lớn, trùm cuối.
- HUD, popup bắt đầu/thắng/thua, giới thiệu tính năng mới, chọn màn, tuỳ biến 5 skin × 5 loại đạn (lưu trong máy).
- Rung máy, mảnh vỡ, rung màn hình.
- Site tài liệu và phát hành các phiên bản lên GitHub Pages.

## 6.2 Lộ trình <Badge type="warning" text="Coming soon" />

Thứ tự ưu tiên. Mốc là nhóm phạm vi, không phải ngày.

### M2: Sẵn sàng cho người chơi thử
| Hạng mục | Chương |
|---|---|
| Quyết định các câu hỏi mở bên dưới (tiến độ, âm thanh, hướng dẫn) | [Câu hỏi mở](#open-questions) |
| Cân bằng lại màn 2, 3, 9 nếu playtest xác nhận quá khó | [Màn chơi](./levels) |

## 6.3 Vấn đề đã biết {#known-issues}

| Vấn đề | Ảnh hưởng | Hướng sửa |
|---|---|---|
| Không có âm thanh | Thiếu phản hồi khi trúng/vỡ/thắng | Xem câu hỏi mở |
| Máy bay và đạn không có quầng sáng mờ (`shadowBlur`) như bản Canvas gốc; quầng được giả lập bằng một lớp hình to hơn, trong suốt | Hình hơi phẳng hơn bản gốc | Thêm filter Glow của Phaser 4 nếu hiệu năng trên điện thoại cho phép |
| Chữ trong popup không còn in đậm từng cụm (bản gốc dùng `<b>` trong HTML) | Câu giải thích khó lướt hơn một chút | Tách cụm in đậm thành Text riêng nếu cần |
| Tính năng mới chỉ giới thiệu một lần mỗi phiên, không lưu giữa các lần mở game | Mở lại game sẽ thấy lại popup | Lưu vào `localStorage` khi có hệ thống tiến độ |

**Khác biệt so với bản gốc (có chủ đích):** bản gốc tính layout theo kích thước cửa sổ, nên độ khó đổi theo máy (khung 432 × 768 khó hơn rõ rệt so với 450 × 800, vì quãng bay khác nhau). Bản Phaser cố định sân chơi 450 × 800 nên mọi máy chơi như nhau.

## 6.4 Câu hỏi mở {#open-questions}

| Câu hỏi | Lựa chọn | Đang nghiêng về |
|---|---|---|
| Có lưu tiến độ và khoá màn không? | Tự do chọn màn như hiện tại · mở khoá dần | Chưa quyết |
| Âm thanh? | Không · SFX tối giản (bắn, trúng, vỡ, thắng, thua) · thêm nhạc nền | Chưa quyết |
| Hướng dẫn lần đầu? | Chỉ popup chữ như hiện tại · chỉ tay vào khoang chứa ở màn 1 | Chưa quyết |
| Màn 2, 3, 9 có quá khó không? | Giữ nguyên · nới số chỗ/giây bế tắc riêng từng màn · đổi bố cục màu | Chờ playtest |
