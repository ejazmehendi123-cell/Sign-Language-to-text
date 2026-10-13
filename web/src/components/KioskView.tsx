import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Building,
  HeartPulse,
  Camera,
  VideoOff,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

import { FlowEngine, ServiceFlow, RecognitionResult } from '../services/flowEngine';
import { inferenceService } from '../services/inference';
import { preprocessTakeFrames, calculateMotionEnergy } from '../services/preprocess';
import { SessionSyncAdapter, SessionMessage } from '../services/adapters/types';
import { initLandmarkers, extractLandmarksFromVideo, generateMockLandmarks } from '../services/mediapipe';
import { FrameLandmarks, VocabularyItem } from '../types';

// Flow and vocab configs
import birthFlowData from '../../../config/flows/birth_certificate.json';
import incomeFlowData from '../../../config/flows/income_certificate.json';
import rationFlowData from '../../../config/flows/ration_card.json';
import addressFlowData from '../../../config/flows/address_proof.json';
import statusFlowData from '../../../config/flows/application_status.json';
import hospitalFlowData from '../../../config/domains/hospital_opd/flows/opd_registration.json';
import sampleTakeFixture from '../../../data/fixtures/sample_take_raw.json';

const FLOW_MAP: Record<string, ServiceFlow> = {
  birth_certificate: birthFlowData as unknown as ServiceFlow,
  income_certificate: incomeFlowData as unknown as ServiceFlow,
  ration_card: rationFlowData as unknown as ServiceFlow,
  address_proof: addressFlowData as unknown as ServiceFlow,
  application_status: statusFlowData as unknown as ServiceFlow,
  hospital_opd: hospitalFlowData as unknown as ServiceFlow,
};

// Pictogram dictionary for clerk responses
const PICTOGRAM_MAP: Record<string, string> = {
  document: '📄',
  aadhaar: '🆔',
  fee: '💰',
  pay: '💵',
  wait: '⏳',
  hospital: '🏥',
  doctor: '🩺',
  form: '✍️',
  verified: '✅',
  help: '🤝',
  room: '🚪',
  check: '🔍',
};

interface KioskViewProps {
  vocabulary: VocabularyItem[];
  syncAdapter: SessionSyncAdapter;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
  langStrings: any;
  activeDomain: 'government' | 'hospital';
  onDomainToggle: (domain: 'government' | 'hospital') => void;
}

export const KioskView: React.FC<KioskViewProps> = ({
  vocabulary,
  syncAdapter,
  currentLang,
  onLanguageChange,
  activeDomain,
  onDomainToggle,
}) => {
  // Service flow state
  const [selectedFlowId, setSelectedFlowId] = useState<string>(
    activeDomain === 'hospital' ? 'hospital_opd' : 'birth_certificate'
  );
  const [flowEngine, setFlowEngine] = useState<FlowEngine>(() => {
    return new FlowEngine(FLOW_MAP[selectedFlowId] || FLOW_MAP.birth_certificate);
  });

  // Candidate recognition state
  const [candidateResult, setCandidateResult] = useState<RecognitionResult | null>(null);
  const [isSigningActive, setIsSigningActive] = useState<boolean>(false);
  const [motionEnergy, setMotionEnergy] = useState<number>(0);
  const [lastClerkReply, setLastClerkReply] = useState<string | null>(null);
  const [clerkPictogram, setClerkPictogram] = useState<string>('💬');

  // Camera & Stream State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [useMockStream, setUseMockStream] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [isInitializingCamera, setIsInitializingCamera] = useState<boolean>(false);

  // Video and landmark elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameBufferRef = useRef<FrameLandmarks[]>([]);
  const prevFrameRef = useRef<FrameLandmarks | null>(null);
  const frameCountRef = useRef<number>(0);

  // Initialize flow engine on flow switch
  useEffect(() => {
    const targetFlow = FLOW_MAP[selectedFlowId] || FLOW_MAP.birth_certificate;
    const engine = new FlowEngine(targetFlow);
    setFlowEngine(engine);
    setCandidateResult(null);

    // Notify clerk of flow switch
    syncAdapter.sendMessage({
      sender: 'citizen',
      type: 'flow_state',
      payload: {
        flow_id: targetFlow.service_id,
        state_id: engine.getCurrentStateId(),
        state_def: engine.getCurrentState(),
      },
    });
  }, [selectedFlowId]);

  // Adjust default flow on domain toggle
  useEffect(() => {
    if (activeDomain === 'hospital') {
      setSelectedFlowId('hospital_opd');
    } else {
      setSelectedFlowId('birth_certificate');
    }
  }, [activeDomain]);

  // Listen for clerk messages via session sync adapter
  useEffect(() => {
    syncAdapter.init('citizen', (msg: SessionMessage) => {
      if (msg.type === 'clerk_reply') {
        const text = msg.payload?.text || '';
        setLastClerkReply(text);

        // Deduce pictogram from reply keywords
        let matchedIcon = '💬';
        const lower = text.toLowerCase();
        for (const [key, icon] of Object.entries(PICTOGRAM_MAP)) {
          if (lower.includes(key)) {
            matchedIcon = icon;
            break;
          }
        }
        setClerkPictogram(matchedIcon);
      }
    });

    return () => {
      syncAdapter.disconnect();
    };
  }, [syncAdapter]);

  // Load ONNX inference session
  useEffect(() => {
    inferenceService.loadModel();
  }, []);

  // Camera start helper
  const startCamera = async () => {
    setCameraError(null);
    setIsInitializingCamera(true);
    try {
      await initLandmarkers();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        setUseMockStream(false);
      }
    } catch (err: any) {
      console.warn('Unable to access webcam in KioskView, switching to simulation stream:', err);
      setCameraError(err.message || 'Webcam permission denied');
      setUseMockStream(true);
      setIsCameraActive(false);
    } finally {
      setIsInitializingCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setUseMockStream(true);
  };

  // Start webcam on mount and cleanup on unmount
  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Frame processing loop & real-time landmark inference
  useEffect(() => {
    let animId: number;
    let fixtureFrameIdx = 0;
    const fixtureFrames = (sampleTakeFixture as any).frames as FrameLandmarks[];

    const loop = async () => {
      const now = performance.now();
      frameCountRef.current++;
      let frame: FrameLandmarks;

      const video = videoRef.current;
      const isVideoPlaying = video && !video.paused && !video.ended && video.readyState >= 2;

      if (!useMockStream && isVideoPlaying) {
        frame = extractLandmarksFromVideo(video, now);
      } else if (fixtureFrames.length > 0) {
        frame = fixtureFrames[fixtureFrameIdx % fixtureFrames.length];
        fixtureFrameIdx++;
      } else {
        frame = generateMockLandmarks(now);
      }

      // Render skeleton on canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (showSkeleton) {
            drawLandmarksOnCanvas(ctx, frame, canvas.width, canvas.height, isCameraActive && !useMockStream);
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      }

      // Compute kinetic motion energy
      if (prevFrameRef.current) {
        const energy = calculateMotionEnergy(prevFrameRef.current, frame);
        setMotionEnergy(energy);
        const active = energy > 0.02;
        setIsSigningActive(active);
      }
      prevFrameRef.current = frame;

      // Buffer frames for ONNX sequence classification
      frameBufferRef.current.push(frame);
      if (frameBufferRef.current.length > 30) {
        frameBufferRef.current.shift();
      }

      // Run inference every 30-45 frames if candidate not currently awaiting confirmation
      if (frameBufferRef.current.length === 30 && !candidateResult && frameCountRef.current % 45 === 0) {
        const flatFeatures = preprocessTakeFrames(frameBufferRef.current);
        const res = await inferenceService.predict(flatFeatures, flowEngine);
        setCandidateResult(res);

        // Broadcast candidate preview to clerk
        syncAdapter.sendMessage({
          sender: 'citizen',
          type: 'sign_candidate',
          payload: {
            label: res.topLabel,
            confidence: res.confidence,
            is_confident: res.isConfident,
          },
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [useMockStream, isCameraActive, showSkeleton, candidateResult, flowEngine]);

  const currentState = flowEngine.getCurrentState();
  const promptText = currentState?.prompt[currentLang as 'en' | 'hi' | 'mr'] || currentState?.prompt.en;

  // Handle explicit citizen confirmation
  const handleConfirmCandidate = () => {
    if (!candidateResult) return;

    const label = candidateResult.topLabel;
    syncAdapter.sendMessage({
      sender: 'citizen',
      type: 'sign_confirmed',
      payload: {
        label,
        confidence: candidateResult.confidence,
        state_id: flowEngine.getCurrentStateId(),
      },
    });

    // Advance flow engine
    const nextResult = flowEngine.transition(label);
    setCandidateResult(null);

    // Sync updated state to clerk
    syncAdapter.sendMessage({
      sender: 'citizen',
      type: 'flow_state',
      payload: {
        flow_id: flowEngine.getFlow().service_id,
        state_id: nextResult.nextStateId,
        state_def: flowEngine.getCurrentState(),
      },
    });
  };

  // Handle citizen redo
  const handleRedoCandidate = () => {
    setCandidateResult(null);
    frameBufferRef.current = [];
  };

  // Direct simulation trigger for immediate testing
  const handleDirectSignTest = (signId: string) => {
    const res: RecognitionResult = {
      topLabel: signId,
      confidence: 0.96,
      margin: 0.85,
      isConfident: true,
      latencyMs: 1.5,
      needsRetry: false,
    };
    setCandidateResult(res);
    syncAdapter.sendMessage({
      sender: 'citizen',
      type: 'sign_candidate',
      payload: {
        label: signId,
        confidence: 0.96,
        is_confident: true,
      },
    });
  };

  // Find vocabulary item details
  const getVocabItem = (labelId: string) => {
    return vocabulary.find((v) => v.id === labelId);
  };

  const candidateVocab = candidateResult ? getVocabItem(candidateResult.topLabel) : null;
  const candidateDisplay =
    candidateVocab?.labels[currentLang as 'en' | 'hi' | 'mr'] || candidateResult?.topLabel || '';

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white select-none">
      {/* 1. HONEST POSITIONING BANNER */}
      <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-amber-200 text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            <strong>Phrase Recognition Assistant:</strong> Not a full ISL translator. Recognizes common service phrases. If unsure, the system prompts you to sign again.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="bg-amber-900/60 px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
            Zero Video Transmitted (100% On-Device)
          </span>
        </div>
      </div>

      {/* 2. TOP ACCESSIBLE CONTROLS */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/20 p-2.5 rounded-xl border border-cyan-500/40 text-cyan-400">
            {activeDomain === 'hospital' ? <HeartPulse className="w-7 h-7" /> : <Building className="w-7 h-7" />}
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              SanketSetu <span className="text-xs bg-cyan-950 border border-cyan-800 text-cyan-300 px-2 py-0.5 rounded-full font-mono">KIOSK</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {activeDomain === 'hospital' ? 'Hospital OPD Desk Assistant' : 'Citizen Service Counter Assistant'}
            </p>
          </div>
        </div>

        {/* Domain and Language Switchers */}
        <div className="flex items-center gap-3">
          {/* Domain toggle */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-sm font-bold">
            <button
              onClick={() => onDomainToggle('government')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeDomain === 'government'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Government
            </button>
            <button
              onClick={() => onDomainToggle('hospital')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeDomain === 'hospital'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hospital OPD
            </button>
          </div>

          {/* Service flow picker */}
          <select
            value={selectedFlowId}
            onChange={(e) => setSelectedFlowId(e.target.value)}
            className="bg-slate-800 text-slate-200 font-bold border border-slate-700 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
          >
            {activeDomain === 'government' ? (
              <>
                <option value="birth_certificate">Birth Certificate</option>
                <option value="income_certificate">Income Certificate</option>
                <option value="ration_card">Ration Card</option>
                <option value="address_proof">Address Proof / Domicile</option>
                <option value="application_status">Application Status</option>
              </>
            ) : (
              <option value="hospital_opd">Hospital OPD Registration</option>
            )}
          </select>

          {/* Language Switcher */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-sm font-bold">
            <button
              onClick={() => onLanguageChange('en')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                currentLang === 'en' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'
              }`}
            >
              English
            </button>
            <button
              onClick={() => onLanguageChange('hi')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                currentLang === 'hi' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'
              }`}
            >
              हिंदी
            </button>
            <button
              onClick={() => onLanguageChange('mr')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                currentLang === 'mr' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'
              }`}
            >
              मराठी
            </button>
          </div>
        </div>
      </header>

      {/* Camera Permission Alert Banner (if webcam blocked) */}
      {cameraError && (
        <div className="bg-amber-900/50 border-b border-amber-600/60 px-6 py-2.5 flex items-center justify-between text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>
              <strong>Webcam status:</strong> {cameraError}. Running in Demo Simulation Mode. To use your camera, allow camera permission in your browser address bar.
            </span>
          </div>
          <button
            onClick={startCamera}
            className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer"
          >
            Retry Camera
          </button>
        </div>
      )}

      {/* 3. MAIN KIOSK BODY */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 p-6 gap-6 max-w-7xl mx-auto w-full">
        {/* LEFT COLUMN: Camera & Skeleton View (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl aspect-video flex items-center justify-center">
            {/* Real Webcam Video (mirrored horizontally for intuitive selfie perspective) */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover transform -scale-x-100 ${
                isCameraActive && !useMockStream ? 'opacity-90' : 'hidden'
              }`}
              muted
              playsInline
              autoPlay
            />

            {/* Realtime Skeleton Landmark Canvas */}
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className={`w-full h-full object-cover ${
                isCameraActive && !useMockStream
                  ? 'absolute inset-0 transform -scale-x-100 pointer-events-none'
                  : ''
              }`}
            />

            {/* Top Overlay Bar: Camera Status & Controls */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-700 px-3 py-1 rounded-full text-xs font-bold text-slate-200">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isSigningActive
                        ? 'bg-emerald-400 animate-ping'
                        : isCameraActive && !useMockStream
                        ? 'bg-emerald-400'
                        : 'bg-cyan-400'
                    }`}
                  />
                  {isSigningActive
                    ? 'SIGNING DETECTED'
                    : isCameraActive && !useMockStream
                    ? 'LIVE WEBCAM'
                    : 'SIMULATION DEMO'}
                </span>

                <span className="bg-slate-950/85 backdrop-blur-md border border-slate-700 px-2.5 py-1 rounded-full text-xs font-mono text-cyan-300">
                  Energy: {(motionEnergy * 100).toFixed(1)}
                </span>
              </div>

              {/* Camera Toggles */}
              <div className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1 rounded-xl border border-slate-700 text-xs font-bold">
                {isCameraActive && !useMockStream ? (
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                    title="Switch to Demo Simulation Stream"
                  >
                    <VideoOff className="w-3.5 h-3.5 text-amber-400" />
                    <span>Demo Stream</span>
                  </button>
                ) : (
                  <button
                    onClick={startCamera}
                    disabled={isInitializingCamera}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-emerald-300 hover:text-emerald-200 bg-emerald-950/60 border border-emerald-700/60 hover:bg-emerald-900 transition cursor-pointer"
                    title="Activate Live Webcam"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isInitializingCamera ? 'Starting...' : 'Use Webcam'}</span>
                  </button>
                )}

                <button
                  onClick={() => setShowSkeleton(!showSkeleton)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    showSkeleton ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Toggle Landmark Skeleton"
                >
                  {showSkeleton ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Allowed Signs Chip Row */}
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-1.5 pointer-events-none">
              {currentState.active_vocab.map((vId) => {
                const item = getVocabItem(vId);
                const label = item?.labels[currentLang as 'en' | 'hi' | 'mr'] || vId;
                return (
                  <span
                    key={vId}
                    className="bg-slate-950/85 backdrop-blur border border-cyan-500/30 text-cyan-300 text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Current Service Flow Prompt Box & Quick-Sign Testing Chips */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" />
              Service Step: {currentState.id.replace(/_/g, ' ')}
            </div>
            <div className="text-2xl font-bold text-white leading-snug">
              {promptText}
            </div>

            {/* Quick Testing Bar: Click any active sign to test without gesturing */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>One-Click Test (Sign in front of camera, or tap below):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentState.active_vocab.map((vId) => {
                  const item = getVocabItem(vId);
                  const label = item?.labels[currentLang as 'en' | 'hi' | 'mr'] || vId;
                  return (
                    <button
                      key={vId}
                      onClick={() => handleDirectSignTest(vId)}
                      className="bg-cyan-950/70 hover:bg-cyan-800/80 border border-cyan-700/60 hover:border-cyan-400 text-cyan-200 text-xs px-3 py-1.5 rounded-xl font-bold transition-all active:scale-95 cursor-pointer shadow"
                    >
                      Sign "{label.toUpperCase()}"
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Recognition Candidate & Clerk Bridge (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* HUGE CANDIDATE PHRASE DISPLAY */}
          <div className="bg-slate-900 border-2 border-cyan-500/50 rounded-3xl p-6 shadow-2xl flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                <span>Recognized Sign (Candidate)</span>
                {candidateResult && (
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono font-bold ${
                      candidateResult.isConfident
                        ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                        : 'bg-amber-950 border border-amber-700 text-amber-300'
                    }`}
                  >
                    {(candidateResult.confidence * 100).toFixed(0)}% Match
                  </span>
                )}
              </div>

              {candidateResult ? (
                <div className="py-4 text-center">
                  <div className="text-6xl font-black text-cyan-300 tracking-tight mb-2 uppercase drop-shadow-md">
                    {candidateDisplay}
                  </div>
                  <div className="text-slate-400 text-sm font-semibold">
                    Gloss: <span className="font-mono text-cyan-400 font-bold">{candidateVocab?.gloss || candidateResult.topLabel}</span>
                  </div>
                  {!candidateResult.isConfident && (
                    <div className="mt-3 text-xs text-amber-300 bg-amber-950/50 border border-amber-800/60 p-2 rounded-lg">
                      Confidence below counter threshold. You may confirm or sign again.
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-center text-slate-500">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center mb-2 animate-spin">
                    <RefreshCw className="w-5 h-5 text-slate-600" />
                  </div>
                  <span className="text-lg font-bold text-slate-400">Please sign in front of camera</span>
                  <span className="text-xs text-slate-500 mt-1">Make one of the listed signs clearly</span>
                </div>
              )}
            </div>

            {/* ACTION BUTTONS: CONFIRM OR REDO */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                disabled={!candidateResult}
                onClick={handleConfirmCandidate}
                className={`py-4 px-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${
                  candidateResult
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer active:scale-95'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-6 h-6" />
                Confirm Phrase
              </button>
              <button
                disabled={!candidateResult}
                onClick={handleRedoCandidate}
                className={`py-4 px-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 border transition-all ${
                  candidateResult
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200 cursor-pointer active:scale-95'
                    : 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <RefreshCw className="w-6 h-6" />
                Sign Again
              </button>
            </div>
          </div>

          {/* CLERK'S RESPONSE DISPLAY (High Contrast & Pictogram) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex-1 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Clerk's Spoken / Written Response
              </div>
              <div className="flex items-start gap-4 mt-2">
                <div className="text-5xl shrink-0 p-3 bg-slate-800 rounded-2xl border border-slate-700">
                  {clerkPictogram}
                </div>
                <div className="flex-1 text-2xl font-black text-slate-100 leading-tight">
                  {lastClerkReply || (
                    <span className="text-slate-600 font-medium italic text-lg">
                      Waiting for clerk's reply...
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Assistance escalation button */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span>Need help? Touch clerk bell:</span>
              <button
                onClick={() => {
                  syncAdapter.sendMessage({
                    sender: 'citizen',
                    type: 'call_clerk',
                    payload: { reason: 'User touched help bell' },
                  });
                  alert('Counter clerk alerted for in-person support.');
                }}
                className="bg-amber-600/30 hover:bg-amber-600/50 border border-amber-600/60 text-amber-200 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                🔔 Call Clerk
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Draws torso and hand skeletons on canvas
 */
function drawLandmarksOnCanvas(
  ctx: CanvasRenderingContext2D,
  frame: FrameLandmarks,
  width: number,
  height: number,
  hasVideoUnderneath: boolean = false
) {
  ctx.clearRect(0, 0, width, height);

  if (!hasVideoUnderneath) {
    // Dark background tint for simulation/offline mode
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);
  }

  // Draw Upper Body Pose (Gold/Amber)
  if (frame.masks.pose && frame.pose.length >= 17) {
    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = '#fbbf24';
    ctx.lineWidth = 3;

    const connections = [
      [11, 12], // shoulders
      [11, 13], [13, 15], // left arm
      [12, 14], [14, 16], // right arm
    ];

    for (const [from, to] of connections) {
      const p1 = frame.pose[from];
      const p2 = frame.pose[to];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }

    for (const idx of [11, 12, 13, 14, 15, 16]) {
      const lm = frame.pose[idx];
      if (lm) {
        ctx.beginPath();
        ctx.arc(lm.x * width, lm.y * height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  // Draw Left Hand (Emerald)
  if (frame.masks.left_hand && frame.left_hand.length === 21) {
    ctx.strokeStyle = '#10b981';
    ctx.fillStyle = '#34d399';
    ctx.lineWidth = 2;

    for (const lm of frame.left_hand) {
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // Draw Right Hand (Cyan)
  if (frame.masks.right_hand && frame.right_hand.length === 21) {
    ctx.strokeStyle = '#06b6d4';
    ctx.fillStyle = '#22d3ee';
    ctx.lineWidth = 2;

    for (const lm of frame.right_hand) {
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}
