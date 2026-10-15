// Minimal ESC/POS encoder for thermal receipt printers (the command set almost
// every Bluetooth/USB receipt printer understands). Pure functions, no I/O.

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type Align = 'left' | 'center' | 'right';

export class EscPosBuilder {
  private bytes: number[] = [];

  constructor() {
    this.bytes.push(ESC, 0x40); // initialise printer
  }

  /** Printers use a single-byte code page: anything outside Latin-1 becomes "?". */
  private encode(text: string): number[] {
    const out: number[] = [];
    const normalised = text
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...');
    for (const ch of normalised) {
      const code = ch.codePointAt(0)!;
      out.push(code >= 0x20 && code <= 0x7e ? code : 0x3f);
    }
    return out;
  }

  align(a: Align): this {
    this.bytes.push(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2);
    return this;
  }

  bold(on: boolean): this {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  /** Double width + height for headings. */
  big(on: boolean): this {
    this.bytes.push(GS, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  text(line: string): this {
    this.bytes.push(...this.encode(line));
    return this;
  }

  line(text = ''): this {
    return this.text(text).feed(1);
  }

  feed(lines: number): this {
    for (let i = 0; i < lines; i++) this.bytes.push(LF);
    return this;
  }

  rule(columns: number, char = '-'): this {
    return this.line(char.repeat(columns));
  }

  /** Feed a few lines past the tear bar, then partial cut (ignored by printers without a cutter). */
  cut(): this {
    this.feed(3);
    this.bytes.push(GS, 0x56, 0x42, 0x00);
    return this;
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** "left ........ right" padded to exactly `columns` characters. */
export function twoColumn(left: string, right: string, columns: number): string {
  const space = columns - right.length;
  if (space < 2) return `${left.slice(0, Math.max(0, columns - right.length - 1))} ${right}`.slice(0, columns);
  const l = left.length > space - 1 ? left.slice(0, space - 1) : left;
  return l + ' '.repeat(columns - l.length - right.length) + right;
}

/** Splits text into lines no wider than `columns`, breaking on spaces where possible. */
export function wrapText(text: string, columns: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > columns) {
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(w.slice(0, columns));
      w = w.slice(columns);
    }
    if (!current) current = w;
    else if (current.length + 1 + w.length <= columns) current += ` ${w}`;
    else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface EscPosReceipt {
  businessName: string;
  phone?: string | null;
  date: string;
  customerName?: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  total: number;
  /** Characters per line: 32 for 58mm paper, 48 for 80mm. */
  columns: number;
  formatMoney: (n: number) => string;
}

export function buildReceiptEscPos(r: EscPosReceipt): Uint8Array {
  const b = new EscPosBuilder();
  const cols = r.columns;

  b.align('center').bold(true).big(true).line(r.businessName.slice(0, Math.floor(cols / 2))).big(false).bold(false);
  if (r.phone) b.line(r.phone);
  b.line(r.date);
  if (r.customerName) b.line(`Customer: ${r.customerName}`);
  b.align('left').rule(cols);

  for (const item of r.items) {
    for (const l of wrapText(item.name, cols)) b.line(l);
    b.line(twoColumn(`  ${item.quantity} x ${r.formatMoney(item.unitPrice)}`, r.formatMoney(item.unitPrice * item.quantity), cols));
  }

  b.rule(cols);
  b.bold(true).line(twoColumn('TOTAL', r.formatMoney(r.total), cols)).bold(false);
  b.feed(1).align('center').line('Thank you for your business!');
  b.cut();
  return b.toBytes();
}
