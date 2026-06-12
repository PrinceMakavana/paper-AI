export const ROUTES = {
  chat: "/chat",
  login: "/login",
  register: "/register",
} as const;

export function startChatHref(isLoggedIn: boolean) {
  return isLoggedIn ? ROUTES.chat : ROUTES.chat;
}

export function signupHref(isLoggedIn: boolean) {
  return isLoggedIn ? ROUTES.chat : ROUTES.register;
}
