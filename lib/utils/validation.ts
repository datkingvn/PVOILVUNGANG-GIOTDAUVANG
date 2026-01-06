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

export const createQuestionSchema = z.object({
  text: z.string().min(1, "Nội dung câu hỏi không được để trống"),
  packageId: z.string().min(1, "Gói câu hỏi không được để trống"),
  index: z.number().int().min(1).max(12),
  round: z.enum(["ROUND1", "ROUND2", "ROUND3", "ROUND4"]),
});

const ArrangeStepSchema = z.object({
  label: z.string(),
  text: z.string(),
});

export const updateQuestionSchema = z.object({
  text: z.string().min(1, "Nội dung câu hỏi không được để trống").optional(),
  index: z.number().int().min(1).max(12).optional(),
  // Round 3 specific fields
  answerText: z.string().optional(),
  acceptedAnswers: z.array(z.string()).optional(),
  type: z.enum(["reasoning", "video", "arrange"]).optional(),
  arrangeSteps: z.array(ArrangeStepSchema).optional(),
});

