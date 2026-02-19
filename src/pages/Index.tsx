import { useState, useCallback } from "react";
import { Copy, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AudioUploader from "@/components/AudioUploader";
import CommentCard, { type Comment } from "@/components/CommentCard";
import CommentConfig, { type CommentConfigState } from "@/components/CommentConfig";
import logo from "@/assets/logo.jpg";

const defaultConfig: CommentConfigState = {
  modo: "normal",
  programa: "",
  conductores: "",
  numConductores: "auto",
  generoConductores: "auto",
  tema: "",
  ciudades: "",
  mexicanCities: false,
  count: 10,
  longitud: "variado",
  generaciones: [],
  tonos: [],
};

const Index = () => {
  const [transcription, setTranscription] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [config, setConfig] = useState<CommentConfigState>(defaultConfig);
  const [comments, setComments] = useState<Comment[]>([]);
  const [generating, setGenerating] = useState(false);

  const handleConfigChange = useCallback((updates: Partial<CommentConfigState>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleAudioReady = useCallback(async (file: File) => {
    setAudioFile(file);
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
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
      setTranscription(data.transcription);
      setAudioFile(null);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo transcribir el audio", variant: "destructive" });
    }
    setIsTranscribing(false);
  }, []);

  const handleTranscriptionReady = useCallback((t: string) => {
    setTranscription(t);
  }, []);

  const clearAudio = useCallback(() => {
    setTranscription(null);
    setAudioFile(null);
  }, []);

  const generate = async () => {
    if (!transcription) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-comments", {
        body: {
          transcription,
          programa: config.programa,
          conductores: config.conductores,
          numConductores: config.numConductores,
          generoConductores: config.generoConductores,
          tema: config.tema,
          ciudades: config.mexicanCities ? "__MEXICO__" : config.ciudades,
          count: config.count,
          longitud: config.longitud,
          generaciones: config.generaciones,
          tonos: config.tonos,
          modo: config.modo,
        },
      });
      if (error) throw error;
      setComments(data.comments);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudieron generar los comentarios", variant: "destructive" });
    }
    setGenerating(false);
  };

  const copyAll = () => {
    const text = comments
      .map((c) => `${c.nombre} - ${c.ciudad}\n${c.comentario}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Todos los comentarios copiados" });
  };

  const updateComment = (index: number, updated: Comment) => {
    setComments((prev) => prev.map((c, i) => (i === index ? updated : c)));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Afirma Radio" className="h-28 w-auto mb-4" />
          <h1 className="text-2xl font-bold">Generar Comentarios</h1>
        </div>

        {/* Audio Section */}
        <div className="mb-8">
          <AudioUploader
            onAudioReady={handleAudioReady}
            onTranscriptionReady={handleTranscriptionReady}
            isTranscribing={isTranscribing}
            onClear={clearAudio}
          />
          {transcription && !audioFile && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              Audio transcrito correctamente
            </div>
          )}
        </div>

        {/* Config Section */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4">Generar Comentarios</h2>
          <CommentConfig config={config} onChange={handleConfigChange} />
        </div>

        {/* Generate Button */}
        <Button
          className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90"
          disabled={!transcription || generating}
          onClick={generate}
        >
          {generating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Generando comentarios...
            </>
          ) : (
            "Generar Comentarios"
          )}
        </Button>

        {/* Results */}
        {comments.length > 0 && (
          <div className="mt-10 space-y-4">
            <h2 className="text-xl font-bold">Comentarios Generados</h2>
            {comments.map((c, i) => (
              <CommentCard
                key={i}
                comment={c}
                onUpdate={(updated) => updateComment(i, updated)}
              />
            ))}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="gap-2 flex-1" onClick={copyAll}>
                <Copy className="h-4 w-4" /> Copiar todos
              </Button>
              <Button variant="outline" className="gap-2 flex-1" onClick={generate} disabled={generating}>
                <RefreshCw className="h-4 w-4" /> Regenerar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
