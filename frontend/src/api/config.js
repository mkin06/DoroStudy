// Authentication and study APIs must use the same origin and cookie jar.
export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
