# Pixel Squadron

Phi đội máy bay bắn sạch tranh pixel theo màu — puzzle Phaser 4 cho điện thoại.

Chạm vào một trong ba khoang chứa để cho máy bay cất cánh; máy bay tự bắn những khối pixel cùng màu đang lộ ra ở đáy bức tranh. Vùng chiến đấu chỉ chứa 5 máy bay: đầy 5 mà 5 giây không phá được khối nào là thua. 10 màn, kèm máy bay ẩn, máy bay nối đôi, khối lớn và trùm cuối.

Port sang Phaser 4 từ bản prototype HTML/Canvas gốc, giữ nguyên luật chơi và dữ liệu màn.

Chơi tại https://tuandds.github.io/shelf-sort-rush/demo/ · tài liệu và Game Design Document tại https://tuandds.github.io/shelf-sort-rush/docs/.

## Chạy

```bash
npm install
npm run dev      # http://localhost:8080
npm run build
```

## Phát hành

Site được build trên máy rồi đẩy lên nhánh `gh-pages` (không có CI).

```bash
npm run release:latest                  # after pushing main: update https://tuandds.github.io/shelf-sort-rush/
npm version minor && npm run release    # publish a frozen copy at /shelf-sort-rush/vX.Y.0/
```

Landing page liệt kê mọi phiên bản. Chi tiết xem `docs/guide/deployment.md`.

## Mã nguồn

| File | Nội dung |
|---|---|
| `src/game/data.ts` | Bảng màu, dữ liệu 10 màn, các hằng số luật chơi |
| `src/scenes/Game.ts` | Logic (sinh màn, ngắm bắn, bế tắc) + vẽ + HUD |
| `src/game/art.ts` | Vẽ máy bay (5 skin), đạn (5 loại), panel gradient |
| `src/ui/Popups.ts` | Popup bắt đầu/thắng/thua, tính năng mới, chọn màn, tuỳ biến, toast |
| `src/game/TextPool.ts` | Tái sử dụng Text object cho chữ vẽ mỗi frame |
