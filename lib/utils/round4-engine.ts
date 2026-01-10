import GameState from "@/lib/db/models/GameState";
import Question from "@/lib/db/models/Question";
import type {
  GameState as GameStateType,
  Round4PackagePoints,
  Round4QuestionRef,
  Round4State,
} from "@/types/game";

/**
 * Thời lượng đồng hồ cho từng mức điểm trong Round 4
 * 10 điểm -> 10s
 * 20 điểm -> 20s
 * 30 điểm -> 30s
 */
const ROUND4_POINTS_TIMER_MAP: Record<number, number> = {
  10: 10_000,
  20: 20_000,
  30: 30_000,
};

export function getRound4QuestionDuration(points: Round4QuestionRef["points"]): number {
  return ROUND4_POINTS_TIMER_MAP[points] ?? 10_000;
}

/**
 * Trả về pattern điểm cho gói Round 4
 * 40 -> [10,10,20]
 * 60 -> [10,20,30]
 * 80 -> [20,30,30]
 */
export function getRound4PackagePattern(
  packagePoints: Round4PackagePoints
): (10 | 20 | 30)[] {
  switch (packagePoints) {
    case 40:
      return [10, 10, 20];
    case 60:
      return [10, 20, 30];
    case 80:
      return [20, 30, 30];
    default:
      throw new Error("Gói điểm không hợp lệ cho Round 4");
  }
}

/**
 * Rút ngẫu nhiên câu hỏi Round 4 theo pattern điểm, không trùng trong usedQuestionIdsByPoints
 */
export async function drawQuestionsForRound4Package(
  pattern: (10 | 20 | 30)[],
  usedQuestionIdsByPoints: Round4State["usedQuestionIdsByPoints"]
): Promise<{ questions: Round4QuestionRef[]; updatedUsed: Round4State["usedQuestionIdsByPoints"] }> {
  const updatedUsed: Round4State["usedQuestionIdsByPoints"] = {
    10: [...usedQuestionIdsByPoints[10]],
    20: [...usedQuestionIdsByPoints[20]],
    30: [...usedQuestionIdsByPoints[30]],
  };

  const results: Round4QuestionRef[] = [];

  for (const pts of pattern) {
    const excludedIds = updatedUsed[pts].length
      ? updatedUsed[pts].map((id) => id)
      : [];

    const candidates = await Question.find({
      round: "ROUND4",
      // Round 4 không có field points riêng, nên ta encode points bằng index hoặc metadata.
      // Để linh hoạt, dùng convention: field `indexPoints` nếu có, nếu không thì coi tất cả là 10.
    })
      .lean()
      .exec();

    // Lọc theo points nếu câu hỏi có metadata points, nếu không thì cho phép tất cả và rely on content
    const filteredByUsed = candidates.filter((q: any) => {
      const qId = q._id.toString();
      if (excludedIds.includes(qId)) return false;
      const qPoints: number | undefined = (q as any).points;
      if (typeof qPoints === "number") {
        return qPoints === pts;
      }
      // Nếu không có points, coi như không khớp để tránh sai luật
      return false;
    });

    if (filteredByUsed.length === 0) {
      throw new Error(
        `Không đủ câu hỏi Round 4 cho mức điểm ${pts}. Vui lòng bổ sung ngân hàng câu hỏi hoặc reset usedQuestionIds.`
      );
    }

    const randomIndex = Math.floor(Math.random() * filteredByUsed.length);
    const chosen = filteredByUsed[randomIndex];
    const chosenId = chosen._id.toString();

    results.push({
      questionId: chosenId,
      points: pts,
    });

    updatedUsed[pts].push(chosenId);
  }

  return { questions: results, updatedUsed };
}

/**
 * Helper: lấy index của team hiện tại trong danh sách teams (đang dùng TeamScore)
 */
export function getRound4TeamOrder(
  gameState: GameStateType
): { orderedTeamIds: string[] } {
  const orderedTeamIds = (gameState.teams || []).map((t) => t.teamId.toString());
  return { orderedTeamIds };
}

/**
 * Helper: chuyển sang câu hỏi tiếp theo hoặc đội tiếp theo.
 * Không lưu/sync DB, chỉ mutate object gameState trong memory.
 */
export function advanceRound4QuestionOrTeam(
  gameState: GameStateType
): void {
  if (!gameState.round4State) {
    throw new Error("Round 4 chưa được khởi tạo");
  }

  const r4 = gameState.round4State;

  const totalQuestions = r4.questions?.length ?? 0;
  let currentIndex = r4.currentQuestionIndex ?? -1; // Use -1 as default to catch undefined

  // Add defensive check and logging
  if (totalQuestions === 0) {
    console.error("[Round4] Error: No questions available, cannot advance");
    throw new Error("Round 4 không có câu hỏi nào để chuyển tiếp");
  }

  if (currentIndex < 0) {
    console.error("[Round4] Error: currentQuestionIndex is invalid:", currentIndex);
    // Set to 0 if somehow invalid but questions exist
    r4.currentQuestionIndex = 0;
    currentIndex = 0;
  }

  // Clear steal state & timer khi kết thúc xử lý 1 câu
  gameState.questionTimer = undefined;
  r4.stealWindow = undefined;
  r4.stealAnswer = undefined;

  if (currentIndex + 1 < totalQuestions) {
    // Chuyển sang câu tiếp theo trong cùng lượt
    // IMPORTANT: Preserve currentTeamId - do not clear it when advancing to next question
    const preservedTeamId = r4.currentTeamId;
    const preservedActiveTeamId = gameState.activeTeamId;
    
    r4.currentQuestionIndex = currentIndex + 1;
    const nextQuestion = r4.questions?.[r4.currentQuestionIndex];
    if (!nextQuestion) {
      console.error("[Round4] Error: Next question not found at index:", r4.currentQuestionIndex);
      throw new Error(`Không tìm thấy câu hỏi tại vị trí ${r4.currentQuestionIndex}`);
    }
    gameState.currentQuestionId = nextQuestion?.questionId;
    
    // Ensure currentTeamId is preserved - this is critical for not going to R4_IDLE
    if (!r4.currentTeamId && preservedTeamId) {
      console.warn("[Round4] Warning: currentTeamId was cleared, restoring it:", preservedTeamId);
      r4.currentTeamId = preservedTeamId;
    }
    if (!gameState.activeTeamId && preservedActiveTeamId) {
      gameState.activeTeamId = preservedActiveTeamId;
    }
    
    // Kiểm tra xem team đã dùng ngôi sao chưa
    const currentTeamId = r4.currentTeamId?.toString();
    let hasUsedStarBefore = false;
    
    if (currentTeamId && r4.starUsages) {
      // Kiểm tra starUsages (có thể là Map hoặc object)
      let starUsage = null;
      if (typeof (r4.starUsages as any).get === 'function') {
        // Mongoose Map
        starUsage = (r4.starUsages as any).get(currentTeamId);
      } else {
        // Plain object
        starUsage = (r4.starUsages as any)[currentTeamId];
      }
      
      hasUsedStarBefore = !!starUsage && !!starUsage.used;
    }
    
    if (hasUsedStarBefore) {
      // Team đã dùng ngôi sao -> tự động start timer, không cần xác nhận
      const duration = getRound4QuestionDuration(nextQuestion.points);
      const now = Date.now();
      gameState.questionTimer = {
        endsAt: now + duration,
        running: true,
      };
      gameState.phase = "R4_QUESTION_SHOW";
    } else {
      // Team chưa dùng ngôi sao -> chờ xác nhận
      gameState.questionTimer = undefined;
      gameState.phase = "R4_STAR_CONFIRMATION";
    }
    
    return;
  }

  // Hết 3 câu -> chuyển lượt đội
  const { orderedTeamIds } = getRound4TeamOrder(gameState);
  const teamCount = orderedTeamIds.length;
  const currentTurnIndex = r4.turnIndex ?? 0;

  if (currentTurnIndex + 1 < teamCount) {
    const nextTurnIndex = currentTurnIndex + 1;
    const previousTeamId = r4.currentTeamId?.toString();
    
    // Lưu team hiện tại vào danh sách đã hoàn thành
    if (!r4.completedTeamIds) {
      r4.completedTeamIds = [];
    }
    if (previousTeamId && !r4.completedTeamIds.includes(previousTeamId)) {
      r4.completedTeamIds.push(previousTeamId);
    }
    
    // Tăng turnIndex để đánh dấu số team đã hoàn thành
    r4.turnIndex = nextTurnIndex;
    
    // KHÔNG tự động chọn team tiếp theo - MC phải chọn team thủ công
    // Clear currentTeamId để yêu cầu MC chọn team
    r4.currentTeamId = undefined;
    gameState.activeTeamId = undefined;
    
    // Reset thông tin gói/câu hỏi cho lượt mới
    r4.selectedPackage = undefined;
    r4.questionPattern = undefined;
    r4.currentQuestionIndex = undefined;
    r4.questions = undefined;
    gameState.currentQuestionId = undefined;
    
    // Chuyển về phase IDLE để yêu cầu MC chọn team
    gameState.phase = "R4_IDLE";
  } else {
    // Hết đội -> kết thúc Round 4
    gameState.phase = "R4_END";
    gameState.activeTeamId = undefined;
    gameState.currentQuestionId = undefined;
  }
}

/**
 * Khởi tạo Round4State mặc định dựa trên danh sách đội hiện có
 */
export async function initRound4State(): Promise<GameStateType> {
  let gameState = await GameState.findOne();
  if (!gameState) {
    gameState = await GameState.create({
      round: "ROUND4",
      phase: "R4_IDLE",
      teams: [],
    });
  } else {
    gameState.round = "ROUND4";
    gameState.phase = "R4_IDLE";
  }

  const plain = gameState.toObject() as GameStateType;
  const { orderedTeamIds } = getRound4TeamOrder(plain);

  const firstTeamId = orderedTeamIds[0];

  gameState.round4State = {
    turnIndex: 0,
    currentTeamId: firstTeamId,
    completedTeamIds: [], // Khởi tạo danh sách đã hoàn thành
    selectedPackage: undefined,
    questionPattern: undefined,
    currentQuestionIndex: undefined,
    questions: undefined,
    starUsages: {},
    usedQuestionIdsByPoints: {
      10: [],
      20: [],
      30: [],
    },
    lastMainAnswer: undefined,
    stealWindow: undefined,
    stealAnswer: undefined,
  };

  gameState.activeTeamId = firstTeamId;
  gameState.activePackageId = undefined;
  gameState.currentQuestionId = undefined;
  gameState.questionTimer = undefined;

  return gameState as unknown as GameStateType;
}


