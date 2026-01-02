import jwt from "jsonwebtoken";
import type { AuthUser } from "@/types/auth";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-in-production";

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch (error) {
    throw new Error("Token không hợp lệ");
  }
}

