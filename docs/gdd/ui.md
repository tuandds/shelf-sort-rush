# 5. Giao diện & phản hồi

## 5.1 Bố cục màn hình <Badge type="tip" text="Live" />

Sân chơi logic 450 × 800, từ trên xuống:

| Vùng | Vị trí | Nội dung |
|---|---|---|
| **HUD** | y 9–53 | Ô **MÀN** (số màn) · thanh tiến độ (tên màn, *còn N khối*, thanh xanh lá → xanh dương) · 3 nút ↻ chơi lại, 🎨 tuỳ biến, ▦ chọn màn |
| **Khung tranh** | từ y 66 | Hàng chip màu (ô màu + số khối còn lại; xuống 2 hàng khi > 6 màu), board 21 × 12 ô, vạch nét đứt là đáy board |
| **Vùng chiến đấu** | giữa | 5 vòng tròn nét đứt là 5 chỗ đậu, so le cao thấp |
| **Khoang chứa** | 200 px dưới cùng | 3 cột, mỗi cột hiện tối đa 4 máy bay; chiếc đầu to nhất, chiếc cuối mờ hơn để gợi ý hàng còn dài |

## 5.2 Tín hiệu trạng thái <Badge type="tip" text="Live" />

| Tín hiệu | Ý nghĩa |
|---|---|
| Viền trắng nhấp nháy quanh khối | Khối đang lộ ra, bắn được ngay |
| Chip màu sáng có viền | Màu đó đang có khối lộ ra; chip mờ = màu đang bị che |
| Vòng xanh lá nhấp nháy quanh máy bay đầu khoang | Cho bay lên là bắn được ngay |
| Vòng vàng + dây vàng nét đứt | Cặp máy bay nối đôi |
| Máy bay xám, số đạn `?` | Máy bay ẩn |
| Máy bay lắc nhẹ và nhấp nháy trên trời | Đã chờ quá 1.2 s mà chưa có mục tiêu |
| Vùng chiến đấu viền đỏ, phủ đỏ, thanh đỏ thu ngắn, chữ *ĐẦY 5 · Ns* | Đã đủ 5 máy bay; đồng hồ bế tắc đang đếm |
| Chữ *TĂNG TỐC ×2* | Ba khoang đã trống, mọi thứ nhanh gấp đôi |
| Số giữa khối lớn | Độ bền còn lại |

## 5.3 Hiệu ứng <Badge type="tip" text="Live" />

| Sự kiện | Hiệu ứng |
|---|---|
| Đạn trúng khối | 9 mảnh vỡ cùng màu (rơi với trọng lực 900 px/s²), khối loé trắng 0.25 s, rung màn hình |
| Khối lớn vỡ | 90 mảnh vỡ, rung mạnh hơn |
| Máy bay bắn | máy bay giật xuống một chút, luồng phản lực dài ra |
| Chạm màn hình | gợn sóng tròn 0.5 s |
| Rung máy (`navigator.vibrate`) | cất cánh 12 ms · trúng 10 ms (khối lớn 8, vỡ 20) · thắng 20-50-30 · thua 40-60-40 · đếm ngược bế tắc 18 ms ở 3, 2, 1 s · tắt khi chạy `?autoplay=1` |

## 5.4 Popup <Badge type="tip" text="Live" />

| Popup | Khi nào | Nội dung |
|---|---|---|
| **PIXEL SQUADRON** | Mở game | Luật chơi tóm tắt, nút *BẮT ĐẦU* |
| **HOÀN THÀNH!** | Thắng | Tên màn vừa phá, 10 chấm tiến độ, *MÀN TIẾP THEO ›* |
| **BẾ TẮC!** | Thua | Mẹo chơi, *THỬ LẠI* |
| **HẾT MÁY BAY!** | Thua vì cả ba khoang hết máy bay mà tranh còn khối (màn xếp tay thiếu đạn) | Gợi ý kiểm tra lại số đạn trong Level Editor, *THỬ LẠI* |
| **TÍNH NĂNG MỚI** | Lần đầu vào màn có cơ chế mới (ẩn, nối đôi, khối lớn, trùm), mỗi cơ chế một lần mỗi phiên | 3 ô minh hoạ + giải thích, *ĐÃ HIỂU*. Game tạm dừng khi popup mở |
| **CHỌN MÀN** | Nút ▦ | 10 nút (tên · số màu), màn hiện tại viền xanh. Game tạm dừng |
| **TÙY BIẾN** | Nút 🎨 | 5 skin máy bay (Tiêm kích, Mũi nhọn, Tàng hình, Cánh đôi, Đĩa bay) và 5 loại đạn (Tia lửa, Laser, Cầu plasma, Tên lửa, Sao băng), có hình xem trước. Game tạm dừng |

Toast (nền tối, hiện 1.7 s) báo lý do một lần chạm không có tác dụng.
