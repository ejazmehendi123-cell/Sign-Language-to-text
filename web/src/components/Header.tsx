import React from 'react';
import { ShieldCheck, Video, BarChart3, User, Globe } from 'lucide-react';

interface HeaderProps {
  activeTab: 'recorder' | 'coverage';
  onTabChange: (tab: 'recorder' | 'coverage') => void;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
  signerId: string;
  onSwitchSigner: () => void;
  totalTakes: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  currentLang,
  onLanguageChange,
  signerId,
  onSwitchSigner,
  totalTakes,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand and Positioning */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg">
            ISL
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">
                ISL Counter Kiosk
              </h1>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Phase 1 Data Suite
              </span>
            </div>
            <p className="text-xs text-slate-400">
              On-Device Landmark Recorder &amp; Coverage Dashboard
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => onTabChange('recorder')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'recorder'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Record Data</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('coverage')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'coverage'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Coverage ({totalTakes})</span>
          </button>
        </nav>

        {/* User and Controls right */}
        <div className="flex items-center gap-3">
          {/* Signer ID badge */}
          <button
            type="button"
            onClick={onSwitchSigner}
            className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-xl text-xs transition-colors"
            title="Switch participant signer ID"
          >
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-mono text-slate-300 font-medium">
              {signerId ? signerId : 'No Signer'}
            </span>
          </button>

          {/* Language selector */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            {(['en', 'hi', 'mr'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onLanguageChange(l)}
                className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-colors ${
                  currentLang === l
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Privacy badge */}
          <div className="hidden xl:flex items-center gap-1.5 bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 px-2.5 py-1 rounded-xl text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero Video Leaves Device</span>
          </div>
        </div>
      </div>
    </header>
  );
};
