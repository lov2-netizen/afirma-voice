import { useCallback, useRef, useState } from "react";
import { Upload, X, FileAudio, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveRecorder from "./LiveRecorder";

interface AudioUploaderProps {
  onAudioReady: (file: File) => void;
  onTranscriptionReady: (transcription: string) => void;
  isTranscribing: boolean;
  onClear: () => void;
}

const AudioUploader = ({ onAudioReady, onTranscriptionReady, isTranscribing, onClear }: AudioUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const validTypes = ["audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4", "audio/x-wav"];
    if (!validTypes.some(t => f.type.includes(t.split("/")[1])) && !f.name.match(/\.(mp3|wav|m4a)$/i)) {
      return;
    }
    setFile(f);
    onAudioReady(f);
  }, [onAudioReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const clearFile = () => {
    setFile(null);
    onClear();
    if (inputRef.current) inputRef.current.value = "";
  };

  if (showLive) {
    return (
      <LiveRecorder
        onBack={() => setShowLive(false)}
        onTranscriptionReady={onTranscriptionReady}
        isTranscribing={isTranscribing}
      />
    );
  }

  if (file) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileAudio className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={clearFile}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {isTranscribing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Transcribiendo audio...
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border-2 border-dashed p-8 transition-colors ${
        dragOver ? "border-primary bg-accent/50" : "border-border bg-muted/20"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl border-2 border-border bg-background transition-colors hover:border-primary"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Haz clic para subir, o arrastra y suelta.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.m4a"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-3 py-1">o</span>
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setShowLive(true)}
        >
          <Mic className="h-4 w-4" />
          Escuchar transmisión
        </Button>
      </div>
    </div>
  );
};

export default AudioUploader;
