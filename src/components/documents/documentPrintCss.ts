import { FONT_STACKS, documentColors, type DocumentStyle } from '../../utils/documentTheme';

/** Stylesheet for the printable document, driven by the owner's colour/layout choices. */
export function documentPrintCss(style: DocumentStyle): string {
  const c = documentColors(style);
  const band = style.headerStyle === 'band';
  const headText = band ? c.onAccent : '#333';
  const headMuted = band ? c.onAccent : '#666';

  const thead =
    style.tableStyle === 'solid'
      ? `background-color: ${c.accent}; color: ${c.onAccent};`
      : style.tableStyle === 'light'
        ? `background-color: ${c.wash}; color: ${c.accentText}; border-bottom: 2px solid ${c.accent};`
        : `background-color: transparent; color: ${c.accentText}; border-bottom: 2px solid ${c.accent};`;
  const stripe = style.tableStyle === 'lines' ? '' : `tbody tr:nth-child(even) { background-color: #f7f9fc; }`;

  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${style.paper === 'letter' ? 'Letter' : 'A4'}; }
    body {
      font-family: ${FONT_STACKS[style.font]};
      line-height: 1.6;
      color: #333;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .container {
      --pad: 40px;
      max-width: 850px;
      margin: 0 auto;
      padding: var(--pad);
      background: white;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      ${
        band
          ? `background-color: ${c.accent}; color: ${c.onAccent};
      margin: calc(var(--pad) * -1) calc(var(--pad) * -1) 40px;
      padding: 28px var(--pad);`
          : `border-bottom: 2px solid ${c.accent};
      padding-bottom: 20px;`
      }
    }
    .logo {
      max-height: 60px;
      max-width: 200px;
      object-fit: contain;
      margin-bottom: 10px;
      display: block;
      ${band ? 'background: #fff; padding: 6px; border-radius: 6px;' : ''}
    }
    .header-left h1 { font-size: 24px; font-weight: 600; margin-bottom: 5px; color: ${headText}; }
    .header-left p { font-size: 13px; color: ${headMuted}; margin: 3px 0; }
    .header-right { text-align: right; }
    .doc-type { font-size: 28px; font-weight: 700; color: ${band ? c.onAccent : c.accentText}; margin-bottom: 10px; }
    .doc-number { font-size: 13px; color: ${band ? c.onAccent : '#333'}; font-weight: 600; }
    .doc-date { font-size: 13px; color: ${headMuted}; margin-top: 5px; }
    .section { margin-bottom: 30px; }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: ${c.accentText};
      margin-bottom: 10px;
      border-bottom: 1px solid ${c.line};
      padding-bottom: 8px;
    }
    .two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
    .info-block p { font-size: 13px; margin: 4px 0; color: #333; }
    .info-block .label { font-weight: 600; color: #111; font-size: 14px; }
    table { width: 100%; margin: 20px 0; border-collapse: collapse; }
    thead { ${thead} }
    thead th {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 10px 8px;
      text-align: left;
    }
    tbody td { font-size: 13px; padding: 10px 8px; border-bottom: 1px solid ${style.tableStyle === 'lines' ? c.line : '#e5e7eb'}; }
    thead th:nth-child(n + 3), tbody td:nth-child(n + 3) { text-align: right; }
    ${stripe}
    .summary-table { width: 100%; margin-top: 20px; }
    .summary-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }
    .summary-row.total {
      border-bottom: 2px solid ${c.accent};
      border-top: 2px solid ${c.accent};
      font-weight: 700;
      font-size: 16px;
      padding: 15px 8px;
      background-color: ${c.wash};
      color: ${c.accentText};
    }
    .summary-row.highlight { background-color: #f9fafb; font-weight: 500; }
    .summary-label { text-align: left; color: #333; }
    .summary-row.total .summary-label { color: ${c.accentText}; }
    .summary-value { text-align: right; font-weight: 500; }
    .summary-row.total .summary-value { font-weight: 700; }
    .notes {
      background-color: #f9fafb;
      border-left: 3px solid ${c.accent};
      padding: 15px;
      margin-top: 20px;
      font-size: 13px;
      color: #555;
    }
    .payment-info {
      background-color: ${c.wash};
      border: 1px solid ${c.line};
      border-radius: 4px;
      padding: 15px;
      margin-top: 20px;
      font-size: 13px;
    }
    .payment-info-title { font-weight: 600; color: ${c.accentText}; margin-bottom: 10px; }
    .payment-info p { margin: 5px 0; color: #333; }
    .signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 40px;
      gap: 24px;
    }
    .signature-block { min-width: 200px; }
    .signature-block img { max-height: 60px; max-width: 180px; object-fit: contain; display: block; }
    .signature-line { border-top: 1px solid #999; margin-top: 4px; padding-top: 4px; font-size: 11px; color: #666; }
    .stamp { max-height: 110px; max-width: 110px; object-fit: contain; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid ${c.line};
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .terms {
      margin-top: 20px;
      padding: 15px;
      background-color: #fef2f2;
      border-left: 3px solid #dc2626;
      font-size: 12px;
      color: #555;
    }
    .terms-title { font-weight: 600; color: #991b1b; margin-bottom: 10px; }
    @media print {
      body { margin: 0; padding: 0; }
      .container { --pad: 20px; max-width: 100%; }
    }
  `;
}
