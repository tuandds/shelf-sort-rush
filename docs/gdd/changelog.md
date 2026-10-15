# 7. Changelog

Mỗi phiên bản đã phát hành đều chơi được tại URL riêng. [Landing page](https://tuandds.github.io/shelf-sort-rush/) liệt kê tất cả.

## latest (main) <Badge type="tip" text="Live" />

- **Level Editor** trên web (nút mới ở trang chủ), 4 cột: Colour Bank, Wave Editor (vẽ tranh pixel theo từng mảng, xem cả đội hình, bật máy bay ẩn / nối đôi / khối lớn / lõi trùm), Plane Editor (xếp tay từng máy bay: màu, số đạn, ẩn, nối đôi, kéo thả giữa 3 khoang, đối chiếu đạn với số khối; nút 🎲 Random sinh nhanh một bản để chỉnh tiếp), Level Bank (danh sách màn, lưu trong trình duyệt kèm bản sao lưu, xuất/nhập file JSON, copy TypeScript). Chơi thử hoặc Auto Play ngay trong trình duyệt.
- **Bảng màu mới:** một bảng 16 màu lấy từ editor Marble Drop thay cho 10 màu cũ. Các màn gốc giữ nguyên ký tự, chỉ đổi sang màu Marble Drop gần nhất; thêm 6 màu mới `l u n m d s`. Colour Bank của editor chia thành Active Palette và Bank như editor Marble Drop.
- **Khoang xếp tay:** màn có thể định sẵn thứ tự máy bay; nếu hết máy bay mà tranh còn khối, game báo *HẾT MÁY BAY!* thay vì kẹt.
- Game chơi được danh sách màn từ editor qua `?custom=1`, nhảy thẳng vào màn bằng `?level=N`, bot tự chơi bằng `?autoplay=1`.

[Chơi bản latest](https://tuandds.github.io/shelf-sort-rush/demo/)

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
