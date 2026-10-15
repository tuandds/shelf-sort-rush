# 4. Màn chơi

Dữ liệu màn ở `LEVELS` trong `src/game/data.ts`. Mỗi màn là danh sách mảng hình: chuỗi ký tự, mỗi ký tự là một màu (`.` là ô trống), kèm cột bắt đầu `ox` và độ lệch dọc `dy` (âm = còn ở phía trên board, trôi vào sau).

## 4.1 Bảng màu <Badge type="tip" text="Live" />

| Ký tự | Màu | | Ký tự | Màu |
|---|---|---|---|---|
| `r` | <span style="color:#ff4d5e">■</span> `#ff4d5e` đỏ | | `g` | <span style="color:#4ade80">■</span> `#4ade80` xanh lá |
| `p` | <span style="color:#ff9bb3">■</span> `#ff9bb3` hồng | | `c` | <span style="color:#22d3ee">■</span> `#22d3ee` xanh ngọc |
| `y` | <span style="color:#ffd23f">■</span> `#ffd23f` vàng | | `o` | <span style="color:#fb923c">■</span> `#fb923c` cam |
| `k` | <span style="color:#5b6493">■</span> `#5b6493` xám xanh | | `b` | <span style="color:#2f6bf0">■</span> `#2f6bf0` xanh dương đậm |
| `w` | <span style="color:#f4f6fb">■</span> `#f4f6fb` trắng | | `v` | <span style="color:#cf6bff">■</span> `#cf6bff` tím |

`c` và `b` được tách hẳn (xanh ngọc và xanh dương đậm) vì trước đây hai màu này rất dễ nhầm. `k` được làm sáng để không chìm vào nền tối.

**Bảng màu Marble Drop** (chữ in hoa, thêm cho Level Editor; 10 màn gốc không dùng):

| Ký tự | Màu | | Ký tự | Màu |
|---|---|---|---|---|
| `Y` | <span style="color:#fcfc10">■</span> `#fcfc10` yellow | | `N` | <span style="color:#c25e47">■</span> `#c25e47` brown |
| `P` | <span style="color:#fccefd">■</span> `#fccefd` pink | | `C` | <span style="color:#bd194a">■</span> `#bd194a` crimson |
| `R` | <span style="color:#f2447b">■</span> `#f2447b` red | | `D` | <span style="color:#27993c">■</span> `#27993c` darkgreen |
| `L` | <span style="color:#b7fd33">■</span> `#b7fd33` lime | | `G` | <span style="color:#44f245">■</span> `#44f245` green |
| `B` | <span style="color:#3657f9">■</span> `#3657f9` darkBlue | | `S` | <span style="color:#75fefd">■</span> `#75fefd` lightblue |
| `U` | <span style="color:#aa44f6">■</span> `#aa44f6` purple | | `Q` | <span style="color:#db7afa">■</span> `#db7afa` lightpurple |
| `X` | <span style="color:#5d5765">■</span> `#5d5765` black | | `O` | <span style="color:#f5ae0b">■</span> `#f5ae0b` orange |
| `E` | <span style="color:#29c3fc">■</span> `#29c3fc` blue2 | | `W` | <span style="color:#ffffff">■</span> `#ffffff` white |

Một số màu Marble Drop khá gần màu gốc (ví dụ `R` red và `r` đỏ, `W` white và `w` trắng). Tránh dùng hai màu gần nhau trong cùng một màn, người chơi sẽ khó phân biệt.

## 4.2 Danh sách màn <Badge type="tip" text="Live" />

Số khối tính cả độ bền khối lớn. Ở màn có khối lớn, số khối và số máy bay thay đổi mỗi lần chơi (đo qua 20 lần sinh màn).

| # | Tên | Màu | Mảng hình | Khối | Máy bay | Cơ chế |
|---|---|---|---|---|---|---|
| 1 | Trái tim | 2 | 3 | 210 | 11 | — |
| 2 | Mặt cười | 3 | 3 | 258 | 14 | — |
| 3 | Đàn nấm | 4 | 10 | 260 | 13 | — |
| 4 | Đội hoa | 5 | 10 | 260 | 15 | Máy bay ẩn 45% |
| 5 | Hạm sọc | 6 | 10 | 280 | 16 | Máy bay ẩn 40% |
| 6 | Tổ ong | 9 | 18 | 288 | 18 | 4 cặp nối đôi |
| 7 | Mê cung | 8 | 24 | 288 | 20 | 3 cặp nối đôi |
| 8 | Hỗn chiến | 6 | 8 | 328–356 | 18–22 | 2 khối lớn/mảng, độ bền 5–10 |
| 9 | Pháo đài | 9 | 8 | 282–317 | 18–20 | 3 khối lớn/mảng, độ bền 5–10 |
| 10 | Trùm cuối | 5 | 10 | 257–277 | 15–16 | Lõi trùm 5×5 độ bền 20 + 3 khối lớn 6–10/mảng, ẩn 45%, 3 cặp nối đôi |

## 4.3 Ý đồ từng màn <Badge type="tip" text="Live" />

- **1–2 · Trái tim, Mặt cười:** ba bản sao của cùng một hình chồng lên nhau, 2–3 màu. Dạy vòng lặp cơ bản.
- **3 · Đàn nấm:** 2 cột × 5 tầng nấm so le, 4 màu.
- **4 · Đội hoa:** 5 màu xếp theo **sọc dọc** chứ không theo vòng đồng tâm. Bản cũ xếp đồng tâm làm màu ở giữa (`p`, `v`) lộ ra rất muộn, máy bay của chúng đậu lâu và chiếm hết 5 chỗ.
- **5 · Hạm sọc:** 6 màu cả màn nhưng mỗi lúc tối đa 4; bộ màu đổi dần theo tầng, màu cũ biến mất hẳn trước khi màu mới tới, nên không bao giờ kẹt vì 5 chỗ bị 5 màu khác chiếm.
- **6 · Tổ ong:** board chia 3 làn, 9 màu; mỗi màu xuất hiện ở hai chỗ cách xa nhau, nên máy bay gánh cả hai chỗ phải đậu giữa chừng.
- **7 · Mê cung:** 4 làn, mỗi màu chiếm 2 mảng liên tiếp (một máy bay bắn hết trong một lượt). Hai làn giữa có màu quay lại sau khi nghỉ 2 mảng.
- **8 · Hỗn chiến:** tàu vũ trụ 9×9 kiểu Space Invaders vẽ theo vai trò (thân, mắt, chân, râu, bàn chân); đúng 5 màu cố định bằng số chỗ, vì khối lớn đã ngốn nhiều đạn của một màu.
- **9 · Pháo đài:** tường thành 9×5, 9 màu, nhiều khối lớn.
- **10 · Trùm cuối:** thân trùm 11×7 (đỏ, mắt vàng, nửa dưới kẻ sọc r/y/c để luôn có 3 màu bắn được) xuất hiện hai lần, xen giữa là hộ tống 5×5 chỉ dùng 2 màu. Gom cả ba cơ chế.

## 4.4 Dữ liệu cân bằng (bot tham lam) <Badge type="tip" text="Live" />

Bot dùng để kiểm thử: mỗi 0.15 s, cho bay chiếc đầu hàng nào **bắn được ngay**; nếu không có máy bay nào trên trời thì cho bay bất kỳ chiếc nào cất cánh được. 30 lần mỗi màn, so với bản HTML gốc chạy cùng khung 450 × 800:

| Màn | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Bản Phaser thắng | 16 | 0 | 0 | 8 | 18 | 17 | 3 | 7 | 0 | 1 |
| Bản gốc thắng | 16 | 0 | 0 | 8 | 18 | 12 | 4 | 2 | 0 | 2 |

Hai bản cho kết quả như nhau trong biên độ ngẫu nhiên, nên luật chơi được port đúng. Bot không tính trước, nên con số này chỉ cho biết màn nào **phạt nặng** lối chơi "thấy là bắn" (màn 2, 3, 9), không phải tỉ lệ thắng của người chơi thật.
