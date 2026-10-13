import React from 'react';
import { RecordedTake, VocabularyItem } from '../types';
import { AlertTriangle, CheckCircle, Users, Video, Sun, Layers } from 'lucide-react';

interface CoverageDashboardProps {
  takes: RecordedTake[];
  vocabulary: VocabularyItem[];
  targetRepsPerLabel: number;
  onSelectLabelForRecording: (labelId: string) => void;
  selectedLabelId: string;
}

export const CoverageDashboard: React.FC<CoverageDashboardProps> = ({
  takes,
  vocabulary,
  targetRepsPerLabel,
  onSelectLabelForRecording,
  selectedLabelId,
}) => {
  // Aggregate stats
  const totalTakes = takes.length;
  const uniqueSigners = Array.from(new Set(takes.map((t) => t.signer_id)));

  const takesByLabel: Record<string, number> = {};
  const signersByLabel: Record<string, Set<string>> = {};
  const takesBySigner: Record<string, number> = {};
  const takesByLighting: Record<string, number> = {
    bright_indoor: 0,
    dim_indoor: 0,
    backlit: 0,
    natural_window: 0,
    mixed: 0,
  };

  for (const take of takes) {
    takesByLabel[take.label] = (takesByLabel[take.label] || 0) + 1;

    if (!signersByLabel[take.label]) {
      signersByLabel[take.label] = new Set();
    }
    signersByLabel[take.label].add(take.signer_id);

    takesBySigner[take.signer_id] = (takesBySigner[take.signer_id] || 0) + 1;

    const light = take.metadata?.lighting || 'bright_indoor';
    takesByLighting[light] = (takesByLighting[light] || 0) + 1;
  }

  // Count items with warnings
  const underrepresentedLabels = vocabulary.filter((v) => {
    const reps = takesByLabel[v.id] || 0;
    const signers = signersByLabel[v.id]?.size || 0;
    return reps < targetRepsPerLabel || signers < 5;
  });

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top metrics summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Takes</span>
            <Video className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{totalTakes}</div>
          <div className="text-xs text-slate-400 mt-1">Numerical coordinate sequences</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Unique Signers</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{uniqueSigners.length}</div>
          <div className="text-xs text-slate-400 mt-1">
            {uniqueSigners.length < 5 ? (
              <span className="text-amber-400 font-medium">Aim for ≥ 5 signers</span>
            ) : (
              <span className="text-emerald-400 font-medium">Meets ≥ 5 signer target</span>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Vocab Covered</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">
            {Object.keys(takesByLabel).length} / {vocabulary.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {Math.round((Object.keys(takesByLabel).length / vocabulary.length) * 100)}% vocabulary coverage
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Coverage Gaps</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-300 mt-2">
            {underrepresentedLabels.length}
          </div>
          <div className="text-xs text-amber-400/90 mt-1 font-medium">
            Labels with &lt;{targetRepsPerLabel} reps or &lt;5 signers
          </div>
        </div>
      </div>

      {/* Lighting Breakdown */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sun className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Lighting Distribution (Robustness Targets)
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(takesByLighting).map(([cond, count]) => (
            <div key={cond} className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
              <div className="text-[11px] font-medium text-slate-400 capitalize">
                {cond.replace('_', ' ')}
              </div>
              <div className="text-lg font-bold text-slate-100">{count} takes</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Label Dataset Coverage Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Vocabulary Class Distribution &amp; Target Tracking
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any sign to select it for recording. Strict target: ≥{targetRepsPerLabel} takes
              and ≥5 distinct signers.
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-800 px-2.5 py-1 rounded-md text-slate-300">
            Target: {targetRepsPerLabel} reps / 5 signers
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800 sticky top-0 backdrop-blur">
              <tr>
                <th className="py-2.5 px-3">Label / Gloss</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Takes Recorded</th>
                <th className="py-2.5 px-3">Distinct Signers</th>
                <th className="py-2.5 px-3">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {vocabulary.map((item) => {
                const count = takesByLabel[item.id] || 0;
                const signersCount = signersByLabel[item.id]?.size || 0;
                const isSelected = selectedLabelId === item.id;
                const needsReps = count < targetRepsPerLabel;
                const needsSigners = signersCount < 5;

                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectLabelForRecording(item.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/40 text-emerald-100 font-medium'
                        : 'hover:bg-slate-800/50 text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-white flex items-center gap-2">
                        {item.gloss}
                        {item.verified ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded">
                            Verified
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-sans">
                            Unverified
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.labels.en} • {item.labels.hi}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 capitalize text-slate-400">{item.category}</td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-100">{count}</span>
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${count >= targetRepsPerLabel ? 'bg-emerald-400' : 'bg-amber-400'}`}
                            style={{
                              width: `${Math.min(100, (count / targetRepsPerLabel) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span
                        className={`font-mono font-bold ${
                          signersCount >= 5 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {signersCount} / 5
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {needsReps && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> &lt;{targetRepsPerLabel} reps
                          </span>
                        )}
                        {needsSigners && (
                          <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded flex items-center gap-1">
                            <Users className="w-3 h-3" /> &lt;5 signers
                          </span>
                        )}
                        {!needsReps && !needsSigners && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Adequate
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
