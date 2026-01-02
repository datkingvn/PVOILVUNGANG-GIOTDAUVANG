# Đường lên đỉnh Olympia - Game Show System

Hệ thống game show real-time đa thiết bị với Next.js, MongoDB, Pusher Channels.

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env.local` từ `env.example` và điền các biến môi trường:
```
MONGODB_URI=mongodb://localhost:27017/olympia
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=ap1
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=ap1
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

## Cấu trúc

- `/` - Landing page với 3 lựa chọn: MC, Đội chơi, Khách
- `/login/mc` - MC login
- `/login/team` - Team login
- `/mc/*` - MC control panel (cần đăng nhập MC)
- `/stage` - Stage view (16:9 broadcast)
- `/player` - Player/Team view (mobile-first)
- `/guest` - Guest view (view-only)

## Features

- Real-time sync với Pusher Channels
- MC control panel với sidebar
- Round 1 game logic với auto-timeout
- Beautiful UI với dark theme và animations
- Multi-game support

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- MongoDB + Mongoose
- Pusher Channels
- Zustand (state management)
- Framer Motion (animations)
- Tailwind CSS

## Notes

- GameState được lưu trong MongoDB (single source of truth)
- Mọi thay đổi state được broadcast qua Pusher channel `game-{gameId}` với event `state:update`
- Auto-finalize timeout questions khi timer hết (reconcile on read/interaction)
- MC có thể tạo nhiều games và chọn active game

