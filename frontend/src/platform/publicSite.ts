const origin = (import.meta.env.VITE_PUBLIC_SITE_URL || import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');
export const trackShareUrl = (id: string) => `${origin}/?trackId=${encodeURIComponent(id)}`;
