import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  CheckCircle2,
  FileCheck,
  Building,
  Sparkles,
} from 'lucide-react';

import { SessionSyncAdapter, SessionMessage, SpeechToTextAdapter } from '../services/adapters/types';
import { createSpeechToTextAdapter } from '../services/adapters/speechToText';
import { VocabularyItem } from '../types';

interface ClerkViewProps {
  vocabulary: VocabularyItem[];
  syncAdapter: SessionSyncAdapter;
  currentLang?: string;
}

interface TimelineEvent {
  id: string;
  sender: 'citizen' | 'clerk' | 'system';
  type: string;
  text: string;
  timestamp: number;
}

export const ClerkView: React.FC<ClerkViewProps> = ({
  vocabulary,
  syncAdapter,
  currentLang: _currentLang,
}) => {
  // Connection and communication state
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [currentFlowState, setCurrentFlowState] = useState<any>(null);

  // Clerk reply composer state
  const [replyText, setReplyText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [sttError, setSttError] = useState<string | null>(null);

  // Speech-to-text adapter
  const [sttAdapter] = useState<SpeechToTextAdapter>(() => createSpeechToTextAdapter(true));

  // Initialize sync adapter for clerk role
  useEffect(() => {
    syncAdapter.init(
      'clerk',
      (msg: SessionMessage) => {
        if (msg.type === 'sign_confirmed') {
          const vocabItem = vocabulary.find((v) => v.id === msg.payload.label);
          const gloss = vocabItem?.gloss || msg.payload.label;
          const displayLabel = vocabItem?.labels.en || gloss;

          setTimeline((prev) => [
            ...prev,
            {
              id: msg.id,
              sender: 'citizen',
              type: 'sign_confirmed',
              text: `Signed: ${displayLabel.toUpperCase()} (${(msg.payload.confidence * 100).toFixed(0)}% confidence)`,
              timestamp: msg.timestamp,
            },
          ]);
        } else if (msg.type === 'sign_candidate') {
          // Preview candidate
        } else if (msg.type === 'flow_state') {
          setCurrentFlowState(msg.payload);
        } else if (msg.type === 'call_clerk') {
          setTimeline((prev) => [
            ...prev,
            {
              id: msg.id,
              sender: 'citizen',
              type: 'alert',
              text: '🔔 Citizen requested in-person assistance at the counter!',
              timestamp: msg.timestamp,
            },
          ]);
        }
      },
      (connected) => setIsConnected(connected)
    );

    return () => {
      syncAdapter.disconnect();
    };
  }, [syncAdapter, vocabulary]);

  // Handle Speech-to-text toggling
  const toggleListening = () => {
    if (isListening) {
      sttAdapter.stop();
      setIsListening(false);
    } else {
      setSttError(null);
      sttAdapter.start(
        (transcript, isFinal) => {
          setReplyText(transcript);
          if (isFinal) {
            setIsListening(false);
          }
        },
        (err) => {
          setSttError(err);
          setIsListening(false);
        }
      );
      setIsListening(true);
    }
  };

  // Send message back to kiosk
  const handleSendReply = (textToSend?: string) => {
    const content = textToSend || replyText;
    if (!content.trim()) return;

    syncAdapter.sendMessage({
      sender: 'clerk',
      type: 'clerk_reply',
      payload: { text: content.trim() },
    });

    setTimeline((prev) => [
      ...prev,
      {
        id: `clerk_${Date.now()}`,
        sender: 'clerk',
        type: 'clerk_reply',
        text: `You replied: "${content.trim()}"`,
        timestamp: Date.now(),
      },
    ]);

    setReplyText('');
    if (isListening) {
      sttAdapter.stop();
      setIsListening(false);
    }
  };

  // Contextual Quick Reply Chips
  const quickReplies = [
    'Please submit your original Aadhaar card.',
    'Government processing fee is Rs. 20.',
    'Application is verified and approved.',
    'Please wait 5 minutes in the seating area.',
    'Please sign the verification box on page 2.',
    'Please bring hospital discharge summary.',
    'Proceed to Room 4 for officer verification.',
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white select-none">
      {/* HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/40 text-blue-400">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              SanketSetu Counter Console
              <span className="text-xs bg-blue-950 border border-blue-700 text-blue-300 px-2 py-0.5 rounded-full font-mono">
                CLERK TERMINAL
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Synchronized via {syncAdapter.getAdapterName()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            {isConnected ? 'Kiosk Connected' : 'Kiosk Disconnected'}
          </div>
        </div>
      </header>

      {/* MAIN CLERK WORKSPACE */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 p-6 gap-6 max-w-7xl mx-auto w-full">
        {/* LEFT PANEL: Service Flow Context & Guidance (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="w-4 h-4" /> Active Service Context
              </span>
              <span className="text-xs font-mono bg-blue-950 border border-blue-800 text-blue-300 px-2 py-0.5 rounded">
                {currentFlowState?.flow_id || 'Active Workflow'}
              </span>
            </div>

            {currentFlowState?.state_def ? (
              <div className="space-y-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400 font-bold uppercase mb-1">
                    Citizen Prompt (Showing on Kiosk)
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    "{currentFlowState.state_def.prompt?.en}"
                  </div>
                </div>

                <div className="bg-blue-950/40 p-3.5 rounded-xl border border-blue-900/60 text-blue-200">
                  <div className="text-xs text-blue-400 font-bold uppercase mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Clerk Guidance Hint
                  </div>
                  <div className="text-sm">
                    {currentFlowState.state_def.clerk_hint?.en || 'Waiting for citizen input.'}
                  </div>
                </div>

                {/* Required Documents */}
                {currentFlowState.state_def.required_documents && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400 font-bold uppercase mb-2">
                      Required Documents Checklist
                    </div>
                    <ul className="text-xs space-y-1 text-slate-300 font-medium">
                      {currentFlowState.state_def.required_documents.map((doc: string) => (
                        <li key={doc} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          {doc.replace(/_/g, ' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Applicable Fee */}
                {currentFlowState.state_def.fee && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase">Government Fee:</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      Rs. {currentFlowState.state_def.fee.amount_inr}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No active service flow received yet. Select a service on the Kiosk.
              </div>
            )}
          </div>

          {/* QUICK-REPLY CHIP PALETTE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex-1">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              One-Touch Quick Replies (Sends to Kiosk with Pictogram)
            </div>
            <div className="flex flex-col gap-2">
              {quickReplies.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => handleSendReply(reply)}
                  className="text-left text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 text-slate-200 p-2.5 rounded-xl font-medium transition-all active:scale-98 cursor-pointer"
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Live Timeline & Speech/Text Composer (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* CITIZEN INTERACTION TIMELINE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex-1 flex flex-col">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Citizen Interaction Timeline</span>
              <span className="text-slate-500 font-mono text-[11px]">Real-Time Feed</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[380px] pr-1">
              {timeline.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-600 text-sm italic">
                  No interactions recorded yet. Waiting for citizen to sign...
                </div>
              ) : (
                timeline.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl text-sm font-semibold border ${
                      item.sender === 'citizen'
                        ? item.type === 'alert'
                          ? 'bg-amber-950/60 border-amber-700/80 text-amber-200'
                          : 'bg-cyan-950/40 border-cyan-800/60 text-cyan-200'
                        : 'bg-blue-950/40 border-blue-800/60 text-blue-200'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs text-slate-400 mb-1 font-mono">
                      <span>{item.sender.toUpperCase()}</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div>{item.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RESPONSE COMPOSER (SPEECH-TO-TEXT & TYPED INPUT) */}
          <div className="bg-slate-900 border-2 border-blue-500/40 rounded-2xl p-5 shadow-xl">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Reply to Citizen (Converts to Large Text on Kiosk)</span>
              <span className="text-xs font-mono text-blue-400">
                {sttAdapter.getAdapterName()}
              </span>
            </div>

            {sttError && (
              <div className="text-xs bg-red-950/60 border border-red-800 text-red-300 p-2 rounded-lg mb-2">
                {sttError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                placeholder="Type or speak response for the citizen..."
                className="flex-1 bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Push-to-Talk Speech Recognition Button */}
              <button
                onClick={toggleListening}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-500 border-red-400 text-white animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
                title={isListening ? 'Stop Listening' : 'Push-to-Talk (Web Speech)'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Send Button */}
              <button
                onClick={() => handleSendReply()}
                disabled={!replyText.trim()}
                className={`py-3 px-5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  replyText.trim()
                    ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
