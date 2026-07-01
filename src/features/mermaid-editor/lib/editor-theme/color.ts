import type { AnsiColorTokens } from "./types";

const hexColorPattern = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string) {
  return hexColorPattern.test(value);
}

function hexToRgb(value: string) {
  const normalized = isHexColor(value) ? value.slice(1) : "000000";
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

export function hexToRgbCsv(value: string) {
  const rgb = hexToRgb(value);
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

export function hexToRgba(value: string, alpha: number) {
  const rgb = hexToRgb(value);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

export function ansiToCssVariables(ansi: AnsiColorTokens): Record<string, string> {
  return Object.fromEntries(
    Object.entries(ansi).map(([key, value]) => [`--ansi-${kebabCase(key)}`, hexToHslTriplet(value)])
  );
}

function kebabCase(value: string) {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

export function hexToHslTriplet(value: string) {
  const { r, g, b } = hexToRgb(value);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) return `0 0% ${toPercent(lightness)}%`;

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  if (max === green) hue = (blue - red) / delta + 2;
  if (max === blue) hue = (red - green) / delta + 4;
  hue *= 60;

  return `${Math.round(hue)} ${toPercent(saturation)}% ${toPercent(lightness)}%`;
}

function toPercent(value: number) {
  return Math.round(value * 1000) / 10;
}

export function contrastRatio(foreground: string, background: string) {
  const foregroundLum = relativeLuminance(hexToRgb(foreground));
  const backgroundLum = relativeLuminance(hexToRgb(background));
  const lighter = Math.max(foregroundLum, backgroundLum);
  const darker = Math.min(foregroundLum, backgroundLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(rgb: { r: number; g: number; b: number }) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
