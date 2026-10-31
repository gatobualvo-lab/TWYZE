import { Calendar } from 'lucide-react';
import {
  PERIOD_LABELS,
  PERIOD_ORDER,
  describePeriod,
  normalizeCustom,
  periodFor,
  type Period,
  type PeriodPreset,
} from '../../utils/period';

interface PeriodPickerProps {
  value: Period;
  onChange: (period: Period) => void;
  /** Which presets to offer; defaults to all of them. */
  presets?: PeriodPreset[];
  className?: string;
}

/**
 * "Show me this month / last month / a range I choose." One row of chips; picking Custom
 * reveals two date fields. Used wherever totals and transactions can be looked at by period.
 */
export default function PeriodPicker({ value, onChange, presets = PERIOD_ORDER, className = '' }: PeriodPickerProps) {
  const choose = (preset: PeriodPreset) => {
    if (preset === 'custom') {
      onChange(periodFor('custom', new Date(), { start: value.start, end: value.end }));
    } else {
      onChange(periodFor(preset));
    }
  };

  const setCustom = (patch: Partial<Pick<Period, 'start' | 'end'>>) => {
    const next = normalizeCustom(patch.start ?? value.start, patch.end ?? value.end);
    onChange({ preset: 'custom', ...next });
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
        <Calendar className="w-4 h-4 text-gray-500" aria-hidden="true" />
        <span>Period</span>
        <span className="text-gray-500 font-normal" aria-live="polite">· {describePeriod(value)}</span>
      </div>
      <div role="radiogroup" aria-label="Period" className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = value.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(preset)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                active
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {PERIOD_LABELS[preset]}
            </button>
          );
        })}
      </div>
      {value.preset === 'custom' && (
        <div className="grid grid-cols-2 gap-3 mt-3 max-w-md">
          <label className="block text-sm text-gray-600">
            From
            <input
              type="date"
              value={value.start}
              max={value.end || undefined}
              onChange={(e) => setCustom({ start: e.target.value })}
              className="mt-1 w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
          </label>
          <label className="block text-sm text-gray-600">
            To
            <input
              type="date"
              value={value.end}
              min={value.start || undefined}
              onChange={(e) => setCustom({ end: e.target.value })}
              className="mt-1 w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
          </label>
        </div>
      )}
    </div>
  );
}
