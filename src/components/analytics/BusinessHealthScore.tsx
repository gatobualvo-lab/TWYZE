import React from 'react';
import { HeartPulse, Info } from 'lucide-react';
import { useHealthScore } from '../../services/metrics/useHealthScore';

const BAND_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  excellent: { ring: '#16a34a', text: 'text-green-700', bg: 'bg-green-50' },
  good: { ring: '#22c55e', text: 'text-green-700', bg: 'bg-green-50' },
  fair: { ring: '#eab308', text: 'text-amber-700', bg: 'bg-amber-50' },
  needs_attention: { ring: '#f97316', text: 'text-orange-700', bg: 'bg-orange-50' },
  critical: { ring: '#dc2626', text: 'text-red-700', bg: 'bg-red-50' },
};

const ScoreRing: React.FC<{ score: number; color: string }> = ({ score, color }) => {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="flex-shrink-0">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
      <circle
        cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="70" y="65" textAnchor="middle" className="fill-gray-900" style={{ fontSize: '32px', fontWeight: 700 }}>
        {score}
      </text>
      <text x="70" y="86" textAnchor="middle" className="fill-gray-400" style={{ fontSize: '12px' }}>
        out of 100
      </text>
    </svg>
  );
};

const BusinessHealthScore: React.FC = () => {
  const { result, loading } = useHealthScore();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="h-5 w-40 skeleton-shimmer rounded-md mb-4" />
        <div className="h-32 skeleton-shimmer rounded-lg" />
      </div>
    );
  }

  if (!result) return null;

  const colors = result.band ? BAND_COLORS[result.band] : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fadeIn">
      <div className="flex items-center gap-2 mb-4">
        <HeartPulse className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">Business Health</h3>
        <span className="text-xs text-gray-400">This month</span>
      </div>

      {result.score === null ? (
        <div className="py-2">
          <p className="text-gray-500 text-sm text-center py-4">{result.insufficientDataReason}</p>
          {/* Show whatever partial signal does exist rather than nothing at
              all — "still learning" doesn't mean "we know nothing." */}
          {result.factors.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              {result.factors.map(f => (
                <div key={f.key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-32 flex-shrink-0">{f.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-smooth"
                      style={{ width: `${f.score}%`, backgroundColor: f.score >= 60 ? '#16a34a' : f.score >= 40 ? '#eab308' : '#dc2626' }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right tabular-nums">{Math.round(f.score)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ScoreRing score={result.score} color={colors!.ring} />
            <div className="flex-1 w-full">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-3 ${colors!.bg} ${colors!.text}`}>
                {result.bandLabel}
              </span>
              {result.factorsIncluded < result.factorsPossible && (
                <p className="flex items-start gap-1.5 text-xs text-gray-400 mb-3">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Based on {result.factorsIncluded} of {result.factorsPossible} factors — some don't have enough data yet.
                </p>
              )}
              <div className="space-y-2">
                {result.factors.map(f => (
                  <div key={f.key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-32 flex-shrink-0">{f.label}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-smooth"
                        style={{ width: `${f.score}%`, backgroundColor: f.score >= 60 ? '#16a34a' : f.score >= 40 ? '#eab308' : '#dc2626' }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right tabular-nums">{Math.round(f.score)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            {result.factors.map(f => (
              <p key={f.key} className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">{f.label}:</span> {f.explanation}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BusinessHealthScore;
