import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type Modo = "normal" | "prompt_libre";
export type NumConductores = "auto" | "uno" | "varios";
export type GeneroConductores = "auto" | "masculino" | "femenino";
export type LongitudComentarios = "variado" | "cortos" | "largos";

export interface CommentConfigState {
  modo: Modo;
  promptLibre: string;
  programa: string;
  conductores: string;
  numConductores: NumConductores;
  generoConductores: GeneroConductores;
  tema: string;
  ciudades: string;
  mexicanCities: boolean;
  count: number;
  longitud: LongitudComentarios;
  generaciones: string[];
  tonos: string[];
}

interface Props {
  config: CommentConfigState;
  onChange: (updates: Partial<CommentConfigState>) => void;
}

const GENERACIONES = [
  { id: "boomers", label: "Baby Boomers (1946-1964)", rango: "60-78 años", desc: "Formal y respetuoso\nBajo nivel tecnológico" },
  { id: "genx", label: "Generación X (1965-1980)", rango: "44-59 años", desc: "Equilibrado formal/informal\nModerado nivel tecnológico" },
  { id: "millennials", label: "Millennials (1981-1998)", rango: "28-43 años", desc: "Casual pero correcto\nAlto nivel tecnológico" },
  { id: "genz", label: "Generación Z (1997-2012)", rango: "12-27 años", desc: "Muy casual, slang\nNativos digitales" },
  { id: "alfa", label: "Generación Alfa (2013+)", rango: "0-11 años", desc: "Simple y entusiasta\nNativos digitales extremos" },
];

const TONOS: { id: string; label: string; desc: string }[] = [
  { id: "serio", label: "Serio / Formal", desc: "Comentarios formales, educados, con vocabulario..." },
  { id: "comico", label: "Cómico / Ligero", desc: "Comentarios con humor, chistes relacionados a..." },
  { id: "sarcastico", label: "Sarcástico", desc: "Comentarios con sarcasmo sutil e ironía..." },
  { id: "hater", label: "Hater", desc: "Comentarios críticos pero constructivos..." },
  { id: "humor_negro", label: "Humor Negro", desc: "Comentarios con humor oscuro pero inteligente..." },
  { id: "optimista", label: "Optimista", desc: "Comentarios súper positivos y entusiastas..." },
  { id: "pesimista", label: "Pesimista", desc: "Comentarios escépticos, viendo el lado negati..." },
  { id: "dramatico", label: "Dramático", desc: "Comentarios exagerados y emotivos..." },
  { id: "academico", label: "Académico", desc: "Comentarios con análisis profundo y técnico..." },
  { id: "infantil", label: "Infantil", desc: "Comentarios simples e inocentes..." },
  { id: "cinico", label: "Cínico", desc: "Comentarios desconfiados y escépticos..." },
  { id: "motivacional", label: "Motivacional / Coach", desc: "Comentarios inspiradores y motivadores..." },
  { id: "villano", label: "Villano", desc: "Comentarios con tono maquiavélico..." },
  { id: "nerd", label: "Nerd", desc: "Comentarios con referencias geek y técnicas..." },
  { id: "bohemio", label: "Bohemio", desc: "Comentarios artísticos y filosóficos..." },
  { id: "pasivo_agresivo", label: "Pasivo-agresivo", desc: "Comentarios aparentemente positivos con criti..." },
  { id: "conspiranoico", label: "Conspiranoico", desc: "Comentarios con teorías conspirativas..." },
  { id: "chismoso", label: "Chismoso / Tóxico", desc: "Comentarios especulativos y dramáticos..." },
  { id: "espiritual", label: "Espiritual Zen", desc: "Comentarios con referencias espirituales..." },
  { id: "politico", label: "Político", desc: "Comentarios relacionados con política..." },
  { id: "diplomatico", label: "Diplomático", desc: "Comentarios equilibrados y considerados..." },
  { id: "cristiano_ev", label: "Cristiano Evangélico", desc: "Comentarios con referencias bíblicas evangé..." },
  { id: "cristiano_cat", label: "Cristiano Católico", desc: "Comentarios con referencias católicas tradic..." },
];

// Radio group component
const RadioGroup = ({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex flex-wrap gap-x-5 gap-y-2">
    {options.map((opt) => (
      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          value={opt.value}
          checked={value === opt.value}
          onChange={() => onChange(opt.value)}
          className="accent-primary w-4 h-4"
        />
        <span className="text-sm">{opt.label}</span>
      </label>
    ))}
  </div>
);

const CommentConfig = ({ config, onChange }: Props) => {
  const [showGeneraciones, setShowGeneraciones] = useState(false);
  const [showTonos, setShowTonos] = useState(false);

  const toggleGeneracion = (id: string) => {
    const current = config.generaciones;
    if (current.includes(id)) {
      onChange({ generaciones: current.filter((g) => g !== id) });
    } else {
      if (current.length >= 3) return; // max 3
      onChange({ generaciones: [...current, id] });
    }
  };

  const toggleTono = (id: string) => {
    const current = config.tonos;
    if (current.includes(id)) {
      onChange({ tonos: current.filter((t) => t !== id) });
    } else {
      if (current.length >= 4) return; // max 4
      onChange({ tonos: [...current, id] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Modo */}
      <div>
        <Label className="font-bold block mb-2">Modo</Label>
        <RadioGroup
          options={[
            { value: "normal", label: "Normal" },
            { value: "prompt_libre", label: "Prompt Libre" },
          ]}
          value={config.modo}
          onChange={(v) => onChange({ modo: v as Modo })}
        />
      </div>

      {/* Prompt Libre */}
      {config.modo === "prompt_libre" && (
        <div>
          <Label className="font-bold">Prompt</Label>
          <textarea
            placeholder="Escribe un prompt para generar comentarios"
            value={config.promptLibre}
            onChange={(e) => onChange({ promptLibre: e.target.value })}
            rows={6}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
          />
        </div>
      )}

      {/* Normal mode fields */}
      {config.modo === "normal" && (
        <>
          {/* Programa */}
          <div>
            <Label className="font-bold">Programa</Label>
            <Input
              placeholder="Ej: Padres Invencibles"
              value={config.programa}
              onChange={(e) => onChange({ programa: e.target.value })}
              className="mt-1"
            />
          </div>

          {/* Conductores */}
          <div>
            <Label className="font-bold">Conductores</Label>
            <Input
              placeholder="Ej: Eustolia y Moy"
              value={config.conductores}
              onChange={(e) => onChange({ conductores: e.target.value })}
              className="mt-1"
            />
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Número de conductores:</p>
              <RadioGroup
                options={[
                  { value: "auto", label: "Detectar automáticamente" },
                  { value: "uno", label: "Un conductor" },
                  { value: "varios", label: "Varios conductores" },
                ]}
                value={config.numConductores}
                onChange={(v) => onChange({ numConductores: v as NumConductores })}
              />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Género de los conductores:</p>
              <RadioGroup
                options={[
                  { value: "auto", label: "Detectar automáticamente" },
                  { value: "masculino", label: "Masculino" },
                  { value: "femenino", label: "Femenino" },
                ]}
                value={config.generoConductores}
                onChange={(v) => onChange({ generoConductores: v as GeneroConductores })}
              />
            </div>
          </div>

          {/* Tema */}
          <div>
            <Label className="font-bold">Tema</Label>
            <Input
              placeholder="Ej: ¿Y si soy padre y Madre a la vez?"
              value={config.tema}
              onChange={(e) => onChange({ tema: e.target.value })}
              className="mt-1"
            />
          </div>

          {/* Ciudades */}
          <div>
            <Label className="font-bold">Ciudades</Label>
            <Input
              placeholder="Ej: Barcelona, Guadalajara, Mendoza"
              value={config.ciudades}
              onChange={(e) => onChange({ ciudades: e.target.value })}
              disabled={config.mexicanCities}
              className="mt-1"
            />
            <div className="flex items-center gap-2 mt-2">
              <Switch
                checked={config.mexicanCities}
                onCheckedChange={(v) => onChange({ mexicanCities: v })}
              />
              <span className="text-sm text-muted-foreground">Ciudades de México</span>
            </div>
          </div>

          {/* Cantidad */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="font-bold">Cantidad de Comentarios</Label>
              <span className="text-3xl font-bold">{config.count}</span>
            </div>
            <Slider
              value={[config.count]}
              onValueChange={(v) => onChange({ count: v[0] })}
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

          {/* Longitud de Comentarios */}
          <div>
            <Label className="font-bold block mb-2">Longitud de Comentarios</Label>
            <p className="text-xs text-muted-foreground mb-3">Elige la extensión de los comentarios generados</p>
            <div className="space-y-2">
              {[
                {
                  value: "variado",
                  label: "Por Defecto (Variado)",
                  desc: "El modelo decide libremente la longitud y estilo de forma natural. Sin restricciones.",
                },
                {
                  value: "cortos",
                  label: "Comentarios Cortos",
                  desc: "Breves y directos (15-35 palabras). Ideal para menciones rápidas.",
                },
                {
                  value: "largos",
                  label: "Comentarios Largos con Ejemplos",
                  desc: "Extensos con historias personales (80-120 palabras). Incluyen experiencias y ejemplos relacionados al tema.",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    config.longitud === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <input
                    type="radio"
                    value={opt.value}
                    checked={config.longitud === opt.value}
                    onChange={() => onChange({ longitud: opt.value as LongitudComentarios })}
                    className="accent-primary mt-0.5 w-4 h-4 flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Tipo de Generación */}
          <div>
            <button
              type="button"
              className="flex items-center justify-between w-full"
              onClick={() => setShowGeneraciones(!showGeneraciones)}
            >
              <div>
                <Label className="font-bold cursor-pointer">Tipo de Generación</Label>
                {config.generaciones.length > 0 && (
                  <span className="ml-2 text-xs text-primary font-medium">({config.generaciones.length} seleccionados)</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {showGeneraciones ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showGeneraciones ? "Ocultar" : "Mostrar"}
              </div>
            </button>
            {showGeneraciones && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Selecciona uno o varios grupos demográficos (máximo 3 recomendado)
                </p>
                <div className="space-y-2">
                  {GENERACIONES.map((g) => {
                    const selected = config.generaciones.includes(g.id);
                    const disabled = !selected && config.generaciones.length >= 3;
                    return (
                      <label
                        key={g.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                          selected ? "border-primary bg-primary/5" : "border-border",
                          disabled ? "opacity-40 cursor-not-allowed" : "hover:border-primary/50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={disabled}
                          onChange={() => toggleGeneracion(g.id)}
                          className="accent-primary mt-0.5 w-4 h-4 flex-shrink-0"
                        />
                        <div className="flex-1 flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{g.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{g.desc}</p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{g.rango}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Tono y Estilo */}
          <div>
            <button
              type="button"
              className="flex items-center justify-between w-full"
              onClick={() => setShowTonos(!showTonos)}
            >
              <div>
                <Label className="font-bold cursor-pointer">Tono y Estilo</Label>
                {config.tonos.length > 0 && (
                  <span className="ml-2 text-xs text-primary font-medium">({config.tonos.length} seleccionados)</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {showTonos ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showTonos ? "Ocultar" : "Mostrar"}
              </div>
            </button>
            {showTonos && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Selecciona uno o varios estilos de comentarios (máximo 4 recomendado)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TONOS.map((t) => {
                    const selected = config.tonos.includes(t.id);
                    const disabled = !selected && config.tonos.length >= 4;
                    return (
                      <label
                        key={t.id}
                        className={cn(
                          "flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                          selected ? "border-primary bg-primary/5" : "border-border",
                          disabled ? "opacity-40 cursor-not-allowed" : "hover:border-primary/50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={disabled}
                          onChange={() => toggleTono(t.id)}
                          className="accent-primary mt-0.5 w-4 h-4 flex-shrink-0"
                        />
                        <div>
                          <p className="text-xs font-semibold">{t.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CommentConfig;
export { GENERACIONES, TONOS };
