# 2. Vòng lặp chơi

## 2.1 Từng khoảnh khắc <Badge type="tip" text="Live" />

1. **Nhìn** đáy bức tranh: những khối có viền sáng là khối đang lộ ra, bắn được ngay. Chip màu ở đầu tranh cũng sáng lên với các màu đó.
2. **Chọn** một trong ba khoang chứa. Máy bay đứng đầu khoang có vòng xanh nhấp nháy nếu màu của nó đang lộ ra.
3. **Chạm** khoang đó: máy bay cất cánh, bay vào một chỗ trống trong vùng chiến đấu.
4. Máy bay **tự bắn**: bay ngang tới cột có khối cùng màu thấp nhất, bắn từng viên một, mỗi viên phá một khối (hoặc trừ 1 độ bền của khối lớn).
5. Hết đạn, hoặc màu của nó đã sạch khỏi tranh, máy bay bay xuống và **nhả chỗ**.
6. Khi hàng dưới cùng của tranh bị phá sạch, cả đội hình **bước xuống một hàng** và hàng mới hiện ra ở trên.

Không có máy bay nào cần ngắm tay. Quyết định duy nhất là cất cánh chiếc nào, lúc nào.

## 2.2 Một màn <Badge type="tip" text="Live" />

```
Bắt đầu màn ──► (popup tính năng mới, nếu có) ──► chơi
   ▲                                                │
   │                    phá sạch mọi khối ──► HOÀN THÀNH! ──► màn tiếp theo
   │                                                │
   └── THỬ LẠI ◄── BẾ TẮC! ◄── đầy/kẹt 5 giây ◄─────┘
```

- Mỗi màn là một chồng nhiều "mảng hình" (wave). Board chỉ hiện 10 hàng; các mảng phía trên trôi vào dần khi hàng dưới bị phá.
- Tổng số đạn của mọi máy bay một màu **đúng bằng** số khối màu đó (tính cả độ bền khối lớn). Không thừa viên nào, nên không có máy bay "dự phòng" để phung phí.

## 2.3 Dài hạn <Badge type="tip" text="Live" />

10 màn chơi tuần tự, độ khó tăng dần; mỗi màn có thể chọn lại bất cứ lúc nào qua nút chọn màn. Hết màn 10 thì quay về màn 1. Không có lưu tiến độ hay mở khoá màn (xem [Lộ trình](./roadmap#open-questions)).

Tuỳ biến **skin máy bay** và **loại đạn** chỉ thay đổi hình ảnh, không đổi luật. Lựa chọn được lưu trong `localStorage` (`ps_skin`, `ps_ammo`).
