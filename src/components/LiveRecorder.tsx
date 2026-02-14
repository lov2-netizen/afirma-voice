import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import Hls from "hls.js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const HLS_URL = "https://usa19.fastcast4u.com:3730/hls/stream_1_aac.m3u8";
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const audio = audioRef.current;
      if (!audio) return;

      // Set up HLS
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(HLS_URL);
        hls.attachMedia(audio);
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          audio.play();
        });
      } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = HLS_URL;
        audio.play();
      }

      // Capture audio via Web Audio API
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(audio);
      const dest = audioContext.createMediaStreamDestination();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);
      analyser.connect(dest);
      // No conectar a audioContext.destination para silenciar la salida

      const recorder = new MediaRecorder(dest.stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);

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
      console.error("Error starting recording:", err);
      toast({ title: "Error", description: "No se pudo iniciar la grabación", variant: "destructive" });
    }
  }, []);

  const drawSpectrum = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "hsl(270, 10%, 95%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barCount = 64;
      const barWidth = canvas.width / barCount;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step];
        const percent = value / 255;
        const barHeight = percent * canvas.height;

        // Gradient from primary to secondary
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

    // Transcribe
    try {
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");

      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: formData,
      });

      if (error) throw error;
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
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/60 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
          </span>
          <span className="text-sm font-medium text-destructive">EN VIVO</span>
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
