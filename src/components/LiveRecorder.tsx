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

  const audioContextRef = useRef<AudioContext | null>(null);

  const setupAudioCapture = useCallback(async (audio: HTMLAudioElement) => {
    try {
      // Mute audible output — we only need the visual spectrum
      audio.volume = 0;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Safari requires explicit resume after user gesture
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const dest = audioContext.createMediaStreamDestination();

      // Try captureStream for better Safari compatibility, fall back to createMediaElementSource
      let source: AudioNode;
      const stream = (audio as any).captureStream?.() || (audio as any).mozCaptureStream?.();
      if (stream && stream.getAudioTracks().length > 0) {
        console.log("Using captureStream for audio analysis");
        source = audioContext.createMediaStreamSource(stream);
      } else {
        console.log("Using createMediaElementSource for audio analysis");
        source = audioContext.createMediaElementSource(audio);
      }

      // Route: source → analyser → MediaRecorder destination (no speaker output)
      source.connect(analyser);
      analyser.connect(dest);

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

    const bufferLength = analyser.fftSize;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    let frameCount = 0;
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      // Check signal every 30 frames (~0.5s)
      frameCount++;
      if (frameCount % 30 === 0) {
        // Check time-domain deviation from silence (128 = silence)
        let deviation = 0;
        for (let i = 0; i < timeData.length; i++) {
          deviation += Math.abs(timeData[i] - 128);
        }
        if (deviation > 200) {
          setSignalStatus("active");
        } else {
          // Safari CORS restriction: analyser may return silence even when audio is captured
          // Fall back to checking if MediaRecorder is receiving data
          const recorder = mediaRecorderRef.current;
          const hasChunks = chunksRef.current.length > 0;
          const lastChunkSize = hasChunks ? chunksRef.current[chunksRef.current.length - 1].size : 0;
          if (recorder && recorder.state === "recording" && lastChunkSize > 0) {
            setSignalStatus("active");
          } else {
            setSignalStatus("silent");
          }
        }
      }

      // Clear canvas
      ctx.fillStyle = "hsl(270, 10%, 95%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = "hsl(289, 38%, 48%)";
      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

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

    const chunks = chunksRef.current;
    chunksRef.current = [];
    
    console.log("Recording stopped. Chunks:", chunks.length, "Chunk sizes:", chunks.map(c => c.size));
    
    const blob = new Blob(chunks, { type: "audio/webm" });
    console.log("Final blob size:", blob.size);

    // A valid webm with audio should be > 1KB; smaller means no real audio captured
    if (blob.size < 1000) {
      toast({ title: "Sin audio", description: "No se capturó audio real. El stream puede no estar activo o hay un problema de CORS.", variant: "destructive" });
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
