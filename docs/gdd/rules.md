# 3. Luật & cơ chế

Mọi hằng số nằm ở `src/game/data.ts`, logic ở `src/scenes/Game.ts`.

## 3.1 Thắng và thua <Badge type="tip" text="Live" />

| | Điều kiện | Sau đó |
|---|---|---|
| **Thắng** | Số khối còn lại về 0 (tính cả độ bền khối lớn). | 0.7 s sau hiện popup **HOÀN THÀNH!** → *Màn tiếp theo* (màn 10 → *Chơi lại từ đầu*). |
| **Thua** | Đồng hồ bế tắc đạt **5 s** (`STALL_MAX`). | 0.9 s sau hiện popup **BẾ TẮC!** → *Thử lại* màn đó. |

**Đồng hồ bế tắc** chỉ chạy khi trên board có ít nhất một khối bắn được, và một trong hai điều sau đúng:

- vùng chiến đấu **đầy 5 máy bay**, hoặc
- có ít nhất một máy bay đang bay nhưng **không có gì xảy ra được**: không còn viên đạn nào đang bay, không máy bay nào trên trời có mục tiêu, và không cất cánh được chiếc nào bắn được ngay (kể cả vì cặp nối đôi chưa đủ điều kiện).

Mỗi khối bị phá (hoặc trừ độ bền) đặt đồng hồ về 0. Khi board trống tạm thời vì mảng sau đang trôi vào, đồng hồ không chạy. Lúc còn 3, 2, 1 giây máy rung nhẹ.

Khi chưa có máy bay nào trên trời thì không bao giờ thua: người chơi luôn có thể cho bay một chiếc lên (nó sẽ đứng chờ). Ngoại lệ: cả ba khoang đã hết máy bay mà tranh vẫn còn khối (chỉ xảy ra khi khoang xếp tay thiếu đạn) — đồng hồ bế tắc cũng chạy và popup là **HẾT MÁY BAY!**

## 3.2 Board và đội hình <Badge type="tip" text="Live" />

| Thông số | Giá trị |
|---|---|
| Bề ngang board | 21 cột (`BCOLS`) |
| Số hàng khối hiển thị | 10 (`BROWS`) + 2 hàng trống phía dưới (`GAP`) |
| Cỡ ô | `floor(min((450 − 40) / 21, chiều cao tranh / 12))` = **19 px** với layout hiện tại |
| Căn ngang | Toàn bộ đội hình được căn giữa theo 21 cột, bất kể `ox` viết trong dữ liệu màn |

Khối **không tự trôi**. Khi hàng thấp nhất còn khối bị phá sạch, cả đội hình bước xuống cho tới khi khối thấp nhất lại nằm ở hàng 10, với tốc độ 6 hàng/giây (mượt chứ không nhảy). Đầu màn, đội hình được đặt sao cho khối thấp nhất nằm ngay hàng 10.

**Khối lộ ra** của một cột là khối thấp nhất trong cột đó, xét mọi mảng hình. Khối đã có đủ đạn đang bay tới (số viên ≥ độ bền) được bỏ qua, nên khối ngay phía trên trở thành mục tiêu kế tiếp. Khối còn nằm phía trên mép board thì chưa bắn được.

## 3.3 Máy bay <Badge type="tip" text="Live" />

### Cất cánh

- Chạm vào khoang chứa (vùng dưới cùng, chia 3 cột đều nhau) để cho máy bay đầu hàng cất cánh vào chỗ trống đầu tiên.
- Vùng chiến đấu có **5 chỗ** (`SLOTS`), xếp so le cao thấp.
- Khoang trống → toast *Khoang này đã hết máy bay*. Đã đủ 5 → toast *Vùng chiến đấu đã đầy 5 máy bay!*

### Hành vi tự động

| Trạng thái | Hành vi |
|---|---|
| `enter` | Bay từ khoang chứa vào chỗ của mình. |
| `idle` | Có khối cùng màu đang lộ ra → nhắm khối **thấp nhất**, bằng nhau thì lấy **bên trái**. Không có → đứng chờ, vẫn giữ chỗ; sau 1.2 s chờ thì lắc nhẹ và nhấp nháy. |
| `attack` | Bay ngang tới cột mục tiêu, cách tâm cột dưới 4 px thì bắn. Bắn xong nhắm luôn mục tiêu kế tiếp để không bị kéo về chỗ. |
| `leave` | Hết đạn, hoặc màu của nó đã sạch khỏi tranh → nhả chỗ, bay xuống 430 px/s và mờ dần. |

| Thông số | Giá trị |
|---|---|
| Hồi giữa hai phát | 0.16 s (`FIRE_CD`) |
| Tốc độ đạn | 900 px/s (`BULLET_V`) |
| Bám mục tiêu | nội suy `min(1, dt × 7)` mỗi frame (khi chờ: `dt × 1.3`) |
| Đạn trúng | khi đầu đạn chạm 55% chiều cao ô mục tiêu; vị trí tính lại mỗi frame vì đội hình có thể đang trượt |

### Tăng tốc ×2

Khi cả ba khoang chứa đều trống, mọi máy bay còn lại di chuyển, bắn và rời đi **nhanh gấp đôi**. Vùng chiến đấu hiện chữ *TĂNG TỐC ×2*.

## 3.4 Sinh máy bay cho một màn <Badge type="tip" text="Live" />

1. **Mô phỏng thứ tự phá khối**: trên một bản sao board, lặp lại "phá khối lộ ra thấp nhất (bằng nhau lấy bên trái)" cho tới hết. Kết quả là thứ tự màu sẽ xuất hiện.
2. **Chia đạn theo màu**: số khối của mỗi màu được chia thành các máy bay **10–20 viên**, tổng đúng bằng số khối:
   - còn ≥ 30 → tách một chiếc 20;
   - còn 10–20 → một chiếc đúng bằng phần còn lại;
   - còn 21–29 → hai chiếc (n − 10) và 10.

   Ví dụ: 25 → 15 + 10, 33 → 20 + 13, 48 → 20 + 18 + 10.
3. **Sắp thứ tự**: mỗi máy bay lấy vị trí khối đầu tiên nó phụ trách trong thứ tự ở bước 1; xếp tăng dần, rồi mỗi cặp liền kề có **30%** bị đổi chỗ để bớt đoán trước.
4. **Chia vào 3 khoang** lần lượt (chiếc thứ j vào khoang `j mod 3`).

Khi một màu đã sạch khỏi tranh, mọi máy bay màu đó còn trong khoang bị bỏ đi.

**Khoang xếp tay.** Màn có trường `queues` (tạo bằng Plane Editor của [Level Editor](/guide/level-editor)) bỏ qua cả 4 bước trên: 3 khoang được dùng nguyên thứ tự đã xếp, mỗi máy bay mang sẵn màu, số đạn, cờ ẩn và số cặp nối đôi. Chiếc đứng đầu khoang lúc bắt đầu không bao giờ ẩn.

## 3.5 Máy bay ẩn <Badge type="tip" text="Live" />

Ở màn có `hidden`, mỗi máy bay **không đứng đầu** khoang lúc bắt đầu màn có xác suất `hidden` bị ẩn: hiện màu xám `#4b5578` và số đạn `?`. Khi lên đầu hàng nó lộ màu thật, có một vòng sáng loé lên trong 0.5 s và máy rung nhẹ. Máy bay thuộc cặp nối đôi không bao giờ bị ẩn.

## 3.6 Máy bay nối đôi <Badge type="tip" text="Live" />

Ở màn có `connected = N`, tạo tối đa N cặp. Cặp thứ n nằm ở khoang `(2n) mod 3` và `(2n + 1) mod 3`, cùng độ sâu n trong hàng; chiếc thứ hai được chọn sao cho **khác màu** và **số đạn gần nhất** với chiếc thứ nhất.

- Hai chiếc chỉ cất cánh **cùng nhau**: cả hai phải đứng đầu khoang của mình (hoặc chiếc kia đứng ngay sau trong cùng khoang) **và** còn ít nhất **2 chỗ trống**.
- Thiếu điều kiện → toast *Cặp nối đôi: chiếc còn lại chưa lên đầu hàng* hoặc *Cặp nối đôi cần 2 chỗ trống*.
- Lên tới vùng chiến đấu thì hai chiếc hoạt động độc lập.
- Trong khoang, chiếc thuộc cặp có vòng vàng; hai chiếc cùng cặp được nối bằng dây vàng nét đứt.

## 3.7 Khối lớn <Badge type="tip" text="Live" />

Ở màn có `big`, trên **mỗi mảng hình** thử đặt `n` khối lớn:

| Độ bền | Kích thước |
|---|---|
| 5–6 | 2 × 2 |
| 7–8 | 3 × 3 |
| 9–10 | 4 × 4 |
| `size` ghi rõ trong dữ liệu (lõi trùm) | 5 × 5 |

- Độ bền chọn ngẫu nhiên đều trong khoảng `hp` của màn.
- Vị trí: thử tối đa 120 ô vuông ngẫu nhiên, chỉ nhận vùng đã kín khối và chưa có khối lớn. Ưu tiên vùng mà một màu chiếm ≥ 60%; khối lớn mang màu chiếm đa số.
- Không được làm màu nào còn lại 1–9 khối (vì máy bay mang ít nhất 10 viên).
- Mỗi phát trúng trừ 1 độ bền và loé sáng; về 0 thì vỡ cả vùng (90 mảnh vỡ, rung mạnh hơn). Khối lớn chắn mọi cột nó phủ.

Vì vị trí và độ bền là ngẫu nhiên, tổng số khối của màn có khối lớn thay đổi mỗi lần chơi (xem [Màn chơi](./levels)).
