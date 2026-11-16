import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Video,
  VideoOff,
  Play,
  Pause,
  Square,
  Info,
  Hand,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  classroomApi,
  extractErrorMessage,
  monitoringApi,
  settingsApi,
  studentApi,
} from '../services/api';
import type { Classroom, MonitoringSession, Student, TeacherSettings } from '../types';
import { analyzeVideoFrame, getFaceLandmarker, type FrameCvMetrics } from '../utils/cvMetrics';
import { ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { formatDateTime, formatDuration } from '../utils/exportUtils';

interface LivePoint {
  timeLabel: string;
  engagement: number;
  attention: number;
  presence: number;
  faces: number;
  quality: string;
}

export function LiveMonitoringPage() {
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get('classroomId') || '';

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [settings, setSettings] = useState<TeacherSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Setup state
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>(initialClassId);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [mode, setMode] = useState<'LIVE' | 'DEMO'>('LIVE');
  const [showMethodology, setShowMethodology] = useState(false);

  // Active session state
  const [activeSession, setActiveSession] = useState<MonitoringSession | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cameraStatus, setCameraStatus] = useState<string>('Idle — Waiting for teacher to start');
  const [cvModelStatus, setCvModelStatus] = useState<string>('Standby');
  const [liveMetrics, setLiveMetrics] = useState<FrameCvMetrics | null>(null);
  const [latestFinalScore, setLatestFinalScore] = useState<number | null>(null);
  const [presenceHistory, setPresenceHistory] = useState<number[]>([]);
  const [timeline, setTimeline] = useState<LivePoint[]>([]);
  const [pendingParticipation, setPendingParticipation] = useState<number | null>(null);
  const [participationNote, setParticipationNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSendTimeRef = useRef<number>(0);
  const latestMetricsRef = useRef<FrameCvMetrics | null>(null);
  const presenceHistoryRef = useRef<number[]>([]);
  const pendingParticipationRef = useRef<number | null>(null);

  useEffect(() => {
    pendingParticipationRef.current = pendingParticipation;
  }, [pendingParticipation]);

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const [cls, sts, sess, cfg] = await Promise.all([
        classroomApi.list(),
        studentApi.list(),
        monitoringApi.list(),
        settingsApi.get(),
      ]);
      setClassrooms(cls);
      setStudents(sts);
      setSessions(sess);
      setSettings(cfg);
      if (!selectedClassroomId && cls.length > 0) {
        setSelectedClassroomId(String(cls[0].id));
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load monitoring configuration.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    return () => {
      releaseCamera();
    };
  }, []);

  const releaseCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  };

  // Session Timer
  useEffect(() => {
    if (!activeSession || isPaused) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeSession, isPaused]);

  // Real-time MediaPipe CV loop + Backend Metric Ingestion
  useEffect(() => {
    if (!activeSession || isPaused) return;

    const samplingMs = (settings?.samplingInterval || 3) * 1000;

    if (mode === 'DEMO') {
      setCameraStatus('Simulated Demo Stream Active (No physical webcam)');
      setCvModelStatus('DEMO MODE Simulation');
      const simId = window.setInterval(async () => {
        const faces = Math.floor(Math.random() * 4) + 2;
        const presence = Math.round(82 + Math.random() * 16);
        const attention = Math.round(64 + Math.random() * 28);
        const simulated: FrameCvMetrics = {
          detectedFacesCount: faces,
          facePresenceScore: presence,
          attentionOrientationScore: attention,
          averageYawDeg: Math.round((Math.random() - 0.5) * 16),
          averagePitchDeg: Math.round((Math.random() - 0.5) * 10),
          eyeOpennessRatio: Math.round((0.24 + Math.random() * 0.08) * 100) / 100,
          averageLuminance: 145,
          dataQualityStatus: 'RELIABLE',
          landmarksList: [],
        };
        setLiveMetrics(simulated);
        try {
          const partScore = pendingParticipationRef.current;
          const saved = await monitoringApi.recordMetrics(activeSession.id, {
            studentId: selectedStudentId ? Number(selectedStudentId) : null,
            facePresenceScore: simulated.facePresenceScore,
            attentionOrientationScore: simulated.attentionOrientationScore,
            participationScore: partScore,
            detectedFacesCount: simulated.detectedFacesCount,
            dataQualityStatus: 'SIMULATED_DEMO',
          });
          if (partScore !== null) setPendingParticipation(null);
          setLatestFinalScore(saved.finalEngagementScore);
          setTimeline((prev) => [
            ...prev.slice(-24),
            {
              timeLabel: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
              engagement: saved.finalEngagementScore,
              attention: saved.attentionOrientationScore,
              presence: saved.facePresenceScore,
              faces: simulated.detectedFacesCount,
              quality: 'SIMULATED_DEMO',
            },
          ]);
        } catch {
          // Keep simulation running gracefully
        }
      }, samplingMs);
      return () => window.clearInterval(simId);
    }

    // LIVE WEBCAM + MEDIAPIPE LOOP
    let cancelled = false;

    const runLiveLoop = async () => {
      try {
        setCvModelStatus('Loading MediaPipe Face Landmarker...');
        const landmarker = await getFaceLandmarker();
        if (cancelled) return;
        setCvModelStatus('MediaPipe Face Landmarker Ready');

        if (!sampleCanvasRef.current) {
          sampleCanvasRef.current = document.createElement('canvas');
        }

        const tick = async () => {
          if (cancelled) return;
          const video = videoRef.current;
          const overlay = overlayCanvasRef.current;

          if (video && video.readyState >= 2) {
            const metrics = analyzeVideoFrame(landmarker, video, sampleCanvasRef.current!, performance.now());
            latestMetricsRef.current = metrics;
            setLiveMetrics(metrics);

            const nextHist = [...presenceHistoryRef.current.slice(-19), metrics.facePresenceScore];
            presenceHistoryRef.current = nextHist;
            setPresenceHistory(nextHist);

            // Draw facial landmark points on overlay canvas
            if (overlay) {
              if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
                overlay.width = video.videoWidth || 640;
                overlay.height = video.videoHeight || 480;
              }
              const ctx = overlay.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, overlay.width, overlay.height);
                ctx.fillStyle = '#6366F1';
                for (const face of metrics.landmarksList) {
                  for (let i = 0; i < face.length; i += 4) {
                    const lm = face[i];
                    ctx.beginPath();
                    ctx.arc(lm.x * overlay.width, lm.y * overlay.height, 1.4, 0, Math.PI * 2);
                    ctx.fill();
                  }
                }
              }
            }

            const nowMs = Date.now();
            if (nowMs - lastSendTimeRef.current >= samplingMs) {
              lastSendTimeRef.current = nowMs;
              const rollingPresence =
                nextHist.length > 0
                  ? Math.round(nextHist.reduce((a, b) => a + b, 0) / nextHist.length)
                  : metrics.facePresenceScore;
              const partScore = pendingParticipationRef.current;
              try {
                const saved = await monitoringApi.recordMetrics(activeSession.id, {
                  studentId: selectedStudentId ? Number(selectedStudentId) : null,
                  facePresenceScore: rollingPresence,
                  attentionOrientationScore: metrics.attentionOrientationScore,
                  participationScore: partScore,
                  detectedFacesCount: metrics.detectedFacesCount,
                  dataQualityStatus: metrics.dataQualityStatus,
                });
                if (partScore !== null) setPendingParticipation(null);
                setLatestFinalScore(saved.finalEngagementScore);
                setTimeline((prev) => [
                  ...prev.slice(-24),
                  {
                    timeLabel: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
                    engagement: saved.finalEngagementScore,
                    attention: saved.attentionOrientationScore,
                    presence: saved.facePresenceScore,
                    faces: metrics.detectedFacesCount,
                    quality: metrics.dataQualityStatus,
                  },
                ]);
              } catch {
                // Ignore transient network hiccup during loop
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        setCvModelStatus('MediaPipe initialization unavailable');
        setError(
          'Could not initialize browser MediaPipe Face Landmarker model. Check network access for model download or switch to DEMO MODE.'
        );
      }
    };

    runLiveLoop();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [activeSession, isPaused, mode, settings, selectedStudentId]);

  const handleStartMonitoring = async () => {
    setError('');
    if (!selectedClassroomId) {
      setError('Please select a classroom before starting monitoring.');
      return;
    }
    const titleToUse =
      sessionTitle.trim() ||
      `${classrooms.find((c) => c.id === Number(selectedClassroomId))?.subject || 'Class'} Session`;

    setActionBusy(true);
    try {
      if (mode === 'LIVE') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Webcam API (MediaDevices) is not supported in this browser.');
        }
        setCameraStatus('Requesting webcam permission...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;

        // Handle unexpected webcam disconnection
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            setCameraStatus('Webcam disconnected unexpectedly');
            setError('Webcam disconnected during session. Please reconnect camera or stop the session.');
            setIsPaused(true);
          };
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraStatus('Camera Active · Extracting Facial Landmarks Locally');
      }

      const started = await monitoringApi.start({
        classroomId: Number(selectedClassroomId),
        sessionTitle: titleToUse,
        mode,
      });

      setActiveSession(started);
      setIsPaused(false);
      setElapsedSeconds(0);
      setTimeline([]);
      setLatestFinalScore(null);
      presenceHistoryRef.current = [];
      setPresenceHistory([]);
      lastSendTimeRef.current = 0;
    } catch (err) {
      releaseCamera();
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setCameraStatus('Permission Denied');
        setError('Webcam permission was denied. Grant camera permission in browser settings or use Simulated Demo Mode.');
      } else if (err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
        setCameraStatus('No Webcam Detected');
        setError('No webcam hardware detected. Connect a camera or switch to Simulated Demo Mode.');
      } else {
        setCameraStatus('Camera Unavailable');
        setError(extractErrorMessage(err, 'Unable to start monitoring session.'));
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handlePauseResume = async () => {
    if (!activeSession) return;
    setActionBusy(true);
    try {
      if (isPaused) {
        const res = await monitoringApi.resume(activeSession.id);
        setActiveSession(res);
        setIsPaused(false);
      } else {
        const res = await monitoringApi.pause(activeSession.id);
        setActiveSession(res);
        setIsPaused(true);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not update session state.'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleStopSession = async () => {
    if (!activeSession) return;
    setActionBusy(true);
    try {
      await monitoringApi.stop(activeSession.id, elapsedSeconds);
      releaseCamera();
      setActiveSession(null);
      setIsPaused(false);
      setCameraStatus('Idle — Session saved to database');
      setCvModelStatus('Standby');
      setLiveMetrics(null);
      setSessions(await monitoringApi.list());
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not stop session cleanly.'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleRecordParticipation = async (eventType: string, scoreValue: number) => {
    if (!activeSession) return;
    try {
      await monitoringApi.recordParticipation(activeSession.id, {
        studentId: selectedStudentId ? Number(selectedStudentId) : null,
        eventType,
        scoreValue,
      });
      setPendingParticipation(scoreValue);
      setParticipationNote(`Recorded "${eventType}" (${scoreValue}%) for next scoring interval.`);
      window.setTimeout(() => setParticipationNote(''), 4000);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not record participation event.'));
    }
  };

  const handleDeleteSession = async (id: number) => {
    try {
      await monitoringApi.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not delete session record.'));
    }
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  const classroomStudents = students.filter((s) => s.classroomId === Number(selectedClassroomId));
  const avgPresenceDisplay =
    presenceHistory.length > 0
      ? Math.round(presenceHistory.reduce((a, b) => a + b, 0) / presenceHistory.length)
      : liveMetrics?.facePresenceScore ?? null;

  const isInsufficient =
    liveMetrics?.dataQualityStatus === 'INSUFFICIENT_VISUAL_DATA' ||
    liveMetrics?.dataQualityStatus === 'POOR_LIGHTING';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Live Classroom Monitoring</h1>
          <p className="mt-1 text-sm text-slate-600">
            Browser-based MediaPipe facial landmark analysis sending aggregated numerical indicators only.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowMethodology((prev) => !prev)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <Info className="w-4 h-4 text-indigo-600" />
          <span>{showMethodology ? 'Hide Scoring Formula' : 'Scoring Methodology & Limits'}</span>
        </button>
      </div>

      {showMethodology && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 text-xs text-slate-600 space-y-2">
          <div className="font-semibold text-sm text-slate-900">Transparent Engagement Scoring & Privacy Scope</div>
          <p>
            <strong>Formula:</strong> Engagement Score = ({settings?.attentionWeight ?? 50}% Attention Orientation) + (
            {settings?.presenceWeight ?? 30}% Face Presence) + ({settings?.participationWeight ?? 20}% Participation).
            When no teacher-recorded participation event is present (or participation is disabled), weights are automatically{' '}
            <strong>renormalized</strong> across Attention Orientation and Face Presence.
          </p>
          <p>
            <strong>Prototype Thresholds:</strong> {settings?.highThreshold ?? 75}–100 High ·{' '}
            {settings?.moderateThreshold ?? 50}–{(settings?.highThreshold ?? 75) - 1} Moderate · Below{' '}
            {settings?.moderateThreshold ?? 50} Low. These are prototype thresholds for teacher review, not validated psychological metrics.
          </p>
          <p>
            <strong>Privacy Guarantee:</strong> Raw video stays strictly inside your browser. No facial recognition, identity matching, or emotion inference is performed.
          </p>
        </div>
      )}

      {mode === 'DEMO' && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900">
          <div>
            <strong className="font-semibold">DEMO MODE ACTIVE:</strong> Metrics generated in this mode are simulated demonstration values and are labelled <code className="font-mono">SIMULATED_DEMO</code> in stored records.
          </div>
        </div>
      )}

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* Session Configuration & Webcam Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Webcam / Video Preview */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium text-slate-600">
              {cameraStatus} · {cvModelStatus}
            </div>
            <div className="font-mono-tabular text-sm font-semibold text-slate-900">
              Timer: {formatDuration(elapsedSeconds)}
            </div>
          </div>

          <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${activeSession && mode === 'LIVE' ? 'block' : 'hidden'}`}
            />
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${activeSession && mode === 'LIVE' ? 'block' : 'hidden'}`}
            />

            {!activeSession && (
              <div className="text-center px-6 py-8 max-w-md">
                <VideoOff className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <div className="text-sm font-medium text-white">Camera is inactive</div>
                <p className="mt-1 text-xs text-slate-300">
                  Webcam access is only requested after you select a classroom and click Start Monitoring.
                </p>
              </div>
            )}

            {activeSession && mode === 'DEMO' && (
              <div className="text-center px-6 py-8 max-w-md">
                <Video className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <div className="text-sm font-semibold text-amber-300">DEMO MODE · SIMULATED STREAM</div>
                <p className="mt-1 text-xs text-slate-300">
                  Simulating classroom indicators every {settings?.samplingInterval ?? 3}s for {activeSession.classroomName}.
                </p>
              </div>
            )}

            {activeSession && isPaused && (
              <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                <span className="px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-semibold">
                  Monitoring Paused
                </span>
              </div>
            )}
          </div>

          {activeSession && isInsufficient && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {liveMetrics?.dataQualityStatus === 'POOR_LIGHTING'
                  ? `Poor lighting detected (luminance ${liveMetrics.averageLuminance}/255). Insufficient visual data for reliable attention estimation.`
                  : 'Insufficient visual data: No face detected in the current camera frame.'}
              </span>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {!activeSession ? (
              <button
                type="button"
                onClick={handleStartMonitoring}
                disabled={actionBusy || classrooms.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>Start Monitoring</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePauseResume}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  <span>{isPaused ? 'Resume Monitoring' : 'Pause Monitoring'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleStopSession}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop Session</span>
                </button>
              </div>
            )}

            {activeSession && (
              <div className="text-xs text-slate-500 truncate">
                {activeSession.classroomName} · {activeSession.sessionTitle}
              </div>
            )}
          </div>
        </div>

        {/* Right: Session Setup + Live Metrics + Teacher Participation Controls */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Session Controls & Mode</h2>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                disabled={Boolean(activeSession)}
                onClick={() => setMode('LIVE')}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                  mode === 'LIVE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Webcam (MediaPipe CV)
              </button>
              <button
                type="button"
                disabled={Boolean(activeSession)}
                onClick={() => setMode('DEMO')}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                  mode === 'DEMO' ? 'bg-amber-100 text-amber-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                DEMO MODE (Simulated)
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Classroom</label>
              <select
                value={selectedClassroomId}
                disabled={Boolean(activeSession)}
                onChange={(e) => {
                  setSelectedClassroomId(e.target.value);
                  setSelectedStudentId('');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
              >
                <option value="">Select a classroom</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.classroomName} ({c.section})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Session Title</label>
              <input
                type="text"
                value={sessionTitle}
                disabled={Boolean(activeSession)}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="e.g., Lecture 12 — Binary Search Trees"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Monitoring Target (Optional Student Station)
              </label>
              <select
                value={selectedStudentId}
                disabled={Boolean(activeSession)}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
              >
                <option value="">Classroom-Wide Aggregate (No individual biometric ID)</option>
                {classroomStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    Station: {st.studentName} ({st.rollNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Numeric Indicators */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Classroom Engagement</div>
              <div className="mt-1 text-xl font-bold text-indigo-700 font-mono-tabular">
                {latestFinalScore !== null ? `${latestFinalScore}%` : '—'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Faces Detected</div>
              <div className="mt-1 text-xl font-bold text-slate-900 font-mono-tabular">
                {liveMetrics ? liveMetrics.detectedFacesCount : '—'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Face Presence</div>
              <div className="mt-1 text-lg font-semibold text-slate-900 font-mono-tabular">
                {avgPresenceDisplay !== null ? `${avgPresenceDisplay}%` : '—'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Attention Orientation</div>
              <div className="mt-1 text-lg font-semibold text-slate-900 font-mono-tabular">
                {liveMetrics ? `${liveMetrics.attentionOrientationScore}%` : '—'}
              </div>
            </div>
          </div>

          {liveMetrics && (
            <div className="text-xs text-slate-500 font-mono-tabular flex flex-wrap gap-x-4 gap-y-1">
              <span>Yaw: {liveMetrics.averageYawDeg}°</span>
              <span>Pitch: {liveMetrics.averagePitchDeg}°</span>
              <span>Eye Openness: {liveMetrics.eyeOpennessRatio}</span>
              <span>Quality: {liveMetrics.dataQualityStatus}</span>
            </div>
          )}

          {/* Teacher Participation Event Recorder */}
          {activeSession && (
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Hand className="w-3.5 h-3.5 text-indigo-600" />
                <span>Log Observed Participation Event</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleRecordParticipation('QUESTION_ANSWERED', 90)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100"
                >
                  Question Answered (90%)
                </button>
                <button
                  type="button"
                  onClick={() => handleRecordParticipation('GROUP_DISCUSSION', 80)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200"
                >
                  Discussion (80%)
                </button>
              </div>
              {participationNote && <div className="text-xs text-emerald-700">{participationNote}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Live Trend Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900">Real-Time Session Engagement Trend</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">
          Live sampling points persisted to backend every {settings?.samplingInterval ?? 3} seconds.
        </p>
        {timeline.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-slate-500">
            Start a monitoring session to stream real-time attention and presence indicators.
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="engagement" name="Final Engagement" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="attention" name="Attention Orientation" stroke="#0284C7" strokeWidth={1.6} />
                <Line type="monotone" dataKey="presence" name="Face Presence" stroke="#16A34A" strokeWidth={1.6} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Saved Session Records with Delete Capability */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Stored Monitoring Sessions</h2>
        </div>
        {sessions.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No monitoring sessions recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Session Title</th>
                  <th className="py-3 px-4">Classroom</th>
                  <th className="py-3 px-4">Start Time</th>
                  <th className="py-3 px-4 text-right">Duration</th>
                  <th className="py-3 px-4 text-right">Avg Engagement</th>
                  <th className="py-3 px-4">Mode & Status</th>
                  <th className="py-3 px-6 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-6 font-medium text-slate-900">{s.sessionTitle}</td>
                    <td className="py-3 px-4 text-slate-600">{s.classroomName}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{formatDateTime(s.startTime)}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">{formatDuration(s.duration)}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900">{s.averageEngagement}%</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {s.mode} · {s.status}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                        aria-label={`Delete ${s.sessionTitle}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
