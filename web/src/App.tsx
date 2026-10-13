import React, { useState, useEffect, useMemo } from 'react';
import {
  RecordedTake,
  SignerConsent,
  VocabularyItem,
  VocabularyConfig,
} from './types';
import { saveTake, getTakes, saveConsent, getConsent } from './services/db';
import { exportSessionZip, importSessionZip } from './services/zip';
import { ConsentModal } from './components/ConsentModal';
import { Header } from './components/Header';
import { RecorderView } from './components/RecorderView';
import { CoverageDashboard } from './components/CoverageDashboard';
import { KioskView } from './components/KioskView';
import { ClerkView } from './components/ClerkView';
import { createSessionSyncAdapter } from './services/adapters/sessionSync';

// Configuration imports
import vocabDataGov from '../../config/vocabulary.json';
import vocabDataHospital from '../../config/domains/hospital_opd/vocabulary.json';
import i18nEn from '../../config/i18n/en.json';
import i18nHi from '../../config/i18n/hi.json';
import i18nMr from '../../config/i18n/mr.json';

const I18N_MAP: Record<string, any> = {
  en: i18nEn,
  hi: i18nHi,
  mr: i18nMr,
};

export const App: React.FC = () => {
  // Domain selection state (default government, or hospital OPD)
  const [activeDomain, setActiveDomain] = useState<'government' | 'hospital'>('government');

  // Active vocabulary dynamically bound to selected domain
  const vocabulary: VocabularyItem[] = useMemo(() => {
    if (activeDomain === 'hospital') {
      return (vocabDataHospital as unknown as VocabularyConfig).vocabulary;
    }
    return (vocabDataGov as unknown as VocabularyConfig).vocabulary;
  }, [activeDomain]);

  // Main navigation tab
  const [activeTab, setActiveTab] = useState<'kiosk' | 'clerk' | 'recorder' | 'coverage'>('kiosk');

  // Signer & Consent State (for data recorder)
  const [currentSignerId, setCurrentSignerId] = useState<string>(() => {
    return `signer_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [, setHasConsented] = useState<boolean>(false);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);

  // App Settings
  const [currentLang, setCurrentLang] = useState<string>('en');
  const [selectedLabelId, setSelectedLabelId] = useState<string>('certificate');
  const [targetReps, setTargetReps] = useState<number>(10);

  // Data Takes State
  const [takes, setTakes] = useState<RecordedTake[]>([]);
  const [, setIsLoadingDB] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Shared session sync adapter (BroadcastChannel default)
  const syncAdapter = useMemo(() => createSessionSyncAdapter(false), []);

  const langStrings = I18N_MAP[currentLang] || i18nEn;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load initial takes from IndexedDB
  useEffect(() => {
    async function loadData() {
      try {
        const loadedTakes = await getTakes();
        setTakes(loadedTakes);

        const existingConsent = await getConsent(currentSignerId);
        if (existingConsent && existingConsent.consented) {
          setHasConsented(true);
        }
      } catch (err) {
        console.warn('Error loading takes from IndexedDB:', err);
      } finally {
        setIsLoadingDB(false);
      }
    }
    loadData();
  }, [currentSignerId]);

  // Handle consent completion
  const handleConsentComplete = async (consent: SignerConsent) => {
    try {
      await saveConsent(consent);
      setCurrentSignerId(consent.signer_id);
      setHasConsented(true);
      setShowConsentModal(false);
      showToast(`Consent authorized for Signer ${consent.signer_id}`);
    } catch (err: any) {
      alert(`Failed to save consent: ${err.message}`);
    }
  };

  // Handle saving a single take in recorder
  const handleSaveTake = async (take: RecordedTake) => {
    try {
      await saveTake(take);
      setTakes((prev) => [...prev, take]);
      showToast(`Take #${take.take_id} saved for '${take.label}' (${take.frame_count} frames)`);
    } catch (err: any) {
      alert(`Failed to save take: ${err.message}`);
    }
  };

  // Handle Zip Export
  const handleExportSession = async () => {
    try {
      const blob = await exportSessionZip(takes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sanketsetu_${currentSignerId}_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${takes.length} takes to ZIP bundle`);
    } catch (err: any) {
      alert(`Failed to export ZIP: ${err.message}`);
    }
  };

  // Handle Zip Import
  const handleImportSession = async (file: File) => {
    try {
      const result = await importSessionZip(file);
      for (const t of result.takes) {
        await saveTake(t);
      }
      setTakes((prev) => [...prev, ...result.takes]);
      showToast(`Imported ${result.takes.length} takes successfully`);
    } catch (err: any) {
      alert(`Failed to import ZIP: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* GLOBAL APPLICATION BAR */}
      <nav className="bg-slate-900/90 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <div className="font-black text-cyan-400 tracking-wider flex items-center gap-2">
            <span className="text-xl">🇮🇳</span>
            <span>SANKETSETU</span>
          </div>

          {/* Top Mode Nav Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('kiosk')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'kiosk'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🏛️ Citizen Kiosk
            </button>
            <button
              onClick={() => setActiveTab('clerk')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'clerk'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              💻 Clerk Screen
            </button>
            <button
              onClick={() => setActiveTab('recorder')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'recorder'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📹 Data Recorder
            </button>
            <button
              onClick={() => setActiveTab('coverage')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'coverage'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📊 Coverage Audit
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
          <span className="hidden md:inline bg-slate-800 px-2.5 py-1 rounded-md text-[11px] font-mono text-cyan-300">
            ON-DEVICE ML (12.7 KB ONNX)
          </span>
          <span className="hidden sm:inline bg-slate-800 px-2.5 py-1 rounded-md text-[11px] font-mono text-emerald-300">
            $0 FIREBASE SPARK
          </span>
        </div>
      </nav>

      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow-2xl animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* VIEWPORT BODY */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'kiosk' && (
          <KioskView
            vocabulary={vocabulary}
            syncAdapter={syncAdapter}
            currentLang={currentLang}
            onLanguageChange={setCurrentLang}
            langStrings={langStrings}
            activeDomain={activeDomain}
            onDomainToggle={setActiveDomain}
          />
        )}

        {activeTab === 'clerk' && (
          <ClerkView
            vocabulary={vocabulary}
            syncAdapter={syncAdapter}
            currentLang={currentLang}
          />
        )}

        {activeTab === 'recorder' && (
          <div>
            <Header
              activeTab="recorder"
              onTabChange={(tab) => setActiveTab(tab)}
              currentLang={currentLang}
              onLanguageChange={setCurrentLang}
              signerId={currentSignerId}
              onSwitchSigner={() => setShowConsentModal(true)}
              totalTakes={takes.length}
            />
            <div className="max-w-7xl mx-auto p-6">
              <RecorderView
                signerId={currentSignerId}
                vocabulary={vocabulary}
                selectedLabelId={selectedLabelId}
                onSelectLabelId={setSelectedLabelId}
                targetReps={targetReps}
                onTargetRepsChange={setTargetReps}
                onSaveTake={handleSaveTake}
                onExportSession={handleExportSession}
                onImportSession={handleImportSession}
                totalRecordedForCurrentLabel={takes.filter((t) => t.label === selectedLabelId).length}
                recordedCountsByNegativePrompt={{}}
              />
            </div>
          </div>
        )}

        {activeTab === 'coverage' && (
          <div>
            <Header
              activeTab="coverage"
              onTabChange={(tab) => setActiveTab(tab)}
              currentLang={currentLang}
              onLanguageChange={setCurrentLang}
              signerId={currentSignerId}
              onSwitchSigner={() => setShowConsentModal(true)}
              totalTakes={takes.length}
            />
            <div className="max-w-7xl mx-auto p-6">
              <CoverageDashboard
                takes={takes}
                vocabulary={vocabulary}
                targetRepsPerLabel={targetReps}
                onSelectLabelForRecording={(labelId: string) => {
                  setSelectedLabelId(labelId);
                  setActiveTab('recorder');
                }}
                selectedLabelId={selectedLabelId}
              />
            </div>
          </div>
        )}
      </main>

      {/* CONSENT MODAL */}
      {showConsentModal && (
        <ConsentModal
          currentSignerId={currentSignerId}
          onConsentComplete={handleConsentComplete}
          langStrings={langStrings}
          currentLang={currentLang}
          onLanguageChange={setCurrentLang}
        />
      )}
    </div>
  );
};
export default App;
