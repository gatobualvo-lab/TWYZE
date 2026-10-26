// How a business's invoices, quotations and receipts look. The owner's choices are stored as
// JSON on business_settings.document_style and read by the on-screen preview, the print view
// and the PDF, so one place decides colours, fonts and layout for all three.

export type HeaderStyle = 'plain' | 'band';
export type TableStyle = 'solid' | 'light' | 'lines';
export type DocumentFont = 'sans' | 'serif';
export type PaperSize = 'a4' | 'letter';
export type DocumentKind = 'invoice' | 'quotation' | 'receipt';

export interface DocumentStyle {
  /** Brand colour as #rrggbb. */
  accent: string;
  headerStyle: HeaderStyle;
  tableStyle: TableStyle;
  font: DocumentFont;
  paper: PaperSize;
  showLogo: boolean;
  /** KRA PIN and VAT number under the business details. */
  showTaxIds: boolean;
  /** Signature and stamp images, when the business has uploaded them. */
  showSignature: boolean;
  /** The small "Generated on ..." line at the bottom of the print view. */
  showGeneratedLine: boolean;
  /** Custom heading per document type; empty means the default word. */
  titles: Record<DocumentKind, string>;
}

export const DEFAULT_ACCENT = '#0a7f56';
export const TITLE_MAX_LENGTH = 24;

export const DEFAULT_TITLES: Record<DocumentKind, string> = {
  invoice: 'INVOICE',
  quotation: 'QUOTATION',
  receipt: 'RECEIPT',
};

export const ACCENT_PRESETS: Array<{ name: string; hex: string }> = [
  { name: 'Emerald', hex: '#0a7f56' },
  { name: 'Navy', hex: '#1e3a5f' },
  { name: 'Blue', hex: '#1d4ed8' },
  { name: 'Teal', hex: '#0f766e' },
  { name: 'Purple', hex: '#6d28d9' },
  { name: 'Crimson', hex: '#b91c1c' },
  { name: 'Orange', hex: '#c2410c' },
  { name: 'Charcoal', hex: '#1f2937' },
];

export const TEMPLATE_IDS = ['classic', 'minimal', 'professional', 'corporate'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

// A template sets the starting look; anything the owner changes afterwards is kept on top of it.
const TEMPLATE_BASE: Record<TemplateId, Pick<DocumentStyle, 'headerStyle' | 'tableStyle' | 'font'>> = {
  classic: { headerStyle: 'plain', tableStyle: 'lines', font: 'serif' },
  minimal: { headerStyle: 'plain', tableStyle: 'light', font: 'sans' },
  professional: { headerStyle: 'plain', tableStyle: 'solid', font: 'sans' },
  corporate: { headerStyle: 'band', tableStyle: 'solid', font: 'sans' },
};

const HEX = /^#?([0-9a-f]{6})$/i;
const SHORT_HEX = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;

/** Returns "#rrggbb" (lower case) or null when the text is not a colour. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const full = HEX.exec(text);
  if (full) return `#${full[1].toLowerCase()}`;
  const short = SHORT_HEX.exec(text);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  return null;
}

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const clean = normalizeHex(hex) ?? DEFAULT_ACCENT;
  return [1, 3, 5].map((i) => parseInt(clean.slice(i, i + 2), 16)) as Rgb;
}

export function rgbToHex([r, g, b]: Rgb): string {
  const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function luminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const INK = '#0f1b2d';
const WHITE = '#ffffff';

/** White or dark navy, whichever reads better on top of the colour. */
export function readableOn(hex: string): string {
  return contrastRatio(hex, WHITE) >= contrastRatio(hex, INK) ? WHITE : INK;
}

/** Mixes the colour towards white (amount 0 to 1). */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount]);
}

/**
 * Nudges the colour lighter or darker, keeping its hue, until it is readable as text on the
 * given background. A pale yellow brand colour would otherwise vanish on white paper.
 */
export function ensureContrast(hex: string, background: string, minimum = 4.5): string {
  if (contrastRatio(hex, background) >= minimum) return normalizeHex(hex) ?? DEFAULT_ACCENT;
  const towards: Rgb = luminance(hexToRgb(background)) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  const [r, g, b] = hexToRgb(hex);
  for (let step = 1; step <= 20; step++) {
    const t = step / 20;
    const candidate = rgbToHex([r + (towards[0] - r) * t, g + (towards[1] - g) * t, b + (towards[2] - b) * t]);
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return rgbToHex(towards);
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

function cleanTitle(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Control characters have no place in a heading; keep it to one short line.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX_LENGTH);
}

type StyleSource = { document_style?: unknown; default_template?: string | null } | null | undefined;

/**
 * Turns whatever is stored (possibly missing, partial or hand-edited) into a complete style.
 * Unknown or invalid values fall back to the template's defaults, so a bad row cannot break
 * a document.
 */
export function resolveDocumentStyle(source: StyleSource): DocumentStyle {
  const templateId = pick(source?.default_template, TEMPLATE_IDS, 'professional');
  const base = TEMPLATE_BASE[templateId];
  const raw = source?.document_style && typeof source.document_style === 'object' && !Array.isArray(source.document_style)
    ? (source.document_style as Record<string, unknown>)
    : {};
  const rawTitles = raw.titles && typeof raw.titles === 'object' ? (raw.titles as Record<string, unknown>) : {};

  return {
    accent: normalizeHex(raw.accent) ?? DEFAULT_ACCENT,
    headerStyle: pick(raw.headerStyle, ['plain', 'band'] as const, base.headerStyle),
    tableStyle: pick(raw.tableStyle, ['solid', 'light', 'lines'] as const, base.tableStyle),
    font: pick(raw.font, ['sans', 'serif'] as const, base.font),
    paper: pick(raw.paper, ['a4', 'letter'] as const, 'a4'),
    showLogo: flag(raw.showLogo, true),
    showTaxIds: flag(raw.showTaxIds, true),
    showSignature: flag(raw.showSignature, true),
    showGeneratedLine: flag(raw.showGeneratedLine, true),
    titles: {
      invoice: cleanTitle(rawTitles.invoice),
      quotation: cleanTitle(rawTitles.quotation),
      receipt: cleanTitle(rawTitles.receipt),
    },
  };
}

/** The heading shown on the document: the owner's wording, or the default word. */
export function documentTitle(style: DocumentStyle, kind: DocumentKind): string {
  return style.titles[kind] || DEFAULT_TITLES[kind];
}

/**
 * Only values that differ from what the template already gives are worth saving, which keeps
 * the stored JSON small and lets a later template change still take effect.
 */
export function styleToStored(style: DocumentStyle, templateId?: string | null): Record<string, unknown> {
  const base = TEMPLATE_BASE[pick(templateId, TEMPLATE_IDS, 'professional')];
  const out: Record<string, unknown> = { accent: style.accent, paper: style.paper };
  if (style.headerStyle !== base.headerStyle) out.headerStyle = style.headerStyle;
  if (style.tableStyle !== base.tableStyle) out.tableStyle = style.tableStyle;
  if (style.font !== base.font) out.font = style.font;
  if (!style.showLogo) out.showLogo = false;
  if (!style.showTaxIds) out.showTaxIds = false;
  if (!style.showSignature) out.showSignature = false;
  if (!style.showGeneratedLine) out.showGeneratedLine = false;
  const titles = Object.fromEntries(Object.entries(style.titles).filter(([, v]) => v));
  if (Object.keys(titles).length) out.titles = titles;
  return out;
}

export interface DocumentColors {
  /** Fills: header band, table head, rules. */
  accent: string;
  /** Text on top of an accent fill. */
  onAccent: string;
  /** Accent used as text on white paper (darkened if the brand colour is too pale). */
  accentText: string;
  /** Accent used as text on a dark screen background. */
  accentTextOnDark: string;
  /** Very light wash for the table head, notes and totals. */
  wash: string;
  /** Light line colour. */
  line: string;
}

export function documentColors(style: DocumentStyle): DocumentColors {
  const accent = style.accent;
  return {
    accent,
    onAccent: readableOn(accent),
    accentText: ensureContrast(accent, WHITE),
    accentTextOnDark: ensureContrast(accent, '#1f2937'),
    wash: tint(accent, 0.92),
    line: tint(accent, 0.75),
  };
}

export const FONT_STACKS: Record<DocumentFont, string> = {
  sans: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
};

/** jsPDF's built-in font family for the chosen font. */
export const PDF_FONTS: Record<DocumentFont, 'helvetica' | 'times'> = {
  sans: 'helvetica',
  serif: 'times',
};
