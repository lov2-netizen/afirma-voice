import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import Hls from "hls.js";

import { toast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const HLS_URL = `${SUPABASE_URL}/functions/v1/hls-proxy?path=${encodeURIComponent("stream_1_aac.m3u8")}`;
const MAX_DURATION = 90 * 60; // 90 minutes

interface LiveRecorderProps {
  onBack: () => void;
  onTranscriptionReady: (transcription: string) => void;
  isTranscribing: boolean;
}

const LiveRecorder = ({ onBack, onTranscriptionReady, isTranscribing }: LiveRecorderProps) => {
  const [elapsed, setElapsed] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [signalStatus, setSignalStatus] = useState<"connecting" | "active" | "silent">("connecting");
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const setupAudioCapture = useCallback((audio: HTMLAudioElement) => {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(audio);
      const dest = audioContext.createMediaStreamDestination();
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source.connect(analyser);
      analyser.connect(dest);
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const recorder = new MediaRecorder(dest.stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      setSignalStatus("active");

      timerRef.current = window.setInterval(() => {
        setElapsed((prev) => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      drawSpectrum();
    } catch (err) {
      console.error("Error setting up audio capture:", err);
      toast({ title: "Error", description: "No se pudo configurar la captura de audio", variant: "destructive" });
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const audio = audioRef.current;
      if (!audio) return;

      setSignalStatus("connecting");

      const onPlaying = () => {
        audio.removeEventListener("playing", onPlaying);
        setupAudioCapture(audio);
      };
      audio.addEventListener("playing", onPlaying);

      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(HLS_URL);
        hls.attachMedia(audio);
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.error("HLS error:", data);
          if (data.fatal) {
            setSignalStatus("silent");
            toast({ title: "Error de conexión", description: "No se pudo conectar al stream en vivo", variant: "destructive" });
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          audio.play().catch((e) => {
            console.error("Play failed:", e);
            setSignalStatus("silent");
          });
        });
      } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = HLS_URL;
        audio.play().catch((e) => {
          console.error("Play failed:", e);
          setSignalStatus("silent");
        });
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      setSignalStatus("silent");
      toast({ title: "Error", description: "No se pudo iniciar la grabación", variant: "destructive" });
    }
  }, [setupAudioCapture]);

  const drawSpectrum = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let frameCount = 0;
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Check signal every 30 frames (~0.5s)
      frameCount++;
      if (frameCount % 30 === 0) {
        const sum = dataArray.reduce((a, b) => a + b, 0);
        setSignalStatus(sum > 100 ? "active" : "silent");
      }

      ctx.fillStyle = "hsl(270, 10%, 95%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barCount = 64;
      const barWidth = canvas.width / barCount;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step];
        const percent = value / 255;
        const barHeight = Math.max(percent * canvas.height, 1);

        const hue = 289 + (i / barCount) * 30;
        const saturation = 38 + percent * 20;
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${38 + percent * 15}%)`;
        ctx.fillRect(
          i * barWidth,
          canvas.height - barHeight,
          barWidth - 1,
          barHeight
        );
      }
    };
    draw();
  };

  const stopRecording = useCallback(async () => {
    if (isStopping) return;
    setIsStopping(true);

    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }

    setIsRecording(false);

    // Wait a moment for final chunks
    await new Promise((r) => setTimeout(r, 500));

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    if (blob.size === 0) {
      toast({ title: "Sin audio", description: "No se capturó audio. Verifica que el stream esté activo.", variant: "destructive" });
      setIsStopping(false);
      return;
    }

    // Transcribe
    try {
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");

      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody);
      }
      const data = await res.json();
      if (data?.transcription) {
        onTranscriptionReady(data.transcription);
      }
    } catch (err) {
      console.error("Transcription error:", err);
      toast({ title: "Error de transcripción", description: "No se pudo transcribir el audio", variant: "destructive" });
    }
    setIsStopping(false);
  }, [isStopping, onTranscriptionReady]);

  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (hlsRef.current) hlsRef.current.destroy();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 relative">
      <audio ref={audioRef} crossOrigin="anonymous" className="hidden" />

      <Button
        variant="ghost"
        size="sm"
        className="absolute top-3 left-3 gap-1 text-sm"
        onClick={() => {
          if (isRecording) stopRecording();
          onBack();
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        Atrás
      </Button>

      <div className="flex flex-col items-center gap-6 pt-8">
        {/* Live indicator + signal status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/60 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
            </span>
            <span className="text-sm font-medium text-destructive">EN VIVO</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            signalStatus === "active" 
              ? "bg-green-100 text-green-700" 
              : signalStatus === "silent" 
              ? "bg-yellow-100 text-yellow-700" 
              : "bg-muted text-muted-foreground"
          }`}>
            {signalStatus === "active" ? "📶 Señal detectada" : signalStatus === "silent" ? "⚠️ Sin señal" : "⏳ Conectando..."}
          </span>
        </div>

        {/* Stop button */}
        <button
          className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 disabled:opacity-50"
          onClick={stopRecording}
          disabled={isStopping || isTranscribing}
        >
          {isStopping || isTranscribing ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
          ) : (
            <Square className="h-6 w-6" fill="currentColor" />
          )}
        </button>

        {/* Waveform & timer */}
        <div className="flex w-full items-end justify-between gap-4">
          <canvas
            ref={canvasRef}
            width={300}
            height={60}
            className="rounded flex-1"
          />
          <div className="flex items-center gap-1 text-sm">
            <span className="rounded bg-muted px-2 py-1 font-mono">{formatTime(elapsed)}</span>
            <span className="text-muted-foreground">/</span>
            <span className="rounded bg-muted px-2 py-1 font-mono">{formatTime(MAX_DURATION > 5400 ? 5400 : MAX_DURATION)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveRecorder;
