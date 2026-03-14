const defaultBackend = "http://localhost:8000";

export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || defaultBackend).replace(/\/$/, "");

export function backendPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_URL}${normalized}`;
}
