export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("linebot_token");
}

export function setToken(token) {
  window.localStorage.setItem("linebot_token", token);
}

export function clearToken() {
  window.localStorage.removeItem("linebot_token");
  window.localStorage.removeItem("linebot_user");
}

export function setUser(user) {
  window.localStorage.setItem("linebot_user", JSON.stringify(user));
}

export function getUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("linebot_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
}
