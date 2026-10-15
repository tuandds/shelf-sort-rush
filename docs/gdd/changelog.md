# 7. Changelog

Mỗi phiên bản đã phát hành đều chơi được tại URL riêng. [Landing page](https://tuandds.github.io/shelf-sort-rush/) liệt kê tất cả.

## latest (main) <Badge type="tip" text="Live" />

- Chưa có thay đổi từ v0.2.0.

[Chơi bản latest](https://tuandds.github.io/shelf-sort-rush/demo/)

## v0.2.0

- **Bảng màu mới:** 16 màu lấy từ Marble Drop thay cho 10 màu cũ. 10 màn gốc chơi như cũ, chỉ đổi sang màu Marble Drop gần nhất; thêm 6 màu cho màn mới (lime, purple, brown, crimson, darkgreen, lightblue).
- **Level Editor** trên web, nút mới ở trang chủ. 4 cột:
  - **Colour Bank:** Active Palette + Bank 16 màu.
  - **Wave Editor:** vẽ tranh pixel theo từng mảng, xem cả đội hình trên board, bật máy bay ẩn / nối đôi / khối lớn / lõi trùm.
  - **Plane Editor:** xếp tay từng máy bay (màu, số đạn, ẩn, nối đôi, kéo thả giữa 3 khoang), đối chiếu đạn với số khối, nút 🎲 Random.
  - **Level Bank:** danh sách màn, lưu trong trình duyệt kèm bản sao lưu, xuất/nhập file JSON, copy TypeScript.
  - Chơi thử hoặc Auto Play ngay trong trình duyệt; tab Organizer để xem tổng quan.
- **Màn xếp tay máy bay:** game chơi đúng thứ tự máy bay đã xếp; nếu hết máy bay mà tranh còn khối, game báo **HẾT MÁY BAY!** thay vì kẹt.
- **Chơi màn từ editor:** `?custom=1` chơi danh sách màn của editor, `?level=N` vào thẳng màn N, `?autoplay=1` cho bot tự chơi (tắt rung).
- **Game Design Document:** thêm bảng màu mới, luật khoang xếp tay và hướng dẫn [Level Editor](/guide/level-editor).

[Chơi v0.2.0](https://tuandds.github.io/shelf-sort-rush/v0.2.0/demo/) · [Tài liệu v0.2.0](https://tuandds.github.io/shelf-sort-rush/v0.2.0/docs/)

## v0.1.0

- **Pixel Squadron chơi được:** port toàn bộ gameplay từ prototype HTML gốc sang Phaser 4: chạm khoang chứa để cho máy bay cất cánh, máy bay tự bắn khối cùng màu đang lộ ra, 5 chỗ trên trời, thua khi bế tắc 5 giây.
- **10 màn** từ *Trái tim* tới *Trùm cuối*, với máy bay ẩn, máy bay nối đôi, khối lớn nhiều độ bền và lõi trùm 20 độ bền.
- **Giao diện:** HUD với tiến độ màn, chơi lại, chọn màn; popup giới thiệu tính năng mới; tuỳ biến 5 skin máy bay và 5 loại đạn (lưu trong máy).
- **Sân chơi cố định 9:16** (450 × 800, hiển thị 1080 × 1920): độ khó như nhau trên mọi màn hình.
- **Game Design Document:** viết đầy đủ luật, số liệu, danh sách màn và dữ liệu cân bằng.

[Chơi v0.1.0](https://tuandds.github.io/shelf-sort-rush/v0.1.0/demo/) · [Tài liệu v0.1.0](https://tuandds.github.io/shelf-sort-rush/v0.1.0/docs/)

## Document history

| Ngày | Thay đổi |
|---|---|
| 2026-10-12 | Tạo GDD |
| 2026-10-12 | Viết GDD cho Pixel Squadron (port từ prototype HTML) |
| 2026-10-12 | Phát hành v0.1.0 |
| 2026-10-15 | Phát hành v0.2.0 |
