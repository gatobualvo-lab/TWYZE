import React from 'react';
import { CheckCircle2, Circle, X, Rocket } from 'lucide-react';
import { Card } from '../ui';
import { useOnboardingChecklist } from '../../hooks/useOnboardingChecklist';

const OnboardingChecklist: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { steps, loading, dismissed, dismiss } = useOnboardingChecklist();

  if (loading || dismissed || steps.length === 0) return null;

  const doneCount = steps.filter(s => s.done).length;

  return (
    <Card className="border-blue-100 bg-blue-50/50 animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100">
            <Rocket className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">Get started with TrackWyze</p>
            <p className="text-xs text-gray-500">{doneCount} of {steps.length} done</p>
          </div>
        </div>
        <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 p-1" title="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        {steps.map(step => (
          <button
            key={step.id}
            onClick={() => onNavigate(step.actionTab)}
            disabled={step.done}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${
              step.done ? 'text-gray-400 cursor-default' : 'text-gray-700 hover:bg-white'
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
            )}
            <span className={step.done ? 'line-through' : ''}>{step.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
};

export default OnboardingChecklist;
