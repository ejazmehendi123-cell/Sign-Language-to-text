import React, { useState, useRef, useEffect } from 'react';
import {
  RecordedTake,
  VocabularyItem,
  TakeMetadata,
  LightingCondition,
  BackgroundType,
  CameraHeight,
  Handedness,
  FrameLandmarks,
} from '../types';
import {
  initLandmarkers,
  extractLandmarksFromVideo,
  drawLandmarksOnCanvas,
  generateMockLandmarks,
} from '../services/mediapipe';
import { NoSignPrompts, NoSignPrompt } from './NoSignPrompts';
import {
  Check,
  X,
  RotateCcw,
  Camera,
  Layers,
  Download,
  Upload,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface RecorderViewProps {
  signerId: string;
  vocabulary: VocabularyItem[];
  selectedLabelId: string;
  onSelectLabelId: (id: string) => void;
  targetReps: number;
  onTargetRepsChange: (reps: number) => void;
  onSaveTake: (take: RecordedTake) => Promise<void>;
  onExportSession: () => void;
  onImportSession: (file: File) => void;
  totalRecordedForCurrentLabel: number;
  recordedCountsByNegativePrompt: Record<string, number>;
}

export const RecorderView: React.FC<RecorderViewProps> = ({
  signerId,
  vocabulary,
  selectedLabelId,
  onSelectLabelId,
  targetReps,
  onTargetRepsChange,
  onSaveTake,
  onExportSession,
  onImportSession,
  totalRecordedForCurrentLabel,
  recordedCountsByNegativePrompt,
}) => {
  // Video and Canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingFramesRef = useRef<FrameLandmarks[]>([]);
  const isRecordingRef = useRef(false);

  // States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [useMockStream, setUseMockStream] = useState(false);
  const [showLandmarkOverlay, setShowLandmarkOverlay] = useState(true);
  const [showFramingGuide, setShowFramingGuide] = useState(true);

  // Metadata form
  const [metadata, setMetadata] = useState<TakeMetadata>({
    lighting: 'bright_indoor',
    distance_cm_estimate: 100,
    background: 'plain',
    camera_height: 'chest_level',
    handedness_dominant: 'right',
    device: navigator.userAgent.slice(0, 40),
    notes: '',
  });

  // Recording State Machine: 'idle' | 'countdown' | 'recording' | 'review'
  const [recordState, setRecordState] = useState<'idle' | 'countdown' | 'recording' | 'review'>(
    'idle'
  );
  const [countdownNum, setCountdownNum] = useState(3);
  const [recordedTakeReview, setRecordedTakeReview] = useState<RecordedTake | null>(null);
  const [recordingDurationSec, setRecordingDurationSec] = useState(0);

  // Active negative prompt
  const [activeNegativePrompt, setActiveNegativePrompt] = useState<string | null>(null);

  // Initialize MediaPipe models
  useEffect(() => {
    initLandmarkers();
  }, []);

  // Camera start helper
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Unable to access webcam, switching to mock generator:', err);
      setCameraError(err.message || 'Webcam permission denied');
      setUseMockStream(true);
      setCameraActive(true);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Frame processing loop
  useEffect(() => {
    const processFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (canvas) {
        const width = canvas.width || 640;
        const height = canvas.height || 480;
        const now = performance.now();

        let frameLandmarks: FrameLandmarks;

        if (useMockStream || !video || video.readyState < 2) {
          frameLandmarks = generateMockLandmarks(now);
        } else {
          frameLandmarks = extractLandmarksFromVideo(video, now);
        }

        if (showLandmarkOverlay) {
          drawLandmarksOnCanvas(canvas, frameLandmarks, width, height);
        } else {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, width, height);
        }

        if (isRecordingRef.current) {
          recordingFramesRef.current.push(frameLandmarks);
        }
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [useMockStream, showLandmarkOverlay]);

  // Start recording workflow with countdown
  const initiateCountdown = () => {
    if (recordState !== 'idle') return;
    setRecordState('countdown');
    setCountdownNum(3);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNum(count);
      } else {
        clearInterval(interval);
        startActualRecording();
      }
    }, 1000);
  };

  const startActualRecording = () => {
    recordingFramesRef.current = [];
    isRecordingRef.current = true;
    setRecordState('recording');
    setRecordingDurationSec(0);

    const startTime = Date.now();
    const durationInterval = setInterval(() => {
      if (!isRecordingRef.current) {
        clearInterval(durationInterval);
        return;
      }
      setRecordingDurationSec(Math.floor((Date.now() - startTime) / 1000));
    }, 250);

    // Auto-cap recording at 3.5 seconds (typical ISL counter phrase duration)
    setTimeout(() => {
      if (isRecordingRef.current) {
        stopActualRecording();
      }
    }, 3500);
  };

  const stopActualRecording = () => {
    isRecordingRef.current = false;
    const rawFrames = [...recordingFramesRef.current];
    const takeId = `take_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    const newTake: RecordedTake = {
      signer_id: signerId,
      label: selectedLabelId,
      take_id: takeId,
      timestamp: Date.now(),
      fps: 30,
      metadata: { ...metadata },
      frames: rawFrames,
      frame_count: rawFrames.length,
    };

    setRecordedTakeReview(newTake);
    setRecordState('review');
  };

  const handleAcceptTake = async () => {
    if (!recordedTakeReview) return;
    await onSaveTake(recordedTakeReview);
    setRecordedTakeReview(null);
    setRecordState('idle');
  };

  const handleDiscardTake = () => {
    setRecordedTakeReview(null);
    setRecordState('idle');
  };

  const handleReRecord = () => {
    setRecordedTakeReview(null);
    initiateCountdown();
  };

  const handleSelectNegativePrompt = (prompt: NoSignPrompt) => {
    onSelectLabelId('no_sign');
    setActiveNegativePrompt(prompt.id);
    setMetadata((prev) => ({
      ...prev,
      notes: `Negative: ${prompt.label} - ${prompt.description}`,
    }));
  };

  const selectedVocabItem = vocabulary.find((v) => v.id === selectedLabelId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT COLUMN: Camera Preview, Skeleton, Guide & Action Bar */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        {/* Camera and Skeleton Overlay Box */}
        <div className="relative bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 aspect-video shadow-2xl flex items-center justify-center">
          {/* Webcam Video */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transform -scale-x-100 ${
              useMockStream ? 'opacity-20' : 'opacity-90'
            }`}
            muted
            playsInline
          />

          {/* Skeleton Landmark Canvas */}
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="absolute inset-0 w-full h-full transform -scale-x-100 pointer-events-none"
          />

          {/* Silhouette Framing Guide */}
          {showFramingGuide && (
            <div className="absolute inset-0 border-2 border-dashed border-emerald-500/40 m-6 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
              <div className="flex justify-between items-center text-[11px] font-mono font-bold text-emerald-400 bg-black/60 px-2.5 py-1 rounded w-fit">
                <span>HEAD &amp; TORSO ZONE</span>
              </div>
              <div className="self-center w-48 h-32 border-2 border-emerald-500/30 rounded-full opacity-60 flex items-center justify-center text-[10px] text-emerald-400 font-mono">
                Face Center
              </div>
              <div className="flex justify-between items-center text-[11px] font-mono font-bold text-emerald-400 bg-black/60 px-2.5 py-1 rounded">
                <span>LEFT HAND ZONE</span>
                <span>RIGHT HAND ZONE</span>
              </div>
            </div>
          )}

          {/* Top Overlays: Status and Toggles */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
              <div
                className={`w-2.5 h-2.5 rounded-full ${cameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}
              />
              <span className="text-slate-200">
                {useMockStream ? 'Synthetic Mock Stream' : 'Webcam Active'}
              </span>
              {cameraError && (
                <span className="text-amber-400 flex items-center gap-1 text-[10px]" title={cameraError}>
                  <AlertCircle className="w-3 h-3" /> Camera fallback
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/80 backdrop-blur p-1 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setShowLandmarkOverlay(!showLandmarkOverlay)}
                className={`p-1.5 rounded flex items-center gap-1 font-semibold ${
                  showLandmarkOverlay
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle Landmark Overlay"
              >
                {showLandmarkOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="text-[11px]">Skeleton</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFramingGuide(!showFramingGuide)}
                className={`p-1.5 rounded flex items-center gap-1 font-semibold ${
                  showFramingGuide
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle Framing Guide"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="text-[11px]">Guide</span>
              </button>
            </div>
          </div>

          {/* Countdown Overlay */}
          {recordState === 'countdown' && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
              <span className="text-9xl font-black text-emerald-400 animate-ping">
                {countdownNum}
              </span>
              <span className="text-xl font-bold uppercase tracking-widest text-slate-200 mt-4">
                Get Ready to Sign
              </span>
            </div>
          )}

          {/* Active Recording Pulsing Indicator */}
          {recordState === 'recording' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-red-600/90 text-white px-5 py-2 rounded-full font-bold shadow-lg animate-pulse">
              <div className="w-3.5 h-3.5 rounded-full bg-white" />
              <span className="tracking-widest uppercase text-sm">RECORDING ({recordingDurationSec}s)</span>
              <button
                type="button"
                onClick={stopActualRecording}
                className="ml-2 bg-black/40 hover:bg-black/60 px-2 py-0.5 rounded text-xs"
              >
                Stop
              </button>
            </div>
          )}
        </div>

        {/* Big Action Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          {recordState === 'review' && recordedTakeReview ? (
            /* Review Controls */
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-mono">Take Captured</span>
                  <div className="text-sm font-bold text-white">
                    {recordedTakeReview.frame_count} frames recorded •{' '}
                    {recordedTakeReview.frames.filter((f) => f.masks.left_hand || f.masks.right_hand)
                      .length}{' '}
                    frames with hands detected
                  </div>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded">
                  Landmarks Only
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={handleAcceptTake}
                  className="flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg transition-transform active:scale-95"
                >
                  <Check className="w-5 h-5" /> Accept Take
                </button>
                <button
                  type="button"
                  onClick={handleReRecord}
                  className="flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg transition-transform active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" /> Re-record
                </button>
                <button
                  type="button"
                  onClick={handleDiscardTake}
                  className="flex items-center justify-center gap-2 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95"
                >
                  <X className="w-5 h-5" /> Discard
                </button>
              </div>
            </div>
          ) : (
            /* Ready to record action */
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={initiateCountdown}
                disabled={recordState !== 'idle'}
                className="w-full flex-1 flex items-center justify-center gap-3 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-lg rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-98"
              >
                <Camera className="w-6 h-6" />
                <span>
                  RECORD TAKE (Take #{totalRecordedForCurrentLabel + 1} of {targetReps})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUseMockStream(!useMockStream)}
                className="px-3.5 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl shrink-0"
                title="Toggle synthetic mock landmarks"
              >
                {useMockStream ? 'Use Real Camera' : 'Use Mock Camera'}
              </button>
            </div>
          )}
        </div>

        {/* Dedicated Negative Class Prompts Component */}
        <NoSignPrompts
          activePromptId={activeNegativePrompt}
          onSelectPrompt={handleSelectNegativePrompt}
          recordedCountsByPrompt={recordedCountsByNegativePrompt}
        />
      </div>

      {/* RIGHT COLUMN: Target Selector, Metadata Controls & Session Export */}
      <div className="lg:col-span-5 flex flex-col space-y-4">
        {/* Selected Vocabulary Phrase Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Vocabulary Sign
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-emerald-400">
                {totalRecordedForCurrentLabel} / {targetReps} reps
              </span>
            </div>
          </div>

          {/* Vocabulary Selector dropdown */}
          <select
            value={selectedLabelId}
            onChange={(e) => {
              onSelectLabelId(e.target.value);
              setActiveNegativePrompt(null);
            }}
            className="w-full bg-slate-950 border border-slate-700 text-white text-lg font-bold rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500"
          >
            {vocabulary.map((v) => (
              <option key={v.id} value={v.id}>
                {v.gloss} — {v.labels.en} ({v.category})
              </option>
            ))}
          </select>

          {/* Sign description & notes */}
          {selectedVocabItem && (
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Translations:</span>
                <span className="text-slate-200 font-medium">
                  हिन्दी: {selectedVocabItem.labels.hi} | मराठी: {selectedVocabItem.labels.mr}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Sign Characteristics:</span>
                <span className="text-slate-200">
                  {selectedVocabItem.two_handed ? 'Two-handed sign' : 'One-handed sign'}
                </span>
              </div>
              {selectedVocabItem.notes && (
                <div className="text-slate-300 italic pt-1 border-t border-slate-800">
                  Note: {selectedVocabItem.notes}
                </div>
              )}
            </div>
          )}

          {/* Repetition target selector */}
          <div className="flex items-center justify-between pt-1">
            <label className="text-xs text-slate-300 font-medium">Target Takes per Label:</label>
            <div className="flex gap-1.5">
              {[5, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onTargetRepsChange(num)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                    targetReps === num
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Take Metadata Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
            Environmental &amp; Participant Metadata
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Lighting */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Lighting Condition</label>
              <select
                value={metadata.lighting}
                onChange={(e) =>
                  setMetadata({ ...metadata, lighting: e.target.value as LightingCondition })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-medium"
              >
                <option value="bright_indoor">Bright Indoor</option>
                <option value="dim_indoor">Dim Indoor</option>
                <option value="backlit">Backlit</option>
                <option value="natural_window">Natural Window</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            {/* Distance Estimate */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Distance from Camera</label>
              <select
                value={metadata.distance_cm_estimate}
                onChange={(e) =>
                  setMetadata({ ...metadata, distance_cm_estimate: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-medium"
              >
                <option value={50}>50 cm (Close)</option>
                <option value={75}>75 cm</option>
                <option value={100}>100 cm (Kiosk Default)</option>
                <option value={125}>125 cm</option>
                <option value={150}>150 cm (Far)</option>
              </select>
            </div>

            {/* Background */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Background</label>
              <select
                value={metadata.background}
                onChange={(e) =>
                  setMetadata({ ...metadata, background: e.target.value as BackgroundType })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-medium"
              >
                <option value="plain">Plain Wall</option>
                <option value="cluttered">Cluttered Counter</option>
                <option value="moving_background">Moving Background</option>
              </select>
            </div>

            {/* Camera Height */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Camera Height</label>
              <select
                value={metadata.camera_height}
                onChange={(e) =>
                  setMetadata({ ...metadata, camera_height: e.target.value as CameraHeight })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-medium"
              >
                <option value="desk_level">Desk Level</option>
                <option value="chest_level">Chest Level</option>
                <option value="eye_level">Eye Level</option>
                <option value="high_angle">High Angle</option>
              </select>
            </div>

            {/* Dominant Hand */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Dominant Hand</label>
              <select
                value={metadata.handedness_dominant}
                onChange={(e) =>
                  setMetadata({ ...metadata, handedness_dominant: e.target.value as Handedness })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-medium"
              >
                <option value="right">Right-handed</option>
                <option value="left">Left-handed</option>
                <option value="ambidextrous">Ambidextrous</option>
              </select>
            </div>

            {/* Device */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Device Profile</label>
              <input
                type="text"
                value={metadata.device}
                onChange={(e) => setMetadata({ ...metadata, device: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-400 mb-1 text-xs font-medium">Take Notes / Variation</label>
            <input
              type="text"
              value={metadata.notes}
              onChange={(e) => setMetadata({ ...metadata, notes: e.target.value })}
              placeholder="e.g., Casual speed, wearing loose sleeves, slight angle"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs"
            />
          </div>
        </div>

        {/* Session Zip Export & Import Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Multi-Device Session Portability
          </h3>
          <p className="text-xs text-slate-400 leading-snug">
            Export all recorded landmark data from this browser into a single <code className="text-emerald-400">.zip</code> bundle, or merge data collected on other laptops.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onExportSession}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl border border-slate-700"
            >
              <Download className="w-4 h-4" /> Export (.zip)
            </button>

            <label className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer">
              <Upload className="w-4 h-4" /> Import (.zip)
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportSession(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
