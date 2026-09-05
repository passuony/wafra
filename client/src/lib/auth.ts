export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: "restaurant" | "charity" | "admin" | "delivery";
  phone?: string;
  address?: string;
  isActive: boolean;
}

export function saveAuth(token: string, user: CurrentUser) {
  localStorage.setItem("wafra_token", token);
  localStorage.setItem("wafra_user", JSON.stringify(user));
}

export function getUser(): CurrentUser | null {
  const raw = localStorage.getItem("wafra_user");
  return raw ? JSON.parse(raw) : null;
}

export function setUser(user: CurrentUser) {
  localStorage.setItem("wafra_user", JSON.stringify(user));
}

export function getToken(): string | null {
  return localStorage.getItem("wafra_token");
}

export function logout() {
  localStorage.removeItem("wafra_token");
  localStorage.removeItem("wafra_user");
  window.location.href = "/login";
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
