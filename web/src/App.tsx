import React, { useState, useEffect, useMemo } from 'react';
import { RecordedTake, SignerConsent, VocabularyItem, VocabularyConfig } from './types';
import { saveTake, getTakes, saveConsent, getConsent } from './services/db';
import { exportSessionZip, importSessionZip } from './services/zip';
import { ConsentModal } from './components/ConsentModal';
import { Header } from './components/Header';
import { RecorderView } from './components/RecorderView';
import { CoverageDashboard } from './components/CoverageDashboard';

// Configuration imports
import vocabData from '../../config/vocabulary.json';
import i18nEn from '../../config/i18n/en.json';
import i18nHi from '../../config/i18n/hi.json';
import i18nMr from '../../config/i18n/mr.json';

const I18N_MAP: Record<string, any> = {
  en: i18nEn,
  hi: i18nHi,
  mr: i18nMr,
};

export const App: React.FC = () => {
  // Vocabulary loaded from config contract
  const vocabulary: VocabularyItem[] = (vocabData as VocabularyConfig).vocabulary;

  // Signer & Consent State
  const [currentSignerId, setCurrentSignerId] = useState<string>(() => {
    return `signer_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [, setHasConsented] = useState<boolean>(false);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(true);

  // App Settings
  const [currentLang, setCurrentLang] = useState<string>('en');
  const [activeTab, setActiveTab] = useState<'recorder' | 'coverage'>('recorder');
  const [selectedLabelId, setSelectedLabelId] = useState<string>('certificate');
  const [targetReps, setTargetReps] = useState<number>(10);

  // Data Takes State
  const [takes, setTakes] = useState<RecordedTake[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const langStrings = I18N_MAP[currentLang] || i18nEn;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load initial takes and check consent from IndexedDB
  useEffect(() => {
    async function loadData() {
      try {
        const loadedTakes = await getTakes();
        setTakes(loadedTakes);

        const existingConsent = await getConsent(currentSignerId);
        if (existingConsent && existingConsent.consented) {
          setHasConsented(true);
          setShowConsentModal(false);
        } else {
          setHasConsented(false);
          setShowConsentModal(true);
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

  // Handle saving a single take
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
    if (takes.length === 0) {
      alert('No takes recorded yet to export.');
      return;
    }
    try {
      showToast('Generating zip archive...');
      const blob = await exportSessionZip(takes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `isl_landmark_dataset_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${takes.length} takes successfully!`);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  // Handle Zip Import
  const handleImportSession = async (file: File) => {
    try {
      showToast('Importing and validating zip...');
      const { takes: importedTakes } = await importSessionZip(file);

      let addedCount = 0;
      for (const take of importedTakes) {
        await saveTake(take);
        addedCount++;
      }

      const refreshed = await getTakes();
      setTakes(refreshed);
      showToast(`Imported ${addedCount} valid takes from ${file.name}`);
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    }
  };

  // Stats calculation for active label and negative prompts
  const totalRecordedForCurrentLabel = useMemo(() => {
    return takes.filter((t) => t.label === selectedLabelId).length;
  }, [takes, selectedLabelId]);

  const recordedCountsByNegativePrompt = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const take of takes) {
      if (take.label === 'no_sign' && take.metadata?.notes) {
        const match = take.metadata.notes.match(/Negative:\s*([^\-]+)/);
        if (match && match[1]) {
          const key = match[1].trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    }
    return counts;
  }, [takes]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow-2xl animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Mandatory Consent Modal */}
      {showConsentModal && (
        <ConsentModal
          currentSignerId={currentSignerId}
          onConsentComplete={handleConsentComplete}
          langStrings={langStrings}
          currentLang={currentLang}
          onLanguageChange={setCurrentLang}
        />
      )}

      {/* Main Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        signerId={currentSignerId}
        onSwitchSigner={() => setShowConsentModal(true)}
        totalTakes={takes.length}
      />

      {/* Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {isLoadingDB ? (
          <div className="h-64 flex items-center justify-center text-slate-400">
            Initializing local landmark database...
          </div>
        ) : activeTab === 'recorder' ? (
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
            totalRecordedForCurrentLabel={totalRecordedForCurrentLabel}
            recordedCountsByNegativePrompt={recordedCountsByNegativePrompt}
          />
        ) : (
          <CoverageDashboard
            takes={takes}
            vocabulary={vocabulary}
            targetRepsPerLabel={targetReps}
            onSelectLabelForRecording={(labelId) => {
              setSelectedLabelId(labelId);
              setActiveTab('recorder');
            }}
            selectedLabelId={selectedLabelId}
          />
        )}
      </main>
    </div>
  );
};

export default App;
