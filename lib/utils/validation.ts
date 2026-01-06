import { z } from "zod";
import type { Round } from "@/types/game";

export const loginSchema = z.object({
  username: z.string().min(1, "Tên đăng nhập không được để trống"),
  password: z.string().min(1, "Mật khẩu không được để trống"),
});

export const teamLoginSchema = z.object({
  teamId: z.string().min(1, "Vui lòng chọn đội"),
  password: z.string().min(1, "Mật khẩu không được để trống"),
});

export const createTeamSchema = z.object({
  name: z.string().min(1, "Tên đội không được để trống"),
  password: z.string().min(1, "Mật khẩu không được để trống"),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1, "Tên đội không được để trống").optional(),
  password: z
    .union([z.string().min(1, "Mật khẩu không được để trống"), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
});

export const createPackageSchema = z.object({
  number: z.number().int().min(1).max(4),
  round: z.enum(["ROUND1", "ROUND2", "ROUND3", "ROUND4"]),
});

const RoundEnum = z.enum(["ROUND1", "ROUND2", "ROUND3", "ROUND4"]);

export const createQuestionSchema = z
  .object({
    text: z.string().min(1, "Nội dung câu hỏi không được để trống"),
    packageId: z.string().min(1, "Gói câu hỏi không được để trống"),
    // index: giữ min = 1, giới hạn max phụ thuộc từng vòng:
    // - ROUND1/2: vẫn nên giới hạn (12) theo thiết kế gói
    // - ROUND3: UI đã giới hạn 1-4
    // - ROUND4: không giới hạn số câu trong ngân hàng, nên không set max ở đây
    index: z.number().int().min(1),
    round: RoundEnum,
    // Round 4: bắt buộc chọn points 10/20/30
    points: z.number().int().min(10).max(30).optional(),
  })
  .superRefine((data, ctx) => {
    // ROUND4: validate points bắt buộc và chỉ cho phép 10/20/30
    if (data.round === "ROUND4") {
      if (data.points === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Vui lòng chọn mức điểm (10/20/30) cho câu hỏi Round 4",
          path: ["points"],
        });
      } else if (![10, 20, 30].includes(data.points)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Điểm Round 4 chỉ được phép là 10, 20 hoặc 30",
          path: ["points"],
        });
      }
    }

    // ROUND1/2: vẫn giới hạn index tối đa 12
    if (data.round === "ROUND1" || data.round === "ROUND2") {
      if (data.index > 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Số thứ tự câu hỏi không được lớn hơn 12 cho vòng này",
          path: ["index"],
        });
      }
    }
  });

const ArrangeStepSchema = z.object({
  label: z.string(),
  text: z.string(),
});

export const updateQuestionSchema = z
  .object({
    text: z.string().min(1, "Nội dung câu hỏi không được để trống").optional(),
    // Cho phép index >= 1, không set max cố định để ROUND4 không bị giới hạn;
    // sẽ kiểm tra theo round bên dưới nếu cần.
    index: z.number().int().min(1).optional(),
    // Round 3 specific fields
    answerText: z.string().optional(),
    acceptedAnswers: z.array(z.string()).optional(),
    type: z.enum(["reasoning", "video", "arrange"]).optional(),
    arrangeSteps: z.array(ArrangeStepSchema).optional(),
    // Round 4: cho phép update points
    points: z.number().int().min(10).max(30).optional(),
    // Cần round để có thể validate index theo vòng khi update
    round: RoundEnum.optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.round === "ROUND1" || data.round === "ROUND2") && data.index !== undefined) {
      if (data.index > 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Số thứ tự câu hỏi không được lớn hơn 12 cho vòng này",
          path: ["index"],
        });
      }
    }
  });

