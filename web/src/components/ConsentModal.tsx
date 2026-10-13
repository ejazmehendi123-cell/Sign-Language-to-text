import React, { useState } from 'react';
import { SignerConsent } from '../types';
import { ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';

interface ConsentModalProps {
  currentSignerId: string;
  onConsentComplete: (consent: SignerConsent) => void;
  langStrings: any;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  currentSignerId,
  onConsentComplete,
  langStrings,
  currentLang,
  onLanguageChange,
}) => {
  const [signerId, setSignerId] = useState(currentSignerId);
  const [agreed, setAgreed] = useState(false);
  const [notes, setNotes] = useState('');

  const t = langStrings?.recorder || {};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed || !signerId.trim()) return;

    const consentRecord: SignerConsent = {
      signer_id: signerId.trim(),
      consent_timestamp: Date.now(),
      consented: true,
      language: currentLang,
      notes: notes.trim(),
    };

    onConsentComplete(consentRecord);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {t.consent_heading || 'Signer Consent & Data Authorization'}
              </h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Privacy Guaranteed • Zero Video Retention
              </span>
            </div>
          </div>

          {/* Quick Language Toggle */}
          <div className="flex gap-1.5 bg-slate-800 p-1 rounded-lg">
            {(['en', 'hi', 'mr'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onLanguageChange(l)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                  currentLang === l
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Plain Language Privacy Guarantee Box */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-sm leading-relaxed text-slate-300 space-y-2">
            <p className="font-medium text-slate-200">
              {t.consent_body ||
                'By participating, you authorize the capture of numerical 3D hand and body skeletal landmarks (coordinates) for training an on-device accessibility kiosk. No video or facial photos are recorded or stored. Your identity is protected by a pseudonymous Signer ID. You may withdraw or discard recordings at any time.'}
            </p>
            <div className="flex items-start gap-2 pt-2 text-xs text-amber-400/90 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Verified Policy: At zero point are video frames saved to disk or transmitted across
                any network.
              </span>
            </div>
          </div>

          {/* Signer ID input */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-300">
              {t.signer_id_label || 'Pseudonymous Signer ID'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={signerId}
                onChange={(e) => setSignerId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-base font-mono text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="signer_YYYYMMDD_xxxx"
              />
              <button
                type="button"
                onClick={() =>
                  setSignerId(
                    `signer_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`
                  )
                }
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg shrink-0"
              >
                Generate New ID
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Use this pseudonymous identifier if you record multiple sessions.
            </p>
          </div>

          {/* Optional notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-300">
              Operator / Participant Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., Session 1, Deaf community volunteer"
            />
          </div>

          {/* Required Consent Checkbox */}
          <label className="flex items-start gap-3 p-3.5 bg-emerald-950/20 border border-emerald-800/40 rounded-xl cursor-pointer hover:bg-emerald-950/30 transition-colors">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-5 h-5 mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm font-semibold text-emerald-200 select-none leading-snug">
              {t.consent_checkbox ||
                'I understand and consent to numerical landmark-only recording. I retain the right to discard any recording.'}
            </span>
          </label>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={!agreed || !signerId.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-base font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
          >
            <UserCheck className="w-5 h-5" />
            Authorize and Proceed to Data Recorder
          </button>
        </form>
      </div>
    </div>
  );
};
