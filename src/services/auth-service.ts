import { randomUUID } from "node:crypto";
import type { UserRecord } from "./contracts";
import type { UserCreateInput, UserStore } from "./user-store";

type Session = {
  userId: string;
  createdAt: number;
};

export type AuthResult = {
  user: UserRecord;
  token: string;
};

export function createAuthService(userStore: UserStore) {
  const sessions = new Map<string, Session>();

  function generateToken(): string {
    return randomUUID();
  }

  function createSession(userId: string): string {
    const token = generateToken();
    sessions.set(token, {
      userId,
      createdAt: Date.now(),
    });
    return token;
  }

  return {
    register(input: UserCreateInput): AuthResult {
      const user = userStore.create(input);
      const token = createSession(user.id);
      return { user, token };
    },

    login(name: string, password: string): AuthResult {
      const user = userStore.verifyPassword(name, password);
      if (!user) {
        throw new Error("Invalid credentials.");
      }
      const token = createSession(user.id);
      return { user, token };
    },

    logout(token: string): void {
      sessions.delete(token);
    },

    resolveUserFromToken(token: string | undefined): UserRecord | null {
      if (!token) {
        return null;
      }
      const session = sessions.get(token);
      if (!session) {
        return null;
      }
      return userStore.findById(session.userId);
    },

    generateToken,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
