import { useEffect, useState } from 'react';
import { Check, Palette, RotateCcw, Upload, X } from 'lucide-react';
import {
  ACCENT_PRESETS,
  DEFAULT_TITLES,
  FONT_STACKS,
  TITLE_MAX_LENGTH,
  documentColors,
  documentTitle,
  normalizeHex,
  type DocumentKind,
  type DocumentStyle,
} from '../../utils/documentTheme';

const TEMPLATES = [
  { id: 'classic', label: 'Classic', description: 'Serif type, ruled table' },
  { id: 'minimal', label: 'Minimal', description: 'Clean, light table head' },
  { id: 'professional', label: 'Professional', description: 'Solid coloured table head' },
  { id: 'corporate', label: 'Corporate', description: 'Full-width coloured header band' },
];

export type ImageKind = 'signature' | 'stamp';

interface PreviewBusiness {
  business_name?: string | null;
  logo_url?: string | null;
  signature_url?: string | null;
  stamp_url?: string | null;
  phone?: string | null;
  email?: string | null;
  kra_pin?: string | null;
}

interface Props {
  isDark: boolean;
  style: DocumentStyle;
  template: string;
  business: PreviewBusiness;
  uploading: ImageKind | null;
  onTemplateChange: (id: string) => void;
  onStyleChange: (patch: Partial<DocumentStyle>) => void;
  onTitleChange: (kind: DocumentKind, value: string) => void;
  onUpload: (kind: ImageKind, file: File) => void;
  onRemove: (kind: ImageKind) => void;
  onReset: () => void;
}

/** Miniature invoice that reflects the chosen look using the business's own details. */
function StylePreview({ style, business }: { style: DocumentStyle; business: PreviewBusiness }) {
  const c = documentColors(style);
  const band = style.headerStyle === 'band';
  const head =
    style.tableStyle === 'solid'
      ? { backgroundColor: c.accent, color: c.onAccent }
      : { backgroundColor: style.tableStyle === 'light' ? c.wash : 'transparent', color: c.accentText, borderBottom: `2px solid ${c.accent}` };
  const rows = [
    ['Office desk', '1', '12,500'],
    ['Chair', '4', '14,000'],
  ];
  const muted = band ? c.onAccent : '#666';

  return (
    <div
      className="rounded-lg border border-gray-300 bg-white text-[11px] leading-snug text-gray-800 shadow-sm overflow-hidden"
      style={{ fontFamily: FONT_STACKS[style.font] }}
      role="img"
      aria-label="Preview of an invoice using these choices"
    >
      <div
        className="flex items-start justify-between gap-3 p-4"
        style={band ? { backgroundColor: c.accent, color: c.onAccent } : { borderBottom: `2px solid ${c.accent}` }}
      >
        <div className="min-w-0">
          {style.showLogo && business.logo_url && (
            <img
              src={business.logo_url}
              alt=""
              className="max-h-8 max-w-[100px] object-contain mb-1"
              style={band ? { background: '#fff', padding: 3, borderRadius: 4 } : undefined}
            />
          )}
          <div className="text-sm font-bold truncate" style={{ color: band ? c.onAccent : '#111' }}>
            {business.business_name || 'Your business'}
          </div>
          <div style={{ color: muted }}>{business.phone || '0700 000 000'}</div>
          {style.showTaxIds && <div style={{ color: muted }}>KRA PIN: {business.kra_pin || 'P000000000X'}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold" style={{ color: band ? c.onAccent : c.accentText }}>
            {documentTitle(style, 'invoice').toUpperCase()}
          </div>
          <div style={{ color: muted }}>INV-0001</div>
        </div>
      </div>

      <div className="p-4">
        <table className="w-full border-collapse">
          <thead>
            <tr style={head}>
              <th className="text-left p-1.5 font-semibold">Item</th>
              <th className="text-right p-1.5 font-semibold">Qty</th>
              <th className="text-right p-1.5 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, qty, total], i) => (
              <tr
                key={name}
                style={{
                  borderBottom: `1px solid ${style.tableStyle === 'lines' ? c.line : '#e5e7eb'}`,
                  backgroundColor: style.tableStyle !== 'lines' && i % 2 === 1 ? '#f7f9fc' : undefined,
                }}
              >
                <td className="p-1.5">{name}</td>
                <td className="p-1.5 text-right">{qty}</td>
                <td className="p-1.5 text-right">{total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          className="mt-3 ml-auto w-3/5 flex justify-between font-bold px-2 py-1.5"
          style={{ backgroundColor: c.wash, color: c.accentText, borderTop: `2px solid ${c.accent}`, borderBottom: `2px solid ${c.accent}` }}
        >
          <span>TOTAL</span>
          <span>26,500</span>
        </div>

        {style.showSignature && (business.signature_url || business.stamp_url) && (
          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="min-w-[90px]">
              {business.signature_url && (
                <>
                  <img src={business.signature_url} alt="" className="max-h-8 max-w-[90px] object-contain" />
                  <div className="border-t border-gray-400 mt-0.5 pt-0.5 text-[9px] text-gray-500">Authorised signature</div>
                </>
              )}
            </div>
            {business.stamp_url && <img src={business.stamp_url} alt="" className="max-h-14 max-w-[56px] object-contain" />}
          </div>
        )}
      </div>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  isDark: boolean;
}

function Segmented<T extends string>({ label, value, options, onChange, isDark }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              active
                ? isDark
                  ? 'border-blue-500 bg-blue-900 bg-opacity-20 text-white'
                  : 'border-blue-500 bg-blue-50 text-gray-900'
                : isDark
                  ? 'border-gray-600 text-gray-300 hover:border-gray-500'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function DocumentAppearance({
  isDark,
  style,
  template,
  business,
  uploading,
  onTemplateChange,
  onStyleChange,
  onTitleChange,
  onUpload,
  onRemove,
  onReset,
}: Props) {
  const colors = documentColors(style);
  const [hexDraft, setHexDraft] = useState(style.accent);
  const [hexError, setHexError] = useState(false);

  // Keep the text box in step when the colour changes from a swatch, the picker or a reset.
  useEffect(() => {
    setHexDraft(style.accent);
    setHexError(false);
  }, [style.accent]);

  const labelClasses = `block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`;
  const hintClasses = `text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`;
  const inputClasses = `w-full px-3 py-2 rounded-lg border ${
    isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  } focus:outline-none focus:ring-2 focus:ring-blue-500`;
  const headingClasses = `text-sm font-semibold mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`;

  const commitHex = (value: string) => {
    const hex = normalizeHex(value);
    if (hex) {
      setHexError(false);
      onStyleChange({ accent: hex });
    } else {
      setHexError(true);
    }
  };

  const toggles: Array<{ key: 'showLogo' | 'showTaxIds' | 'showSignature' | 'showGeneratedLine'; label: string; hint: string }> = [
    { key: 'showLogo', label: 'Show my logo', hint: 'At the top of every document' },
    { key: 'showTaxIds', label: 'Show KRA PIN and VAT number', hint: 'Under the business details' },
    { key: 'showSignature', label: 'Show signature and stamp', hint: 'When you have uploaded them below' },
    { key: 'showGeneratedLine', label: 'Show "Generated on" date when printing', hint: 'Small line at the very bottom' },
  ];

  const imageSlot = (kind: ImageKind, title: string, hint: string, url?: string | null) => (
    <div>
      <div className={labelClasses}>{title}</div>
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
        <div className={`w-20 h-14 shrink-0 rounded flex items-center justify-center overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
          {url ? <img src={url} alt="" className="max-w-full max-h-full object-contain" /> : <span className={hintClasses}>None</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer border ${
              isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            } ${uploading === kind ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            {uploading === kind ? 'Uploading...' : url ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onUpload(kind, file);
              }}
            />
          </label>
          {url && (
            <button
              type="button"
              onClick={() => onRemove(kind)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border ${
                isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <X className="w-4 h-4" aria-hidden="true" />
              Remove
            </button>
          )}
        </div>
      </div>
      <p className={hintClasses}>{hint}</p>
    </div>
  );

  return (
    <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6 mb-6`}>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Palette className="w-6 h-6 text-pink-500" aria-hidden="true" />
          <div>
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Document Appearance</h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Colours, layout and wording for your invoices, quotations and receipts
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border ${
            isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-8">
        <div className="space-y-6 min-w-0">
          <div>
            <h3 className={headingClasses}>Starting design</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTemplateChange(t.id)}
                  aria-pressed={template === t.id}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    template === t.id
                      ? isDark
                        ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                        : 'border-blue-500 bg-blue-50'
                      : isDark
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.label}</div>
                  <div className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t.description}</div>
                </button>
              ))}
            </div>
            <p className={hintClasses}>Picking a design sets the header, table and font. You can change each one below.</p>
          </div>

          <div>
            <h3 className={headingClasses}>Brand colour</h3>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Brand colour">
              {ACCENT_PRESETS.map((preset) => {
                const active = preset.hex === style.accent;
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => onStyleChange({ accent: preset.hex })}
                    aria-label={preset.name}
                    aria-pressed={active}
                    title={preset.name}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-105 ${
                      active ? (isDark ? 'border-white' : 'border-gray-900') : 'border-transparent'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  >
                    {active && <Check className="w-5 h-5" style={{ color: documentColors({ ...style, accent: preset.hex }).onAccent }} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <div>
                <label htmlFor="doc-accent-picker" className={labelClasses}>
                  Custom colour
                </label>
                <input
                  id="doc-accent-picker"
                  type="color"
                  value={style.accent}
                  onChange={(e) => onStyleChange({ accent: e.target.value })}
                  className="h-10 w-16 rounded border border-gray-300 cursor-pointer bg-transparent p-1"
                />
              </div>
              <div className="w-32">
                <label htmlFor="doc-accent-hex" className={labelClasses}>
                  Hex code
                </label>
                <input
                  id="doc-accent-hex"
                  type="text"
                  value={hexDraft}
                  maxLength={7}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={hexError || undefined}
                  aria-describedby={hexError ? 'doc-accent-hex-error' : undefined}
                  onChange={(e) => setHexDraft(e.target.value)}
                  onBlur={() => commitHex(hexDraft)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitHex(hexDraft);
                    }
                  }}
                  className={inputClasses}
                />
              </div>
            </div>
            {hexError && (
              <p id="doc-accent-hex-error" role="alert" className="text-xs mt-1 text-red-600">
                Enter a colour like #0a7f56 (six letters or digits after the #).
              </p>
            )}
            {colors.accentText.toLowerCase() !== style.accent.toLowerCase() && (
              <p className={hintClasses}>This colour is quite light, so it is darkened a little wherever it is used for text.</p>
            )}
          </div>

          <div>
            <h3 className={headingClasses}>Layout</h3>
            <div className="space-y-4">
              <div>
                <div className={labelClasses}>Header</div>
                <Segmented
                  label="Header style"
                  isDark={isDark}
                  value={style.headerStyle}
                  onChange={(headerStyle) => onStyleChange({ headerStyle })}
                  options={[
                    { value: 'plain', label: 'Plain with underline' },
                    { value: 'band', label: 'Coloured band' },
                  ]}
                />
              </div>
              <div>
                <div className={labelClasses}>Items table</div>
                <Segmented
                  label="Table style"
                  isDark={isDark}
                  value={style.tableStyle}
                  onChange={(tableStyle) => onStyleChange({ tableStyle })}
                  options={[
                    { value: 'solid', label: 'Solid head' },
                    { value: 'light', label: 'Light head' },
                    { value: 'lines', label: 'Ruled lines' },
                  ]}
                />
              </div>
              <div>
                <div className={labelClasses}>Font</div>
                <Segmented
                  label="Font"
                  isDark={isDark}
                  value={style.font}
                  onChange={(font) => onStyleChange({ font })}
                  options={[
                    { value: 'sans', label: 'Modern (sans-serif)' },
                    { value: 'serif', label: 'Traditional (serif)' },
                  ]}
                />
              </div>
              <div>
                <div className={labelClasses}>Paper size</div>
                <Segmented
                  label="Paper size"
                  isDark={isDark}
                  value={style.paper}
                  onChange={(paper) => onStyleChange({ paper })}
                  options={[
                    { value: 'a4', label: 'A4' },
                    { value: 'letter', label: 'US Letter' },
                  ]}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className={headingClasses}>What to show</h3>
            <div className="space-y-2">
              {toggles.map((toggle) => (
                <label key={toggle.key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={style[toggle.key]}
                    onChange={(e) => onStyleChange({ [toggle.key]: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded"
                  />
                  <span>
                    <span className={`block text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{toggle.label}</span>
                    <span className={`block text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{toggle.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className={headingClasses}>Signature and stamp</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {imageSlot('signature', 'Signature', 'Sign on white paper and take a clear photo. A PNG with a see-through background looks best.', business.signature_url)}
              {imageSlot('stamp', 'Company stamp', 'Shown at the bottom right of each document.', business.stamp_url)}
            </div>
          </div>

          <div>
            <h3 className={headingClasses}>Document headings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['invoice', 'quotation', 'receipt'] as DocumentKind[]).map((kind) => (
                <div key={kind}>
                  <label htmlFor={`doc-title-${kind}`} className={labelClasses}>
                    {kind.charAt(0).toUpperCase() + kind.slice(1)} heading
                  </label>
                  <input
                    id={`doc-title-${kind}`}
                    type="text"
                    maxLength={TITLE_MAX_LENGTH}
                    value={style.titles[kind]}
                    placeholder={DEFAULT_TITLES[kind]}
                    onChange={(e) => onTitleChange(kind, e.target.value)}
                    className={inputClasses}
                  />
                </div>
              ))}
            </div>
            <p className={hintClasses}>For example "TAX INVOICE" or "PROFORMA INVOICE". Leave empty to use the usual word.</p>
          </div>
        </div>

        <div className="min-w-0">
          <div className="xl:sticky xl:top-4">
            <h3 className={headingClasses}>Preview</h3>
            <StylePreview style={style} business={business} />
            <p className={hintClasses}>Printing and PDFs use these same choices. Remember to press Save Settings.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
