import { useState, useCallback } from "react";
import { Lightbulb, Copy, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AudioUploader from "@/components/AudioUploader";
import CommentCard, { type Comment } from "@/components/CommentCard";
import logo from "@/assets/logo.jpg";

const Index = () => {
  const [transcription, setTranscription] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [programa, setPrograma] = useState("");
  const [conductores, setConductores] = useState("");
  const [ciudades, setCiudades] = useState("");
  const [mexicanCities, setMexicanCities] = useState(false);
  const [count, setCount] = useState(10);
  const [comments, setComments] = useState<Comment[]>([]);
  const [generating, setGenerating] = useState(false);

  // hasAudio derived from transcription state

  const handleAudioReady = useCallback(async (file: File) => {
    setAudioFile(file);
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: formData,
      });

      if (error) throw error;
      setTranscription(data.transcription);
      setAudioFile(null); // release file reference
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
          programa,
          conductores,
          ciudades: mexicanCities ? "__MEXICO__" : ciudades,
          count,
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

        {/* Config Fields */}
        <div className="space-y-4 mb-8">
          <div>
            <Label className="font-bold">Programa</Label>
            <Input
              placeholder="Ej: Padres Invencibles"
              value={programa}
              onChange={(e) => setPrograma(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="font-bold">Conductores</Label>
            <Input
              placeholder="Ej: Eustolia y Moy"
              value={conductores}
              onChange={(e) => setConductores(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="font-bold">Ciudades</Label>
            <Input
              placeholder="Ej: Barcelona, Guadalajara, Mendoza"
              value={ciudades}
              onChange={(e) => setCiudades(e.target.value)}
              disabled={mexicanCities}
              className="mt-1"
            />
            <div className="flex items-center gap-2 mt-2">
              <Switch
                checked={mexicanCities}
                onCheckedChange={setMexicanCities}
              />
              <span className="text-sm text-muted-foreground">Ciudades de México</span>
            </div>
          </div>
        </div>

        {/* Comment Count */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <Label className="font-bold">Cantidad de Comentarios</Label>
            <span className="text-3xl font-bold">{count}</span>
          </div>
          <Slider
            value={[count]}
            onValueChange={(v) => setCount(v[0])}
            min={5}
            max={25}
            step={1}
            className="mb-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Mínimo (5)</span>
            <span>Recomendado (10)</span>
            <span>Máximo (25)</span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Mayor cantidad = más variedad, pero mayor tiempo de generación
          </div>
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
