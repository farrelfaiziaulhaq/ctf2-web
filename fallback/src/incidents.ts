import type { User } from "./db";

export function parseIncidentQueueFromRequest(raw: string) {
  const params = new URLSearchParams(raw);
  const validatedQueue = params.get("queue") || "personal";
  const persistedQueue = params.getAll("queue").at(-1) || validatedQueue;
  return { params, validatedQueue, persistedQueue };
}

export function assertIncidentQueueAllowed(user: User, validatedQueue: string) {
  if (!["personal", "admin-review"].includes(validatedQueue)) {
    throw new Error("unsupported queue");
  }
  if (validatedQueue === "admin-review" && user.role !== "admin") {
    throw new Error("queue restricted");
  }
}
