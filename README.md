# Đường lên đỉnh Olympia - Game Show System

Hệ thống game show real-time đa thiết bị với Next.js, MongoDB, Socket.IO (tối ưu cho LAN, không phụ thuộc Pusher cloud).

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env.local` từ `env.example` và điền các biến môi trường:
```env
MONGODB_URI=mongodb://localhost:27017/olympia
PORT=3000
JWT_SECRET=your_jwt_secret_key_change_in_production
MC_DEFAULT_USERNAME=admin
MC_DEFAULT_PASSWORD=admin123
```

3. Chạy seed script để tạo MC user và sample questions:
```bash
npm run seed
```

4. Chạy development server:
```bash
npm run dev
```

Server sẽ lắng nghe trên `localhost` và toàn bộ IP trong mạng LAN (xem log khi start server).

## Cấu trúc

- `/` - Landing page với 3 lựa chọn: MC, Đội chơi, Khách
- `/login/mc` - MC login
- `/login/team` - Team login
- `/mc/*` - MC control panel (cần đăng nhập MC)
- `/stage` - Stage view (16:9 broadcast)
- `/player` - Player/Team view (mobile-first)
- `/guest` - Guest view (view-only)

## Features

- Real-time sync qua Socket.IO (phù hợp thi trong LAN)
- MC control panel với sidebar
- Round 1 game logic với auto-timeout
- Beautiful UI với dark theme và animations
- Multi-device support (MC, stage, player, guest)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- MongoDB + Mongoose
- Socket.IO
- Zustand (state management)
- Framer Motion (animations)
- Tailwind CSS

## Notes

- `GameState` được lưu trong MongoDB (single source of truth)
- Mọi thay đổi state được broadcast realtime tới các client qua Socket.IO với event `state:update`
- Auto-finalize timeout questions khi timer hết (reconcile on read/interaction)
- MC có thể tạo nhiều games và chọn active game
