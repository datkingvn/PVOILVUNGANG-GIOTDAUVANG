export type UserRole = "MC" | "TEAM" | "GUEST";

export interface AuthUser {
  role: UserRole;
  userId?: string;
  teamId?: string;
}

