import { getAuthCookie } from "./cookie";
import type { AuthUser } from "@/types/auth";

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthCookie();
  if (!user) {
    throw new Error("Chưa đăng nhập");
  }
  return user;
}

export async function requireMC(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "MC") {
    throw new Error("Chỉ MC mới có quyền truy cập");
  }
  return user;
}

export async function requireTeam(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "TEAM") {
    throw new Error("Chỉ đội chơi mới có quyền truy cập");
  }
  return user;
}

