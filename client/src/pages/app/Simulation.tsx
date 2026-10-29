import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, FileText, X, Check, AlertCircle, Download,
  StopCircle, Play, Pause, Square, RefreshCw, Calendar, Zap, AlertTriangle,
  Clock, Thermometer, Info, ChevronRight, BarChart3,
  Sliders, ShieldCheck, CheckCircle2, History, RotateCcw,
  Radio, FastForward, Activity, Users, Flame
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { PillSwitcher } from '../../components/ui/PillSwitcher';
import { NumberField } from '../../components/inputs/NumberField';
import { ChartTooltip } from '../../components/charts/ChartTooltip';

import { useSimulationStore } from '../../store/simulation';
import { useCreateSimulation, useSimulation, useSimulationHistory, useSettings } from '../../hooks/queries';
import { apiClient } from '../../api/client';
import { validateReadingsCsv, validateScheduleCsv, generateSampleReadingsCsv, generateSampleScheduleCsv } from '../../lib/csv';
import type { CsvValidationResult } from '../../lib/csv';
import type {
  HallSimulationMetrics,
  SimulationAnomalyEvent,
  SimulationRecommendation,
  ReplaySpeed,
  ReplayTickData,
  ReplayHallState
} from '../../types/simulation';

// --- Motion Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } }
};

// --- Helper Subcomponents ---

function FileDropzone({
  label,
  sublabel,
  onDrop,
  onDownloadSample,
  accept = ".csv"
}: {
  label: string;
  sublabel: string;
  onDrop: (f: File) => void;
  onDownloadSample: () => void;
  accept?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onDrop(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-inner p-5 flex flex-col items-center justify-center text-center transition-all ${
        isDragging ? 'border-accent bg-accent-soft/20 scale-[0.99]' : 'border-line bg-page/40 hover:bg-page hover:border-line-hover'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={accept}
        onChange={(e) => e.target.files && onDrop(e.target.files[0])}
      />
      <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center text-accent mb-2">
        <UploadCloud size={20} />
      </div>
      <p className="text-sm font-semibold text-ink mb-0.5">{label}</p>
      <p className="text-xs text-ink-3 mb-3 max-w-[220px]">{sublabel}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs h-8">
          Browse CSV
        </Button>
        <button
          type="button"
          onClick={onDownloadSample}
          className="text-xs text-accent hover:underline font-medium px-2 py-1"
        >
          Sample
        </button>
      </div>
    </div>
  );
}

function ValidationDetailsCard({
  title,
  file,
  validation,
  type,
  onRemove
}: {
  title: string;
  file: File;
  validation: CsvValidationResult<any>;
  type: 'readings' | 'schedule';
  onRemove: () => void;
}) {
  const meta = validation.metadata;

  return (
    <div className="bg-page/50 rounded-inner p-4 border border-line h-full flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-card rounded flex items-center justify-center border border-line shadow-sm text-accent">
              <FileText size={18} />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-3 uppercase tracking-wider">{title}</div>
              <div className="text-sm font-medium text-ink truncate max-w-[190px]">{file.name}</div>
              <div className="text-xs text-ink-3">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
          <button
            onClick={onRemove}
            className="text-ink-3 hover:text-rose transition-colors p-1 rounded hover:bg-page"
            title="Remove and replace file"
          >
            <X size={16} />
          </button>
        </div>

        {/* Validation Badge & Metrics */}
        {validation.valid ? (
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-mint font-medium bg-mint/10 border border-mint/20 px-2 py-1 rounded">
              <Check size={14} className="shrink-0" />
              <span>Valid schema ({validation.data.length.toLocaleString()} rows)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-ink-2 bg-card p-2.5 rounded border border-line">
              {type === 'readings' ? (
                <>
                  <div>
                    <span className="text-ink-3 block">Halls:</span>
                    <span className="font-semibold text-ink">{meta.hallCount || 5} halls</span>
                  </div>
                  <div>
                    <span className="text-ink-3 block">Timeline:</span>
                    <span className="font-semibold text-ink">{meta.durationDays || 7.0} days</span>
                  </div>
                  <div className="col-span-2 text-[11px] text-ink-3 border-t border-line/50 pt-1 mt-1 truncate">
                    Range: {meta.dateRange || 'Nov 01 - Nov 07, 2026'}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-ink-3 block">Halls:</span>
                    <span className="font-semibold text-ink">{meta.unitCount || 5} covered</span>
                  </div>
                  <div>
                    <span className="text-ink-3 block">Sessions:</span>
                    <span className="font-semibold text-ink">{meta.scheduledSessions || 0} scheduled</span>
                  </div>
                  <div className="col-span-2 text-[11px] text-ink-3 border-t border-line/50 pt-1 mt-1 truncate">
                    Forward: {meta.dateRange || 'Nov 08 - Nov 14, 2026'}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-rose/5 border border-rose/20 p-2.5 rounded text-xs text-rose space-y-1 mb-3">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle size={14} /> Validation Failed
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              {validation.errors.slice(0, 2).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="text-[11px] text-amber bg-amber/5 border border-amber/20 p-2 rounded flex items-start gap-1.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber" />
            <span>{validation.warnings[0]}</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-line flex justify-between items-center text-[11px] text-ink-3">
        <span>Ready for analysis</span>
        <button onClick={onRemove} className="text-accent hover:underline">Change</button>
      </div>
    </div>
  );
}

// --- Main Simulation Component ---

export default function Simulation() {
  const { data: settings } = useSettings();
  const createSimulation = useCreateSimulation();
  const { data: history } = useSimulationHistory();

  const draft = useSimulationStore();

  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    return localStorage.getItem('minsaar_active_sim_id') || null;
  });
  const { data: activeJob, isLoading: isJobLoading } = useSimulation(activeJobId);

  const [readingsValidation, setReadingsValidation] = useState<CsvValidationResult<any> | null>(null);
  const [scheduleValidation, setScheduleValidation] = useState<CsvValidationResult<any> | null>(null);

  const [readingsContent, setReadingsContent] = useState<string>('');
  const [scheduleContent, setScheduleContent] = useState<string>('');

  // Selected hall filter for detail view and charts
  const [selectedHallFilter, setSelectedHallFilter] = useState<string>('ALL');
  // Anomaly filter state
  const [anomalyFilterCat, setAnomalyFilterCat] = useState<string>('ALL');
  const [anomalyFilterSev, setAnomalyFilterSev] = useState<string>('ALL');

  // Sorting state for hall table
  const [sortField, setSortField] = useState<'consumption' | 'anomalies' | 'savings'>('savings');
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Replay live state
  const [liveTick, setLiveTick] = useState<ReplayTickData | null>(null);
  const [replayStatus, setReplayStatus] = useState<'idle' | 'running' | 'paused' | 'stopped' | 'done'>('idle');
  const [liveChartPoints, setLiveChartPoints] = useState<Array<{
    timestamp: string;
    timeLabel: string;
    actualKwh: number;
    predictedKwh: number;
    wastedKwh: number;
  }>>([]);
  const [liveAnomalies, setLiveAnomalies] = useState<SimulationAnomalyEvent[]>([]);
  const [liveRecommendations, setLiveRecommendations] = useState<SimulationRecommendation[]>([]);
  const [timelineScrubValue, setTimelineScrubValue] = useState<number | null>(null);

  // Sync settings tariff if default
  useEffect(() => {
    if (settings?.tariffInrPerKwh !== undefined) {
      if (draft.tariff === 8.0 && settings.tariffInrPerKwh !== 8.0) {
        draft.setDraft({ tariff: settings.tariffInrPerKwh });
      }
    }
  }, [settings?.tariffInrPerKwh, draft.tariff, draft.setDraft]);

  // Persist active job id
  useEffect(() => {
    if (activeJobId) {
      localStorage.setItem('minsaar_active_sim_id', activeJobId);
    }
  }, [activeJobId]);

  // Sync active job replay state if recovered
  useEffect(() => {
    if (activeJob) {
      const replayState = (activeJob as any).replayState;
      if (replayState) {
        draft.setDraft({ mode: 'replay', replaySpeed: replayState.speed || draft.replaySpeed });
        setReplayStatus(replayState.status);
      } else if (activeJob.config?.mode === 'replay') {
        draft.setDraft({ mode: 'replay', replaySpeed: activeJob.config.speed || draft.replaySpeed });
        setReplayStatus(activeJob.status as any);
      }
    }
  }, [activeJob]);

  // SSE stream connection for replay ticks and status events
  useEffect(() => {
    if (!activeJobId) return;

    const es = new EventSource('/api/stream');

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'simulation_replay_tick' && payload.data?.jobId === activeJobId) {
          const tick: ReplayTickData = payload.data;
          setLiveTick(tick);
          setReplayStatus(tick.status);

          if (tick.chartPoint) {
            setLiveChartPoints((prev) => {
              const updated = [...prev, tick.chartPoint!];
              return updated.length > 150 ? updated.slice(-150) : updated;
            });
          }

          if (tick.latestAnomalies && tick.latestAnomalies.length > 0) {
            setLiveAnomalies((prev) => {
              const existingIds = new Set(prev.map((a) => a.id));
              const newItems = tick.latestAnomalies!.filter((a) => !existingIds.has(a.id));
              return [...newItems, ...prev].slice(0, 50);
            });
          }

          if (tick.latestRecommendations && tick.latestRecommendations.length > 0) {
            setLiveRecommendations((prev) => {
              const existingIds = new Set(prev.map((r) => r.id));
              const newItems = tick.latestRecommendations!.filter((r) => !existingIds.has(r.id));
              return [...newItems, ...prev].slice(0, 50);
            });
          }
        } else if (payload.type === 'simulation_replay_status' && payload.data?.jobId === activeJobId) {
          if (payload.data.status) {
            setReplayStatus(payload.data.status);
          }
        } else if (payload.type === 'simulation_complete' && payload.data?.jobId === activeJobId) {
          setReplayStatus('done');
        }
      } catch {
        // Heartbeats or comments
      }
    };

    return () => {
      es.close();
    };
  }, [activeJobId]);

  // Handlers
  const handleReadingsDrop = async (file: File) => {
    const text = await file.text();
    setReadingsContent(text);
    const val = validateReadingsCsv(text);
    setReadingsValidation(val);
    draft.setDraft({ readingsFile: file });
  };

  const handleScheduleDrop = async (file: File) => {
    const text = await file.text();
    setScheduleContent(text);
    const readingUnits = new Set<string>(readingsValidation?.metadata?.units || []);
    const val = validateScheduleCsv(text, readingUnits);
    setScheduleValidation(val);
    draft.setDraft({ scheduleFile: file });
  };

  const handleRemoveReadings = () => {
    draft.setDraft({ readingsFile: null });
    setReadingsValidation(null);
    setReadingsContent('');
  };

  const handleRemoveSchedule = () => {
    draft.setDraft({ scheduleFile: null });
    setScheduleValidation(null);
    setScheduleContent('');
  };

  const handleSimulate = () => {
    if (!readingsValidation?.valid || !scheduleValidation?.valid) return;

    createSimulation.mutate(
      {
        readingsContent,
        scheduleContent,
        config: {
          intervalHours: draft.intervalHours,
          tariffInrPerKwh: draft.tariff,
          selectedHall: draft.selectedHall,
          optimizationPolicy: draft.optimizationPolicy,
          mode: draft.mode,
          speed: draft.replaySpeed,
          presentationIntervalMs: 200,
        },
      },
      {
        onSuccess: (res) => {
          setActiveJobId(res.id);
          if (draft.mode === 'replay') {
            setReplayStatus('running');
            setLiveChartPoints([]);
            setLiveAnomalies([]);
            setLiveRecommendations([]);
            setLiveTick(null);
          }
        },
      }
    );
  };

  const handlePause = async () => {
    if (!activeJobId) return;
    try {
      await apiClient.pauseReplay(activeJobId);
      setReplayStatus('paused');
    } catch (e) {
      console.error('Pause error', e);
    }
  };

  const handleResume = async () => {
    if (!activeJobId) return;
    try {
      await apiClient.resumeReplay(activeJobId);
      setReplayStatus('running');
    } catch (e) {
      console.error('Resume error', e);
    }
  };

  const handleStop = async () => {
    if (!activeJobId) return;
    try {
      await apiClient.stopReplay(activeJobId);
      setReplayStatus('stopped');
    } catch (e) {
      console.error('Stop error', e);
    }
  };

  const handleRestart = async () => {
    if (!activeJobId) return;
    try {
      await apiClient.restartReplay(activeJobId);
      setLiveChartPoints([]);
      setLiveAnomalies([]);
      setLiveRecommendations([]);
      setReplayStatus('running');
    } catch (e) {
      console.error('Restart error', e);
    }
  };

  const handleSpeedChange = async (newSpeed: ReplaySpeed) => {
    draft.setDraft({ replaySpeed: newSpeed });
    if (activeJobId && (replayStatus === 'running' || replayStatus === 'paused')) {
      try {
        await apiClient.setReplaySpeed(activeJobId, newSpeed);
      } catch (e) {
        console.error('Speed change error', e);
      }
    }
  };

  const handleTimelineScrub = async (minuteIndex: number) => {
    setTimelineScrubValue(null);
    if (!activeJobId) return;
    try {
      await apiClient.seekReplay(activeJobId, minuteIndex);
    } catch (e) {
      console.error('Seek error', e);
    }
  };

  const handleExportCsv = () => {
    if (!activeJob?.steps) return;
    const headers = ['Step', 'Start', 'End', 'Actual (kWh)', 'Predicted (kWh)', 'Wasted (kWh)', 'Anomalies', 'Outside Schedule'];
    const rows = activeJob.steps.map((s) => [
      s.stepIndex,
      s.windowStart,
      s.windowEnd,
      s.actualKwh,
      s.predictedKwh,
      s.wastedKwhEst,
      s.anomalies.length,
      s.outsideScheduleHours ? 'Yes' : 'No',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `minsaar_optimization_results_${activeJob.id}.csv`;
    a.click();
  };

  // State flags
  const isReady = !!(readingsValidation?.valid && scheduleValidation?.valid);
  const isRunning = activeJob && (activeJob.status === 'running' || activeJob.status === 'queued');
  const isDone = activeJob && activeJob.status === 'done';
  const isFailed = activeJob && activeJob.status === 'failed';

  // Available halls from activeJob summary or validation
  const availableHalls = useMemo(() => {
    if (activeJob?.summary?.halls && activeJob.summary.halls.length > 0) {
      return activeJob.summary.halls;
    }
    return [];
  }, [activeJob]);

  // Filtered steps for the forecast chart based on selected hall
  const chartSteps = useMemo(() => {
    if (!activeJob?.steps) return [];
    if (selectedHallFilter === 'ALL') {
      return activeJob.steps.map((s) => ({
        stepIndex: s.stepIndex,
        time: s.windowStart.split(' ')[1] || s.windowStart,
        fullTime: s.windowStart,
        actualKwh: s.actualKwh,
        predictedKwh: s.predictedKwh,
        wastedKwh: s.wastedKwhEst,
      }));
    }
    return activeJob.steps.map((s) => {
      const hallData = s.byHall && s.byHall[selectedHallFilter];
      return {
        stepIndex: s.stepIndex,
        time: s.windowStart.split(' ')[1] || s.windowStart,
        fullTime: s.windowStart,
        actualKwh: hallData ? hallData.actualKwh : s.actualKwh,
        predictedKwh: hallData ? hallData.predictedKwh : s.predictedKwh,
        wastedKwh: hallData ? hallData.wastedKwhEst : s.wastedKwhEst,
      };
    });
  }, [activeJob, selectedHallFilter]);

  // Filtered anomalies list
  const filteredAnomalies = useMemo(() => {
    const list = activeJob?.summary?.anomaliesList || [];
    return list.filter((a: SimulationAnomalyEvent) => {
      if (selectedHallFilter !== 'ALL' && a.hallId !== selectedHallFilter) return false;
      if (anomalyFilterCat !== 'ALL' && a.category !== anomalyFilterCat) return false;
      if (anomalyFilterSev !== 'ALL' && a.severity !== anomalyFilterSev) return false;
      return true;
    });
  }, [activeJob, selectedHallFilter, anomalyFilterCat, anomalyFilterSev]);

  // Filtered recommendations list
  const filteredRecommendations = useMemo(() => {
    const list = activeJob?.summary?.recommendationsList || [];
    if (selectedHallFilter === 'ALL') return list;
    return list.filter((r: SimulationRecommendation) => r.hallId === selectedHallFilter);
  }, [activeJob, selectedHallFilter]);

  // Sorted hall metrics
  const sortedHalls = useMemo(() => {
    const halls = [...availableHalls];
    if (sortField === 'consumption') {
      return halls.sort((a, b) => b.totalActualKwh - a.totalActualKwh);
    }
    if (sortField === 'anomalies') {
      return halls.sort((a, b) => b.totalAnomalies - a.totalAnomalies);
    }
    return halls.sort((a, b) => b.savingsInrEst - a.savingsInrEst);
  }, [availableHalls, sortField]);

  // Current selected hall metrics
  const currentHallMetric = useMemo(() => {
    if (selectedHallFilter === 'ALL') return null;
    return availableHalls.find((h) => h.hallId === selectedHallFilter) || null;
  }, [availableHalls, selectedHallFilter]);

  const formatWallClock = (ms: number = 0) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const currentReplayHall = useMemo(() => {
    if (!liveTick?.halls) return null;
    if (selectedHallFilter === 'ALL') {
      const hallsList = Object.values(liveTick.halls);
      const avgIndoor = hallsList.length > 0 ? (hallsList.reduce((acc, h) => acc + h.indoorTempC, 0) / hallsList.length).toFixed(1) : '24.0';
      const outdoor = hallsList[0]?.outdoorTempC ?? 28.0;
      const totalOcc = hallsList.reduce((acc, h) => acc + h.occupancy, 0);
      const activeUnits = hallsList.filter((h) => h.acOn).length;
      const totalKw = hallsList.reduce((acc, h) => acc + h.powerKw, 0);
      return {
        hallId: 'ALL',
        hallName: 'Campus Aggregate (All 5 Halls)',
        indoorTempC: Number(avgIndoor),
        outdoorTempC: outdoor,
        occupancy: totalOcc,
        acOn: activeUnits > 0,
        setpointC: 24,
        powerKw: Number(totalKw.toFixed(2)),
        totalEnergyKwh: liveTick.aggregate.totalEnergyKwh,
        wastedKwh: liveTick.aggregate.wastedEnergyKwh,
        savingsInr: liveTick.aggregate.savingsInrEst,
        activeUnitsCount: activeUnits,
        totalUnitsCount: hallsList.length,
        coolingEffectivenessPct: 94,
      };
    }
    return liveTick.halls[selectedHallFilter] || null;
  }, [liveTick, selectedHallFilter]);

  // Status Badge Rendering
  const renderStatusBadge = () => {
    if (isRunning) {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20 animate-pulse">
          <RefreshCw size={12} className="animate-spin" />
          <span>Running Simulation</span>
        </div>
      );
    }
    if (isDone) {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-mint/10 text-mint border border-mint/20">
          <CheckCircle2 size={12} />
          <span>Completed</span>
        </div>
      );
    }
    if (isFailed) {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose/10 text-rose border border-rose/20">
          <AlertCircle size={12} />
          <span>Simulation Failed</span>
        </div>
      );
    }
    if (isReady) {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-mint/10 text-mint border border-mint/20">
          <Check size={12} />
          <span>Inputs Ready</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-ink-3/10 text-ink-3 border border-line">
        <Clock size={12} />
        <span>Awaiting CSV Uploads</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 flex flex-col h-full overflow-x-hidden pb-16">
      {/* ======================================================== */}
      {/* SECTION A — Page Header & Global Actions                */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-ink">Simulation & AC Optimization</h1>
            {draft.mode === 'replay' ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber/15 text-amber border border-amber/30 shadow-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber animate-ping" />
                <span>SIMULATED LIVE DATA</span>
              </div>
            ) : (
              renderStatusBadge()
            )}
          </div>
          <p className="text-sm text-ink-2 mt-1 max-w-3xl">
            {draft.mode === 'replay'
              ? 'Accelerated real-time live playback of historical campus telemetry with continuous ML anomaly inference and rule recommendations.'
              : 'Replay historical hall telemetry to evaluate energy forecasts, detect abnormal consumption, and simulate energy-saving AC control strategies.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {activeJob && (
            <span className="text-xs text-ink-3 hidden lg:inline">
              ID: <span className="font-mono text-ink-2">{activeJob.id.substring(0, 8)}...</span>
            </span>
          )}

          {history && history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistoryModal(!showHistoryModal)}
              className="gap-1.5 text-xs h-9"
            >
              <History size={14} />
              <span>Past Runs ({history.length})</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            className="gap-2 text-sm shadow-md disabled:opacity-40 h-9"
            disabled={!isReady || createSimulation.isPending || (draft.mode === 'batch' && !!isRunning)}
            onClick={handleSimulate}
          >
            {draft.mode === 'replay' ? (
              replayStatus === 'running' ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Replaying...
                </>
              ) : (
                <>
                  <Play size={14} /> Start Live Replay
                </>
              )
            ) : isRunning ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Simulating...
              </>
            ) : isDone ? (
              <>
                <RotateCcw size={14} /> Run Simulation
              </>
            ) : (
              <>
                <Play size={14} /> Run Simulation
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Mode Switcher Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-line rounded-inner p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-page border border-line rounded-lg p-1">
            <button
              type="button"
              onClick={() => draft.setDraft({ mode: 'batch' })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                draft.mode === 'batch'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              <BarChart3 size={14} />
              <span>Batch Analysis</span>
            </button>
            <button
              type="button"
              onClick={() => draft.setDraft({ mode: 'replay' })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                draft.mode === 'replay'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              <Radio size={14} className={draft.mode === 'replay' ? 'animate-pulse' : ''} />
              <span>Live Replay</span>
            </button>
          </div>
          <span className="text-xs text-ink-3 hidden sm:inline">
            {draft.mode === 'replay'
              ? 'Stream authentic CSV records chronologically with accelerated speeds and real-time dashboard updates.'
              : 'Process complete historical dataset and produce executive summary metrics and breakdown.'}
          </span>
        </div>

        {draft.mode === 'replay' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-3 font-mono">Speed: {draft.replaySpeed}</span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-mint/10 text-mint border border-mint/20">
              <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
              <span>Chronological Streaming</span>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECTION B & C — Uploads & Simulation Configuration      */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SECTION B: Two distinct upload panels */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink uppercase tracking-wider flex items-center gap-2">
              <UploadCloud size={16} className="text-accent" />
              <span>1. Data Upload & Validation</span>
            </h2>
            <span className="text-xs text-ink-3">Upload both files to enable simulation</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Readings Upload Panel */}
            <Card className="h-64 flex flex-col p-4 border border-line">
              <AnimatePresence mode="wait">
                {draft.readingsFile && readingsValidation ? (
                  <motion.div key="summary-readings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <ValidationDetailsCard
                      title="Telemetry Readings"
                      file={draft.readingsFile}
                      validation={readingsValidation}
                      type="readings"
                      onRemove={handleRemoveReadings}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="dropzone-readings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <FileDropzone
                      label="Energy Readings Telemetry"
                      sublabel="Minute-level whole-hall & AC power telemetry (synthetic_demo.csv)"
                      onDrop={handleReadingsDrop}
                      onDownloadSample={() => {
                        const blob = new Blob([generateSampleReadingsCsv()], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'sample_readings.csv';
                        a.click();
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Schedule Upload Panel */}
            <Card className="h-64 flex flex-col p-4 border border-line">
              <AnimatePresence mode="wait">
                {draft.scheduleFile && scheduleValidation ? (
                  <motion.div key="summary-schedule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <ValidationDetailsCard
                      title="Weekly Schedule"
                      file={draft.scheduleFile}
                      validation={scheduleValidation}
                      type="schedule"
                      onRemove={handleRemoveSchedule}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="dropzone-schedule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <FileDropzone
                      label="Weekly Schedule Plan"
                      sublabel="Class sessions & occupancy timetable (weekly_schedule.csv)"
                      onDrop={handleScheduleDrop}
                      onDownloadSample={() => {
                        const blob = new Blob([generateSampleScheduleCsv()], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'sample_schedule.csv';
                        a.click();
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>

          {/* Date Alignment & Timeline Explanation Banner */}
          <div className="bg-card border border-line rounded-inner p-3.5 flex items-start gap-3 text-xs text-ink-2">
            <Info size={16} className="text-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-ink">Timeline & Date Alignment Context:</span>
              <p className="text-ink-3 leading-relaxed">
                The benchmark telemetry (<span className="text-ink-2 font-mono">synthetic_demo.csv</span>) covers <strong>Nov 1–7, 2026</strong> for historical anomaly detection and 168-hour model warm-up. The schedule (<span className="text-ink-2 font-mono">weekly_schedule.csv</span>) covers <strong>Nov 8–14, 2026</strong> for forward planning. The simulation engine evaluates embedded schedule and occupancy tags in historical telemetry to verify rule decisions against ground truth.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION C: Simulation Configuration Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink uppercase tracking-wider flex items-center gap-2">
              <Sliders size={16} className="text-accent" />
              <span>2. Run Configuration</span>
            </h2>
            <span className="text-xs text-ink-3">Engine Settings</span>
          </div>

          <Card className="p-5 border border-line space-y-4">
            {/* Mode Specific Config: Interval vs Replay Speed */}
            {draft.mode === 'batch' ? (
              <div>
                <label className="text-xs font-semibold text-ink-3 mb-2 block">Evaluation Interval</label>
                <PillSwitcher
                  options={['2 hours', '6 hours', '24 hours', '72 hours', 'Custom']}
                  defaultSelected={
                    draft.intervalHours === 2 ? '2 hours'
                    : draft.intervalHours === 6 ? '6 hours'
                    : draft.intervalHours === 24 ? '24 hours'
                    : draft.intervalHours === 72 ? '72 hours'
                    : 'Custom'
                  }
                  onChange={(val) => {
                    if (val === '2 hours') draft.setDraft({ intervalHours: 2 });
                    else if (val === '6 hours') draft.setDraft({ intervalHours: 6 });
                    else if (val === '24 hours') draft.setDraft({ intervalHours: 24 });
                    else if (val === '72 hours') draft.setDraft({ intervalHours: 72 });
                  }}
                />
                {![2, 6, 24, 72].includes(draft.intervalHours) && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-ink-3">Custom:</span>
                    <NumberField
                      value={draft.intervalHours}
                      onChange={(v) => draft.setDraft({ intervalHours: Math.max(1, Math.min(168, v)) })}
                      min={1}
                      max={168}
                      unit=" hrs"
                    />
                  </div>
                )}
                <p className="text-[11px] text-ink-3 mt-1.5">
                  Shorter intervals catch phantom runtime immediately; 24h evaluates whole-day patterns.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-ink-3 mb-2 block">Playback Speed Preset</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: '1x', label: '1× Real-Time', sub: '1 sim min / min' },
                    { id: '10x', label: '10× Fast', sub: '10 sim min / min' },
                    { id: '60x', label: '60× Demo', sub: '1 sim min / sec' },
                    { id: 'presentation', label: 'Presentation', sub: '~2-3m complete run' },
                  ].map((preset) => {
                    const isSelected = draft.replaySpeed === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSpeedChange(preset.id as ReplaySpeed)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'bg-accent text-white border-accent shadow-sm'
                            : 'bg-page/60 border-line hover:border-line-hover text-ink'
                        }`}
                      >
                        <div className="text-xs font-semibold">{preset.label}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-ink-3'}`}>
                          {preset.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-ink-3 mt-2">
                  Presentation mode streams all 50,400 CSV records rapidly in ~2–3 minutes while keeping the UI responsive.
                </p>
              </div>
            )}

            {/* Electricity Tariff */}
            <div>
              <label className="text-xs font-semibold text-ink-3 mb-1.5 block">Electricity Tariff (₹/kWh)</label>
              <div className="flex items-center gap-3">
                <NumberField
                  value={draft.tariff}
                  onChange={(v) => draft.setDraft({ tariff: Math.max(1, v) })}
                  min={1}
                  step={0.5}
                />
                <span className="text-xs text-ink-3">Campus Commercial Rate</span>
              </div>
            </div>

            {/* Hall Selection Filter */}
            <div>
              <label className="text-xs font-semibold text-ink-3 mb-1.5 block">Hall Scope</label>
              <select
                value={draft.selectedHall}
                onChange={(e) => draft.setDraft({ selectedHall: e.target.value })}
                className="w-full text-xs bg-page border border-line rounded px-3 py-2 text-ink focus:outline-none focus:border-accent"
              >
                <option value="ALL">All Benchmark Halls (HALL_A to HALL_E)</option>
                <option value="HALL_A">HALL_A — Lecture Hall A</option>
                <option value="HALL_B">HALL_B — Lecture Hall B</option>
                <option value="HALL_C">HALL_C — Seminar Hall</option>
                <option value="HALL_D">HALL_D — Conference Hall</option>
                <option value="HALL_E">HALL_E — Auditorium</option>
              </select>
            </div>

            {/* Optimization Policy */}
            <div>
              <label className="text-xs font-semibold text-ink-3 mb-1.5 block">AC Control Policy</label>
              <select
                value={draft.optimizationPolicy}
                onChange={(e) => draft.setDraft({ optimizationPolicy: e.target.value as any })}
                className="w-full text-xs bg-page border border-line rounded px-3 py-2 text-ink focus:outline-none focus:border-accent"
              >
                <option value="balanced">Balanced Comfort & Efficiency (22°C - 26°C)</option>
                <option value="aggressive">Aggressive Energy Savings (23°C - 27°C)</option>
                <option value="comfort">Maximum Comfort Priority (21.5°C - 24.5°C)</option>
              </select>
            </div>
          </Card>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION D — Live Multi-Stage Simulation Progress (Batch) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isRunning && activeJob && draft.mode === 'batch' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="bg-ink text-white border-none shadow-2xl p-5">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <RefreshCw size={16} className="text-accent animate-spin" />
                    <span className="font-semibold text-sm">Executing Energy Simulation Pipeline</span>
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white/80">
                      Step {activeJob.stepsCompleted} / {activeJob.stepsTotal}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    Job ID: {activeJob.id} • Mode: {activeJob.summary?.engine || 'ML Service Active'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold font-mono text-accent">
                    {Math.round(activeJob.progress * 100)}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-4">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(5, activeJob.progress * 100)}%` }}
                  transition={{ ease: 'linear', duration: 0.4 }}
                />
              </div>

              {/* Multi-stage pipeline tracker */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-2 border-t border-white/10 text-white/70">
                <div className={`flex items-center gap-1.5 ${activeJob.progress >= 0.1 ? 'text-accent font-semibold' : ''}`}>
                  <CheckCircle2 size={13} className={activeJob.progress >= 0.1 ? 'text-accent' : 'opacity-40'} />
                  <span>1. Parsing & Inputs</span>
                </div>
                <div className={`flex items-center gap-1.5 ${activeJob.progress >= 0.25 ? 'text-accent font-semibold' : ''}`}>
                  <CheckCircle2 size={13} className={activeJob.progress >= 0.25 ? 'text-accent' : 'opacity-40'} />
                  <span>2. ML Anomaly Model</span>
                </div>
                <div className={`flex items-center gap-1.5 ${activeJob.progress >= 0.5 ? 'text-accent font-semibold' : ''}`}>
                  <CheckCircle2 size={13} className={activeJob.progress >= 0.5 ? 'text-accent' : 'opacity-40'} />
                  <span>3. AC Rule Optimization</span>
                </div>
                <div className={`flex items-center gap-1.5 ${activeJob.progress >= 0.9 ? 'text-accent font-semibold' : ''}`}>
                  <CheckCircle2 size={13} className={activeJob.progress >= 0.9 ? 'text-accent' : 'opacity-40'} />
                  <span>4. Savings & Persistence</span>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* LIVE REPLAY WORKSPACE (When mode === 'replay')           */}
      {/* ======================================================== */}
      {draft.mode === 'replay' && (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 pt-2">
          {/* 1. Playback Control Bar & Scrubber */}
          <Card className="p-5 border border-line bg-card shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-line pb-4">
              {/* Playback Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {replayStatus === 'running' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handlePause}
                    className="gap-2 text-xs bg-amber hover:bg-amber/90 text-white"
                  >
                    <Pause size={14} /> Pause
                  </Button>
                ) : replayStatus === 'paused' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleResume}
                    className="gap-2 text-xs bg-mint hover:bg-mint/90 text-white"
                  >
                    <Play size={14} /> Resume
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!isReady || createSimulation.isPending}
                    onClick={handleSimulate}
                    className="gap-2 text-xs"
                  >
                    <Play size={14} /> Start Live Replay
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={replayStatus !== 'running' && replayStatus !== 'paused'}
                  onClick={handleStop}
                  className="gap-1.5 text-xs text-rose hover:bg-rose/10 hover:border-rose/30"
                >
                  <Square size={13} /> Stop
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeJobId}
                  onClick={handleRestart}
                  className="gap-1.5 text-xs"
                >
                  <RotateCcw size={13} /> Restart
                </Button>

                {/* Speed Selector Buttons */}
                <div className="flex items-center bg-page border border-line rounded-lg p-0.5 ml-2">
                  <span className="text-[11px] font-semibold text-ink-3 px-2">Speed:</span>
                  {(['1x', '10x', '60x', 'presentation'] as ReplaySpeed[]).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => handleSpeedChange(spd)}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${
                        draft.replaySpeed === spd
                          ? 'bg-accent text-white shadow-xs font-semibold'
                          : 'text-ink-2 hover:text-ink'
                      }`}
                    >
                      {spd === 'presentation' ? 'Presentation' : spd}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulated Clock & Wall-clock Timer Readout */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 bg-page border border-line px-3 py-1.5 rounded-lg">
                  <Clock size={14} className="text-accent" />
                  <span className="text-ink-3">Sim Time:</span>
                  <span className="font-mono font-semibold text-ink">
                    {liveTick?.simulatedTimestamp || '2026-11-01 00:00:00'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-page border border-line px-3 py-1.5 rounded-lg">
                  <Activity size={14} className="text-mint" />
                  <span className="text-ink-3">Wall Clock:</span>
                  <span className="font-mono font-semibold text-ink">
                    {formatWallClock(liveTick?.elapsedWallClockMs || 0)}
                  </span>
                </div>

                <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
                  <Radio size={12} className={replayStatus === 'running' ? 'animate-pulse' : ''} />
                  <span>
                    {replayStatus === 'running'
                      ? `Streaming (${draft.replaySpeed})`
                      : replayStatus === 'paused'
                      ? 'Paused'
                      : replayStatus === 'done'
                      ? 'Completed'
                      : replayStatus === 'stopped'
                      ? 'Stopped'
                      : 'Awaiting Start'}
                  </span>
                </div>
              </div>
            </div>

            {/* Replay Timeline Scrubber */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-ink-3 font-mono">
                <span>Nov 01, 2026 00:00</span>
                <span className="font-semibold text-accent">
                  {timelineScrubValue !== null
                    ? `Scrubbing to minute ${timelineScrubValue}...`
                    : `Simulated: ${liveTick?.simulatedTimestamp || '2026-11-01 00:00:00'}`}
                </span>
                <span>Nov 07, 2026 23:59</span>
              </div>

              <input
                type="range"
                min={0}
                max={liveTick?.totalMinutes || 10080}
                value={timelineScrubValue !== null ? timelineScrubValue : (liveTick?.currentMinuteIndex || 0)}
                onChange={(e) => setTimelineScrubValue(Number(e.target.value))}
                onMouseUp={() => timelineScrubValue !== null && handleTimelineScrub(timelineScrubValue)}
                onTouchEnd={() => timelineScrubValue !== null && handleTimelineScrub(timelineScrubValue)}
                className="w-full h-2.5 bg-page border border-line rounded-lg appearance-none cursor-pointer accent-accent"
              />

              <div className="flex items-center justify-between text-[11px] text-ink-3">
                <span>Duration: 7 Days (10,080 min • 50,400 records across 5 halls)</span>
                <span className="font-semibold text-ink">
                  Progress: {Math.round((liveTick?.progress || 0) * 100)}% ({liveTick?.currentMinuteIndex || 0} / {liveTick?.totalMinutes || 10080} min)
                </span>
                <span>Click or drag timeline slider to seek safely</span>
              </div>
            </div>
          </Card>

          {/* 2. Hall Selector & Live Telemetry KPI Cards */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <Activity size={18} className="text-accent" />
                  <span>Real-Time Hall & AC Telemetry Summary</span>
                </h2>
                <p className="text-xs text-ink-3">
                  Live synchronized minute-level telemetry across all 5 benchmark halls.
                </p>
              </div>

              {/* Hall Selector Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedHallFilter('ALL')}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                    selectedHallFilter === 'ALL'
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-page text-ink-2 hover:bg-card border border-line'
                  }`}
                >
                  Campus Overview (5 Halls)
                </button>
                {['HALL_A', 'HALL_B', 'HALL_C', 'HALL_D', 'HALL_E'].map((hId) => (
                  <button
                    key={hId}
                    type="button"
                    onClick={() => setSelectedHallFilter(hId)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all shrink-0 ${
                      selectedHallFilter === hId
                        ? 'bg-accent text-white shadow-sm'
                        : 'bg-page text-ink-2 hover:bg-card border border-line'
                    }`}
                  >
                    {hId}
                  </button>
                ))}
              </div>
            </div>

            {/* Live KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                label="Indoor Temperature"
                value={currentReplayHall ? `${currentReplayHall.indoorTempC}°C` : '--'}
                delta={{
                  value: 'Comfort: 22-26°C',
                  trend: currentReplayHall && currentReplayHall.indoorTempC >= 22 && currentReplayHall.indoorTempC <= 26 ? 'good' : 'bad'
                }}
                source="measured"
              />
              <StatCard
                label="Outdoor Air Temp"
                value={currentReplayHall ? `${currentReplayHall.outdoorTempC}°C` : '--'}
                source="measured"
              />
              <StatCard
                label="AC Units Status"
                value={
                  selectedHallFilter === 'ALL'
                    ? `${currentReplayHall ? (currentReplayHall as any).activeUnitsCount : 0}/5 Units ON`
                    : currentReplayHall?.acOn ? `ON @ ${currentReplayHall.setpointC}°C` : 'OFF'
                }
                source="measured"
              />
              <StatCard
                label="Room Occupancy"
                value={currentReplayHall ? `${currentReplayHall.occupancy}` : '0'}
                unit="persons"
                source="measured"
              />
              <StatCard
                label="Current Power"
                value={currentReplayHall ? `${currentReplayHall.powerKw}` : '0.0'}
                unit="kW"
                source="uploaded"
              />
              <StatCard
                label="Cumulative Energy"
                value={currentReplayHall ? `${currentReplayHall.totalEnergyKwh.toLocaleString()}` : '0'}
                unit="kWh"
                source="uploaded"
              />
            </div>

            {/* Live Savings & Forecaster Model 2 Status */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6 bg-card border border-line rounded-inner p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-ink-3 block">Estimated Replay Energy Savings:</span>
                  <span className="text-base font-bold text-mint">
                    ₹ {currentReplayHall ? currentReplayHall.savingsInr.toLocaleString('en-IN') : '0'}
                  </span>
                  <span className="text-ink-3 ml-2">
                    ({currentReplayHall ? currentReplayHall.wastedKwh : 0} kWh eliminated)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-ink-3 block">Anomalies Detected:</span>
                  <span className="font-bold text-ink">
                    {liveTick ? liveTick.aggregate.totalAnomalies : 0}
                  </span>
                  <span className="text-[10px] text-ink-3 block">
                    ML: {liveTick?.aggregate.mlAnomaliesCount || 0} • Rule: {liveTick?.aggregate.ruleAnomaliesCount || 0}
                  </span>
                </div>
              </div>

              <div className="md:col-span-6 bg-card border border-line rounded-inner p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-ink-3 block">ML Model 2 (Energy Forecaster):</span>
                  <span className="font-semibold text-accent flex items-center gap-1.5 mt-0.5">
                    <Info size={14} />
                    {liveTick?.forecastStatus || 'Collecting historical context (0/168h)'}
                  </span>
                </div>
                <div className="text-right text-[11px] text-ink-3 max-w-[200px]">
                  Requires 168 hours of continuous historical readings before inference. Predictions are calibrated for relative campus baseline.
                </div>
              </div>
            </div>
          </div>

          {/* 3. Live Time-Series Chart */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <Calendar size={18} className="text-accent" />
                  <span>Live Replay Energy Consumption Chart</span>
                </h2>
                <p className="text-xs text-ink-3">
                  Scope: <span className="font-semibold text-ink">{selectedHallFilter === 'ALL' ? 'Campus Aggregate (All 5 Halls)' : selectedHallFilter}</span> • Streaming hourly energy accumulation during live replay.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" /> Live Telemetry
                </span>
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber inline-block" /> Baseline / Predicted
                </span>
              </div>
            </div>

            <Card className="p-5 border border-line flex flex-col min-h-[380px]">
              <div className="flex-1 w-full h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={liveChartPoints} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                    <XAxis
                      dataKey="timeLabel"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
                      unit=" kWh"
                    />
                    <RechartsTooltip content={<ChartTooltip valueSuffix=" kWh" />} />
                    <Legend wrapperStyle={{ paddingTop: 15 }} />
                    <Line
                      type="monotone"
                      name="Model Baseline / Forecast (kWh)"
                      dataKey="predictedKwh"
                      stroke="var(--amber)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      name="Live Replay Telemetry (kWh)"
                      dataKey="actualKwh"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-4 border-t border-line text-[11px] text-ink-3 space-y-1">
                <div className="flex items-center gap-1.5 text-ink-2 font-semibold">
                  <Info size={13} className="text-accent" />
                  <span>Playback Performance & Throttling:</span>
                </div>
                <p>
                  Telemetry records are chronologically processed minute-by-minute across all 5 halls. Dashboard chart points are sampled continuously to prevent UI thread lock during high-speed playback.
                </p>
              </div>
            </Card>
          </div>

          {/* 4. Live Anomaly Event List */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <AlertTriangle size={18} className="text-rose" />
                  <span>Live Anomaly Detection Stream</span>
                </h2>
                <p className="text-xs text-ink-3">
                  Identified abnormal power draws, phantom after-hours AC runtime, and overcooling events emitted during playback.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={anomalyFilterCat}
                  onChange={(e) => setAnomalyFilterCat(e.target.value)}
                  className="bg-page border border-line rounded px-2.5 py-1 text-ink focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="runtime_after_hours">Phantom Runtime (Unscheduled)</option>
                  <option value="setpoint_too_low">Over-cooling (Setpoint Low)</option>
                  <option value="model_outlier">Isolation Forest ML Outlier</option>
                </select>

                <select
                  value={anomalyFilterSev}
                  onChange={(e) => setAnomalyFilterSev(e.target.value)}
                  className="bg-page border border-line rounded px-2.5 py-1 text-ink focus:outline-none"
                >
                  <option value="ALL">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                </select>
              </div>
            </div>

            {liveAnomalies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveAnomalies
                  .filter((a) => {
                    if (selectedHallFilter !== 'ALL' && a.hallId !== selectedHallFilter) return false;
                    if (anomalyFilterCat !== 'ALL' && a.category !== anomalyFilterCat) return false;
                    if (anomalyFilterSev !== 'ALL' && a.severity !== anomalyFilterSev) return false;
                    return true;
                  })
                  .slice(0, 8)
                  .map((anom) => (
                    <Card key={anom.id} className="p-4 border border-line flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="text-xs font-semibold text-ink">{anom.hallName}</span>
                            <span className="text-[11px] text-ink-3 ml-2 font-mono">{anom.timestamp}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                anom.severity === 'critical'
                                  ? 'bg-rose/10 text-rose border border-rose/20'
                                  : anom.severity === 'high'
                                  ? 'bg-amber/10 text-amber border border-amber/20'
                                  : 'bg-page text-ink-2 border border-line'
                              }`}
                            >
                              {anom.severity}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                anom.detectionMethod === 'ml'
                                  ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                                  : 'bg-accent-soft text-accent border border-accent/20'
                              }`}
                            >
                              {anom.detectionMethod === 'ml' ? 'ML Model 1 (Isolation Forest)' : 'Rule Engine'}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-ink-2 leading-relaxed">{anom.explanation}</p>
                      </div>

                      <div className="pt-2 border-t border-line text-[11px] flex items-center justify-between">
                        <span className="text-ink-3">
                          Draw: <strong className="text-ink">{anom.observedKwh} kWh</strong> vs expected {anom.expectedKwh} kWh
                        </span>
                        <span className="text-accent font-medium">{anom.action}</span>
                      </div>
                    </Card>
                  ))}
              </div>
            ) : (
              <Card className="p-8 text-center border border-line text-xs text-ink-3">
                No anomalies detected yet. Start replay to begin continuous sensor anomaly detection.
              </Card>
            )}
          </div>

          {/* 5. Live Rule-Based AC Optimization Recommendations */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <ShieldCheck size={18} className="text-mint" />
                  <span>Live Rule-Based AC Optimization Recommendations</span>
                </h2>
                <p className="text-xs text-ink-3">
                  Deterministic recommendations produced by Minsaar's automated control engine as simulated readings arrive.
                </p>
              </div>
              <span className="text-xs text-mint font-semibold bg-mint/10 border border-mint/20 px-2.5 py-1 rounded">
                Live Replay Mode • Physical Hardware Interlock Isolated
              </span>
            </div>

            <Card className="p-0 overflow-hidden border border-line">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-page/50 text-ink-3 font-semibold uppercase tracking-wider border-b border-line">
                    <tr>
                      <th className="px-4 py-3">Hall & Time</th>
                      <th className="px-4 py-3">Current Observed</th>
                      <th className="px-4 py-3">Recommended Command</th>
                      <th className="px-4 py-3">Schedule Context</th>
                      <th className="px-4 py-3">Indoor / Comfort</th>
                      <th className="px-4 py-3">Deterministic Reason</th>
                      <th className="px-4 py-3 text-right">Est. Impact</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {liveRecommendations.length > 0 ? (
                      liveRecommendations
                        .filter((r) => selectedHallFilter === 'ALL' || r.hallId === selectedHallFilter)
                        .slice(0, 10)
                        .map((rec) => (
                          <tr key={rec.id} className="hover:bg-page/40 transition-colors">
                            <td className="px-4 py-3 text-ink">
                              <div className="font-semibold">{rec.hallName}</div>
                              <div className="text-[11px] text-ink-3">{rec.timestamp.split(' ')[1] || rec.timestamp}</div>
                            </td>
                            <td className="px-4 py-3 text-ink-2">
                              <span className="font-mono">{rec.currentState}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  rec.command === 'OFF'
                                    ? 'bg-rose/10 text-rose border border-rose/20'
                                    : rec.command === 'SETPOINT'
                                    ? 'bg-amber/10 text-amber border border-amber/20'
                                    : 'bg-mint/10 text-mint border border-mint/20'
                                }`}
                              >
                                {rec.command === 'OFF' ? 'PROPOSE OFF' : rec.command === 'SETPOINT' ? `SET ${rec.targetSetpointC}°C` : 'PRE-COOL ON'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-ink-3">{rec.scheduleContext} (occ: {rec.occupancy})</td>
                            <td className="px-4 py-3 text-ink-2 tabular-nums">
                              {rec.indoorTempC}°C <span className="text-[11px] text-ink-3">({rec.comfortThreshold})</span>
                            </td>
                            <td className="px-4 py-3 text-ink-2 max-w-xs truncate" title={rec.reason}>
                              {rec.reason}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-mint">
                              {rec.estimatedKwhSavings} kWh (₹{rec.estimatedCostSavings})
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-[10px] bg-page border border-line text-ink-3 px-1.5 py-0.5 rounded">
                                {rec.status}
                              </span>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-ink-3">
                          Awaiting live recommendation triggers during replay...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ======================================================== */}
      {/* RESULTS WORKBENCH (Only shown when mode is batch & done) */}
      {/* ======================================================== */}
      {draft.mode === 'batch' && activeJob?.summary && (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8 pt-4">

          {/* ======================================================== */}
          {/* SECTION I — Savings & Impact KPI Summary                 */}
          {/* ======================================================== */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <Zap size={18} className="text-accent" />
                  <span>Executive Savings & Performance Summary</span>
                </h2>
                <p className="text-xs text-ink-3">
                  Simulated results comparing baseline telemetry against the rule-optimized control policy.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5 text-xs">
                <Download size={14} /> Export Results CSV
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                label="Measured Energy"
                value={activeJob.summary.totalActualKwh.toLocaleString()}
                unit="kWh"
                source="uploaded"
              />
              <StatCard
                label="Forecast Energy"
                value={activeJob.summary.totalPredictedKwh.toLocaleString()}
                unit="kWh"
                source="predicted"
              />
              <StatCard
                label="Forecast MAE"
                value={activeJob.summary.mae.toFixed(2)}
                unit="kWh"
                source="predicted"
              />
              <StatCard
                label="ML Anomalies"
                value={activeJob.summary.mlAnomaliesCount || 0}
                source="predicted"
              />
              <StatCard
                label="Rule Anomalies"
                value={activeJob.summary.ruleAnomaliesCount || activeJob.summary.totalAnomalies}
                source="measured"
              />
              <StatCard
                label="Estimated Savings"
                value={`₹ ${activeJob.summary.savingsInrEst?.toLocaleString('en-IN')}`}
                delta={{
                  value: `${activeJob.summary.savingsPct || 0}%`,
                  trend: 'good',
                }}
                source="estimated"
              />
            </div>

            {/* Baseline & Savings Computation Details */}
            <div className="bg-card border border-line rounded-inner p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-ink-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-mint/10 text-mint flex items-center justify-center shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <span className="font-semibold text-ink">Calculation Methodology:</span>
                  <p className="text-ink-3">
                    Baseline Cost: <strong>₹ {activeJob.summary.baselineCostInr?.toLocaleString('en-IN') || 0}</strong> (
                    {activeJob.summary.totalActualKwh} kWh @ ₹{activeJob.config?.tariffInrPerKwh}/kWh) ➔ Optimized Cost: <strong>₹ {activeJob.summary.optimizedCostInr?.toLocaleString('en-IN') || 0}</strong>. Energy Saved: <strong>{activeJob.summary.savingsKwhEst} kWh</strong> ({activeJob.summary.savingsPct}% reduction).
                  </p>
                </div>
              </div>
              <div className="text-[11px] bg-page px-2.5 py-1 rounded text-ink-3 shrink-0">
                Comfort Compliance: <span className="font-semibold text-mint">{activeJob.summary.scheduleCompliancePct}%</span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION E — Hall-Wise Analysis & Comparison Table        */}
          {/* ======================================================== */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <BarChart3 size={18} className="text-accent" />
                  <span>Hall-Level Energy & Savings Breakdown</span>
                </h2>
                <p className="text-xs text-ink-3">
                  Individual hall performance calculated directly from benchmark telemetry data.
                </p>
              </div>

              {/* Hall Selector Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <button
                  onClick={() => setSelectedHallFilter('ALL')}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                    selectedHallFilter === 'ALL'
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-page text-ink-2 hover:bg-card border border-line'
                  }`}
                >
                  All Halls ({availableHalls.length})
                </button>
                {availableHalls.map((h) => (
                  <button
                    key={h.hallId}
                    onClick={() => setSelectedHallFilter(h.hallId)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all shrink-0 ${
                      selectedHallFilter === h.hallId
                        ? 'bg-accent text-white shadow-sm'
                        : 'bg-page text-ink-2 hover:bg-card border border-line'
                    }`}
                  >
                    {h.hallName.replace('Lecture ', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Hall Detail Card (when an individual hall is chosen) */}
            {currentHallMetric && (
              <Card className="bg-accent-soft/10 border border-accent/20 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-accent text-white">
                        {currentHallMetric.hallId}
                      </span>
                      <h3 className="text-sm font-bold text-ink">{currentHallMetric.hallName}</h3>
                    </div>
                    <p className="text-xs text-ink-3 mt-1">
                      Thermal Range: {currentHallMetric.minIndoorTempC}°C - {currentHallMetric.maxIndoorTempC}°C (Avg {currentHallMetric.avgIndoorTempC}°C) • AC Runtime: {currentHallMetric.acRuntimeHours}h • Comfort Compliance: {currentHallMetric.scheduleCompliancePct}%
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-xs text-ink-3">Measured Energy</div>
                      <div className="text-sm font-bold text-ink">{currentHallMetric.totalActualKwh} kWh</div>
                    </div>
                    <div>
                      <div className="text-xs text-ink-3">Estimated Savings</div>
                      <div className="text-sm font-bold text-mint">
                        ₹ {currentHallMetric.savingsInrEst.toLocaleString('en-IN')} ({currentHallMetric.savingsPct}%)
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedHallFilter('ALL')}
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      Reset view
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {/* Hall Comparison Table */}
            <Card className="p-0 overflow-hidden border border-line">
              <div className="p-3 bg-page/50 border-b border-line flex items-center justify-between text-xs text-ink-3">
                <span>Hall Comparison Matrix</span>
                <div className="flex items-center gap-2">
                  <span>Sort by:</span>
                  <button
                    onClick={() => setSortField('savings')}
                    className={`px-2 py-0.5 rounded ${sortField === 'savings' ? 'bg-card font-semibold text-ink border border-line' : 'hover:text-ink'}`}
                  >
                    Savings (₹)
                  </button>
                  <button
                    onClick={() => setSortField('consumption')}
                    className={`px-2 py-0.5 rounded ${sortField === 'consumption' ? 'bg-card font-semibold text-ink border border-line' : 'hover:text-ink'}`}
                  >
                    Consumption (kWh)
                  </button>
                  <button
                    onClick={() => setSortField('anomalies')}
                    className={`px-2 py-0.5 rounded ${sortField === 'anomalies' ? 'bg-card font-semibold text-ink border border-line' : 'hover:text-ink'}`}
                  >
                    Anomalies
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-page/30 text-ink-3 font-semibold uppercase tracking-wider border-b border-line">
                    <tr>
                      <th className="px-4 py-3">Hall</th>
                      <th className="px-4 py-3 text-right">Measured (kWh)</th>
                      <th className="px-4 py-3 text-right">Forecast (kWh)</th>
                      <th className="px-4 py-3 text-right">MAE</th>
                      <th className="px-4 py-3 text-center">Avg Temp</th>
                      <th className="px-4 py-3 text-center">AC Runtime</th>
                      <th className="px-4 py-3 text-center">Anomalies</th>
                      <th className="px-4 py-3 text-right">Baseline Cost</th>
                      <th className="px-4 py-3 text-right">Est. Savings</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {sortedHalls.map((h) => {
                      const isSelected = selectedHallFilter === h.hallId;
                      return (
                        <tr
                          key={h.hallId}
                          className={`transition-colors cursor-pointer ${isSelected ? 'bg-accent-soft/20 font-medium' : 'hover:bg-page/50'}`}
                          onClick={() => setSelectedHallFilter(isSelected ? 'ALL' : h.hallId)}
                        >
                          <td className="px-4 py-3 text-ink">
                            <div className="font-semibold">{h.hallName}</div>
                            <div className="text-[11px] text-ink-3">{h.hallId}</div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-ink">{h.totalActualKwh.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-ink-2">{h.totalPredictedKwh.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-ink-3">{h.mae}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-ink">{h.avgIndoorTempC}°C</td>
                          <td className="px-4 py-3 text-center tabular-nums text-ink-2">{h.acRuntimeHours} hrs</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${h.totalAnomalies > 0 ? 'bg-amber/10 text-amber' : 'bg-mint/10 text-mint'}`}>
                              {h.totalAnomalies}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-ink-2">₹ {h.baselineCostInr.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-mint">
                            ₹ {h.savingsInrEst.toLocaleString('en-IN')} ({h.savingsPct}%)
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button className="text-xs text-accent hover:underline font-medium">
                              {isSelected ? 'Viewing' : 'Inspect'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* ======================================================== */}
          {/* SECTION F — Energy Forecast Analysis Chart               */}
          {/* ======================================================== */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <Calendar size={18} className="text-accent" />
                  <span>Time-Series Energy Forecast & Replay</span>
                </h2>
                <p className="text-xs text-ink-3">
                  Scope: <span className="font-semibold text-ink">{selectedHallFilter === 'ALL' ? 'Campus Aggregate (All 5 Halls)' : selectedHallFilter}</span> • Showing hourly interval telemetry vs predictive model baseline.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" /> Actual Energy
                </span>
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber inline-block" /> Model Prediction
                </span>
              </div>
            </div>

            <Card className="p-5 border border-line flex flex-col min-h-[380px]">
              <div className="flex-1 w-full h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartSteps} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
                      dy={10}
                      interval={Math.floor(chartSteps.length / 10)}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
                      unit=" kWh"
                    />
                    <RechartsTooltip content={<ChartTooltip valueSuffix=" kWh" />} />
                    <Legend wrapperStyle={{ paddingTop: 15 }} />
                    <Line
                      type="monotone"
                      name="Model Forecast (kWh)"
                      dataKey="predictedKwh"
                      stroke="var(--amber)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      name="Actual Telemetry (kWh)"
                      dataKey="actualKwh"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Model Constraints Disclaimer */}
              <div className="mt-4 pt-4 border-t border-line text-[11px] text-ink-3 space-y-1">
                <div className="flex items-center gap-1.5 text-ink-2 font-semibold">
                  <Info size={13} className="text-accent" />
                  <span>Model Assumptions & Architectural Disclosure:</span>
                </div>
                <p>
                  The forecasting model was trained on ASHRAE Great Energy Predictor III commercial building data and requires 168 hours of historical observations. In this simulation, hall-level telemetry is evaluated as a proxy. Hall-level predictions are calibrated for relative baseline comparison.
                </p>
              </div>
            </Card>
          </div>

          {/* ======================================================== */}
          {/* SECTION G — Anomaly Detection & Diagnosis                */}
          {/* ======================================================== */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <AlertTriangle size={18} className="text-rose" />
                  <span>Anomaly Detection & Diagnosis</span>
                </h2>
                <p className="text-xs text-ink-3">
                  Identified abnormal power draws, phantom after-hours AC runtime, and overcooling events.
                </p>
              </div>

              {/* Anomaly Filters */}
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={anomalyFilterCat}
                  onChange={(e) => setAnomalyFilterCat(e.target.value)}
                  className="bg-page border border-line rounded px-2.5 py-1 text-ink focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="runtime_after_hours">Phantom Runtime (Unscheduled)</option>
                  <option value="setpoint_too_low">Over-cooling (Setpoint Low)</option>
                  <option value="model_outlier">Isolation Forest ML Outlier</option>
                </select>

                <select
                  value={anomalyFilterSev}
                  onChange={(e) => setAnomalyFilterSev(e.target.value)}
                  className="bg-page border border-line rounded px-2.5 py-1 text-ink focus:outline-none"
                >
                  <option value="ALL">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                </select>
              </div>
            </div>

            {filteredAnomalies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredAnomalies.slice(0, 8).map((anom) => (
                  <Card key={anom.id} className="p-4 border border-line flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-xs font-semibold text-ink">{anom.hallName}</span>
                          <span className="text-[11px] text-ink-3 ml-2 font-mono">{anom.timestamp}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                              anom.severity === 'critical'
                                ? 'bg-rose/10 text-rose border border-rose/20'
                                : anom.severity === 'high'
                                ? 'bg-amber/10 text-amber border border-amber/20'
                                : 'bg-page text-ink-2 border border-line'
                            }`}
                          >
                            {anom.severity}
                          </span>
                          <span className="text-[10px] bg-accent-soft text-accent px-1.5 py-0.5 rounded font-mono">
                            {anom.detectionMethod === 'ml' ? 'ML Model 1' : 'Rule Engine'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-ink-2 leading-relaxed">{anom.explanation}</p>
                    </div>

                    <div className="pt-2 border-t border-line text-[11px] flex items-center justify-between">
                      <span className="text-ink-3">
                        Draw: <strong className="text-ink">{anom.observedKwh} kWh</strong> vs expected {anom.expectedKwh} kWh
                      </span>
                      <span className="text-accent font-medium">{anom.action}</span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center border border-line text-xs text-ink-3">
                No anomalies detected matching the current filter criteria.
              </Card>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION H — Rule-Based AC Optimization Recommendations   */}
          {/* ======================================================== */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <ShieldCheck size={18} className="text-mint" />
                  <span>Rule-Based AC Optimization Recommendations</span>
                </h2>
                <p className="text-xs text-ink-3">
                  Deterministic recommendations produced by Minsaar's automated control engine.
                </p>
              </div>
              <span className="text-xs text-mint font-semibold bg-mint/10 border border-mint/20 px-2.5 py-1 rounded">
                Simulation Mode • Live Control Disabled
              </span>
            </div>

            <Card className="p-0 overflow-hidden border border-line">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-page/50 text-ink-3 font-semibold uppercase tracking-wider border-b border-line">
                    <tr>
                      <th className="px-4 py-3">Hall & Time</th>
                      <th className="px-4 py-3">Current Observed</th>
                      <th className="px-4 py-3">Recommended Command</th>
                      <th className="px-4 py-3">Schedule Context</th>
                      <th className="px-4 py-3">Indoor / Comfort</th>
                      <th className="px-4 py-3">Deterministic Reason</th>
                      <th className="px-4 py-3 text-right">Est. Impact</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredRecommendations.slice(0, 10).map((rec) => (
                      <tr key={rec.id} className="hover:bg-page/40 transition-colors">
                        <td className="px-4 py-3 text-ink">
                          <div className="font-semibold">{rec.hallName}</div>
                          <div className="text-[11px] text-ink-3">{rec.timestamp.split(' ')[1] || rec.timestamp}</div>
                        </td>
                        <td className="px-4 py-3 text-ink-2">
                          <span className="font-mono">{rec.currentState}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              rec.command === 'OFF'
                                ? 'bg-rose/10 text-rose border border-rose/20'
                                : rec.command === 'SETPOINT'
                                ? 'bg-amber/10 text-amber border border-amber/20'
                                : 'bg-mint/10 text-mint border border-mint/20'
                            }`}
                          >
                            {rec.command === 'OFF' ? 'PROPOSE OFF' : rec.command === 'SETPOINT' ? `SET ${rec.targetSetpointC}°C` : 'PRE-COOL ON'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-3">{rec.scheduleContext} (occ: {rec.occupancy})</td>
                        <td className="px-4 py-3 text-ink-2 tabular-nums">
                          {rec.indoorTempC}°C <span className="text-[11px] text-ink-3">({rec.comfortThreshold})</span>
                        </td>
                        <td className="px-4 py-3 text-ink-2 max-w-xs truncate" title={rec.reason}>
                          {rec.reason}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-mint">
                          {rec.estimatedKwhSavings} kWh (₹{rec.estimatedCostSavings})
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[10px] bg-page border border-line text-ink-3 px-1.5 py-0.5 rounded">
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

        </motion.div>
      )}

      {/* ======================================================== */}
      {/* SECTION K — Previous Simulation Runs Modal / Drawer      */}
      {/* ======================================================== */}
      {showHistoryModal && history && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card border border-line rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-line flex items-center justify-between bg-page/50">
              <div className="flex items-center gap-2">
                <History size={18} className="text-accent" />
                <h3 className="text-base font-bold text-ink">Previous Simulation Runs</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-ink-3 hover:text-ink p-1 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-page/40 text-ink-3 font-semibold uppercase tracking-wider border-b border-line">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Interval</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">MAE</th>
                    <th className="px-4 py-2.5 text-right">Anomalies</th>
                    <th className="px-4 py-2.5 text-right">Savings (₹)</th>
                    <th className="px-4 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {history.map((job) => (
                    <tr key={job.id} className="hover:bg-page/50 transition-colors">
                      <td className="px-4 py-3 text-ink font-medium">
                        {new Date(job.createdAt).toLocaleString()}
                        <div className="text-[11px] text-ink-3 font-mono">{job.id.substring(0, 8)}...</div>
                      </td>
                      <td className="px-4 py-3 text-ink-2">{job.config.intervalHours} hrs</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            job.status === 'done'
                              ? 'bg-mint/10 text-mint'
                              : job.status === 'running'
                              ? 'bg-accent/10 text-accent animate-pulse'
                              : 'bg-rose/10 text-rose'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-2">{job.summary?.mae || '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-2">{job.summary?.totalAnomalies || '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-mint">
                        {job.summary?.savingsInrEst ? `₹ ${job.summary.savingsInrEst.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActiveJobId(job.id);
                            setShowHistoryModal(false);
                          }}
                          className="text-xs h-7 px-2"
                        >
                          Load Run
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}