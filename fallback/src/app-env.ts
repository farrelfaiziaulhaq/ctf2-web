import type { Context } from "hono";
import type { Session, User } from "./db";

export type AppEnv = {
  Variables: {
    currentSession: Session | null;
    currentUser: User | null;
  };
};

export type AppContext = Context<AppEnv>;
