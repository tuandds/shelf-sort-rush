# Game Design Document

**Pixel Squadron** · Game Design Document · theo build `latest` (xem [Changelog](./changelog))

Tài liệu này mô tả Pixel Squadron là gì, chơi thế nào và vì sao được làm như vậy. Mọi con số trong đây (thời gian, công thức, kích thước, màu) đều lấy từ code hiện tại. Nếu tài liệu và code khác nhau thì code đúng, tài liệu có lỗi.

## Cách đọc tài liệu

Mỗi tính năng có một nhãn trạng thái:

| Nhãn | Ý nghĩa |
|---|---|
| <Badge type="tip" text="Live" /> | Có trong build hiện tại, chơi được ở [bản demo](https://tuandds.github.io/shelf-sort-rush/demo/). |
| <Badge type="warning" text="Coming soon" /> | Đã thiết kế hoặc lên kế hoạch, **chưa có trong game**. Chi tiết có thể đổi trước khi ra. |

Toạ độ và kích thước tính bằng **px thế giới** trên sân chơi logic **450 × 800** (tỉ lệ 9:16). Camera phóng 2.4× lên canvas 1080 × 1920 rồi co vừa màn hình (Phaser `Scale.FIT`, viền đen hai bên nếu màn khác tỉ lệ).

## Mục lục

| Phần | Chương |
|---|---|
| **I. Tầm nhìn** | [1. Tổng quan](./overview) |
| **II. Gameplay** | [2. Vòng lặp chơi](./core-loop) · [3. Luật & cơ chế](./rules) · [4. Màn chơi](./levels) · [5. Giao diện & phản hồi](./ui) |
| **III. Sản xuất** | [6. Lộ trình & câu hỏi mở](./roadmap) · [7. Changelog](./changelog) |

## Tóm tắt một đoạn

Một bức tranh pixel nhiều màu nằm phía trên màn hình. Bên dưới có ba khoang chứa máy bay, mỗi máy bay mang một màu và một số đạn. Người chơi chạm vào khoang để cho máy bay đứng đầu cất cánh lên vùng chiến đấu; máy bay tự bay tới và bắn những khối **cùng màu** đang lộ ra ở đáy tranh. Vùng chiến đấu chỉ có **5 chỗ**: nếu đầy 5 mà **5 giây** không phá được khối nào thì thua. Phá sạch tranh là thắng. Cái khó nằm ở thứ tự cất cánh: cho bay lên một màu chưa lộ ra là chiếm chỗ vô ích.
