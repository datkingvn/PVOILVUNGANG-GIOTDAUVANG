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
  }

  // Serialize round3State.questionResults (Map) to plain object
  if (stateObj.round3State?.questionResults) {
    // questionResults might be a Map or already an object after flattenMaps
    let questionResultsObj: any = {};
    
    if (stateObj.round3State.questionResults instanceof Map) {
      // Convert Map to object, ensuring keys are preserved correctly
      stateObj.round3State.questionResults.forEach((value: any, key: string) => {
        questionResultsObj[key] = JSON.parse(JSON.stringify(value));
      });
    } else if (typeof stateObj.round3State.questionResults === 'object') {
      // Already an object, but ensure it's properly serialized
      questionResultsObj = JSON.parse(JSON.stringify(stateObj.round3State.questionResults));
    }
    
    // Ensure keys are numbers (not strings) for proper array-like access
    // Convert string keys to numbers if needed
    const normalizedResults: any = {};
    Object.keys(questionResultsObj).forEach(key => {
      const numKey = Number(key);
      if (!isNaN(numKey)) {
        normalizedResults[numKey] = questionResultsObj[key];
      } else {
        normalizedResults[key] = questionResultsObj[key];
      }
    });
    
    stateObj.round3State.questionResults = normalizedResults;
  }

  // Serialize round3State.pendingAnswers
  if (stateObj.round3State?.pendingAnswers) {
    stateObj.round3State.pendingAnswers = JSON.parse(JSON.stringify(stateObj.round3State.pendingAnswers));
  }

  await pusher.trigger("game-state", "state:update", {
    state: stateObj,
  });
}

export default pusher;

