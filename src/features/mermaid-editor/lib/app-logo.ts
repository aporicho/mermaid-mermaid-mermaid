export type AppLogoId = "green" | "light" | "dark";

export type AppLogoOption = {
  id: AppLogoId;
  label: string;
  href: string;
};

export const DEFAULT_APP_LOGO_ID: AppLogoId = "green";

export const APP_LOGOS: AppLogoOption[] = [
  { id: "green", label: "绿色", href: "/logos/logo-green.svg" },
  { id: "light", label: "浅色", href: "/logos/logo-light.svg" },
  { id: "dark", label: "深色", href: "/logos/logo-dark.svg" }
];

export function normalizeAppLogoId(value: unknown): AppLogoId {
  return APP_LOGOS.some((logo) => logo.id === value) ? (value as AppLogoId) : DEFAULT_APP_LOGO_ID;
}

export function appLogoById(id: AppLogoId): AppLogoOption {
  return APP_LOGOS.find((logo) => logo.id === id) || APP_LOGOS[0];
}
