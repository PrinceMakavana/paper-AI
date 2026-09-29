export const ROUTES = {
  chat: "/chat",
  login: "/login",
  register: "/register",
  subjects: "/subjects",
  paperSolution: "/paper-solution",
  projects: "/projects",
} as const;

/** Allow only same-origin relative paths (blocks //evil.com open redirects). */
export function getSafeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return null;
  }
  return path;
}

export function startChatHref(isLoggedIn: boolean) {
  return isLoggedIn ? ROUTES.chat : ROUTES.chat;
}

export function signupHref(isLoggedIn: boolean) {
  return isLoggedIn ? ROUTES.chat : ROUTES.register;
}
