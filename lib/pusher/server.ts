import Pusher from "pusher";
import GameState from "@/lib/db/models/GameState";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export async function broadcastGameState() {
  const gameState = await GameState.findOne();
  if (!gameState) return;

  await pusher.trigger("game-state", "state:update", {
    state: gameState.toObject(),
  });
}

export default pusher;

