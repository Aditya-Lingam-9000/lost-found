const DEFAULT_API_BASE_URL = "http://127.0.0.1:5000";

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).trim();

const normalizedHost =
  rawBaseUrl &&
  !rawBaseUrl.startsWith("http://") &&
  !rawBaseUrl.startsWith("https://") &&
  !rawBaseUrl.includes(".")
    ? `${rawBaseUrl}.onrender.com`
    : rawBaseUrl;

const envBaseUrl =
  normalizedHost.startsWith("http://") || normalizedHost.startsWith("https://")
    ? normalizedHost
    : `https://${normalizedHost}`;

export const API_BASE_URL = envBaseUrl.replace(/\/+$/, "");

export const apiUrl = (path) => {
  if (!path) return API_BASE_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const assetUrl = (relativePath) => {
  if (!relativePath) return "";
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }
  return `${API_BASE_URL}/${relativePath.replace(/^\/+/, "")}`;
};
