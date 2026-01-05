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

  // Convert to plain object and ensure nested objects are properly serialized
  const stateObj = gameState.toObject({ flattenMaps: true });
  
  // Ensure pendingAnswers is a plain array (not Mongoose document array)
  if (stateObj.round2State?.pendingAnswers) {
    stateObj.round2State.pendingAnswers = JSON.parse(JSON.stringify(stateObj.round2State.pendingAnswers));
    console.log("Broadcasting pending answers:", stateObj.round2State.pendingAnswers.length);
    console.log("Pending answers data:", JSON.stringify(stateObj.round2State.pendingAnswers, null, 2));
  }

  await pusher.trigger("game-state", "state:update", {
    state: stateObj,
  });
}

export default pusher;

