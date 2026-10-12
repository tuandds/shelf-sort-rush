# 1. Tổng quan

| | |
|---|---|
| **Tên** | Pixel Squadron |
| **Thể loại** | Puzzle sắp xếp theo màu, thời gian thực, một chạm |
| **Nền tảng** | Web, ưu tiên điện thoại màn dọc |
| **Engine** | Phaser 4, TypeScript, Vite |
| **Ngôn ngữ trong game** | Tiếng Việt |
| **Nguồn gốc** | Port từ prototype HTML/Canvas 2D một file (`Plane Shoot/index.html`), giữ nguyên luật và dữ liệu màn |

## 1.1 Pitch

Phi đội máy bay bắn sạch tranh pixel theo màu. Bạn không điều khiển máy bay; bạn chỉ quyết định **chiếc nào cất cánh và khi nào**. Mỗi lần chạm là một lần đặt cược vào chỗ trống trên bầu trời.

## 1.2 Người chơi mục tiêu

Người chơi casual trên điện thoại, thích puzzle kiểu "sort theo màu" nhưng muốn có nhịp nhanh và cảm giác hành động: phiên chơi ngắn (một màn khoảng 20–60 giây), thao tác chỉ bằng một ngón cái.

## 1.3 Trụ cột thiết kế

| Trụ cột | Trong game |
|---|---|
| **Một chạm, nhiều hệ quả** | Chỉ có một thao tác là chạm khoang chứa; mọi chiều sâu đến từ thứ tự cất cánh. |
| **Đọc được ngay** | Khối lộ ra có viền sáng nhấp nháy, máy bay đầu hàng có vòng xanh khi bắn được ngay, chip màu ở đầu tranh sáng lên khi màu đó đang lộ. |
| **Áp lực có kiểm soát** | Không có đồng hồ màn chơi; áp lực duy nhất là 5 chỗ và 5 giây bế tắc. |
| **Phần thưởng thị giác** | Mỗi phát trúng có mảnh vỡ, rung màn hình nhẹ, rung máy; bức tranh pixel lộ dần rồi biến mất. |
