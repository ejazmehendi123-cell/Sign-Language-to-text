import React from 'react';
import { ShieldAlert } from 'lucide-react';

export interface NoSignPrompt {
  id: string;
  label: string;
  description: string;
}

export const NO_SIGN_PROMPTS: NoSignPrompt[] = [
  {
    id: 'standing_idle',
    label: 'Standing Idle',
    description: 'Hands at side, calm breathing, minimal posture sway.',
  },
  {
    id: 'scratch_head',
    label: 'Scratching Head / Touching Face',
    description: 'Natural hand to forehead, nose, or cheek then returning.',
  },
  {
    id: 'adjust_glasses',
    label: 'Adjusting Glasses',
    description: 'Pinching or pushing glasses up on bridge of nose.',
  },
  {
    id: 'phone_pickup',
    label: 'Checking Phone',
    description: 'Reaching down, glancing at phone, scrolling momentarily.',
  },
  {
    id: 'talking_someone',
    label: 'Talking to Companion',
    description: 'Turning head side to side, smiling, hands remaining down.',
  },
  {
    id: 'reaching_docs',
    label: 'Reaching for Documents',
    description: 'Rustling in bag or pocket for paperwork.',
  },
  {
    id: 'casual_wave',
    label: 'Casual Waving',
    description: 'Informal greeting wave to someone passing by.',
  },
  {
    id: 'point_screen',
    label: 'Pointing at Screen',
    description: 'Single finger pointing towards kiosk without signing.',
  },
  {
    id: 'arms_folded',
    label: 'Arms Folded',
    description: 'Resting with arms crossed over chest.',
  },
];

interface NoSignPromptsProps {
  activePromptId: string | null;
  onSelectPrompt: (prompt: NoSignPrompt) => void;
  recordedCountsByPrompt: Record<string, number>;
}

export const NoSignPrompts: React.FC<NoSignPromptsProps> = ({
  activePromptId,
  onSelectPrompt,
  recordedCountsByPrompt,
}) => {
  return (
    <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold tracking-wide uppercase text-amber-300">
            Dedicated Negative Class (<code className="text-amber-200">no_sign</code>) Prompts
          </h3>
        </div>
        <span className="text-xs text-amber-300/80">
          Target: Balanced negatives to reduce false-positive activations
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {NO_SIGN_PROMPTS.map((prompt) => {
          const isSelected = activePromptId === prompt.id;
          const count = recordedCountsByPrompt[prompt.id] || 0;

          return (
            <button
              key={prompt.id}
              type="button"
              onClick={() => onSelectPrompt(prompt)}
              className={`p-3 rounded-lg text-left transition-all border ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-400 text-amber-100 shadow-sm shadow-amber-500/20 ring-1 ring-amber-400'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold leading-tight">{prompt.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    count >= 3
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : count > 0
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count} take{count !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">
                {prompt.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
