import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un generador de comentarios de oyentes de una estación de radio generalista en español latinoamericano llamada Afirma Radio. Los programas pueden ser de cualquier temática: finanzas, emprendimiento, gastronomía, salud, entretenimiento, familia, tecnología, entrevistas, etc.

Tu objetivo es generar comentarios que parezcan escritos por personas REALES en redes sociales. No todos deben sonar igual ni tener la misma estructura.

════════════════════════════════════
REGLAS DE ESCRITURA (aplicar con variedad aleatoria)
════════════════════════════════════

1. ERRORES NATURALES — aplicar solo en el 30-40% de los comentarios, de forma aleatoria:
   - Faltas ortográficas comunes: "aser" por hacer, "enserio", "aveces", "haci", "ay" por "ahí", "porke", "q" por "que"
   - Palabras pegadas: "deuna", "ala", "hayque", "todoslos", "porqué" mal usado
   - Acentos olvidados o mal puestos
   - Puntuación irregular, ausente o excesiva

2. TONO — mezclar en el mismo lote:
   - Comentarios cortos (1-2 oraciones) y largos (4-5 oraciones)
   - Expresiones coloquiales: "wao", "uff", "la verdad", "justo lo que necesitaba", "qué fuerte", "me cayó el veinte", "eso es así"
   - Tono que va de informal a semi-formal, nunca corporativo

3. ESTRUCTURA — que se sienta orgánica:
   - Algunos con emojis (máximo 2-3), la mayoría sin ninguno
   - Frases incompletas ocasionales
   - Repeticiones naturales: "muy muy cierto", "de verdad de verdad"
   - No todos deben mencionar a los conductores ni a la ciudad

4. CONTENIDO — variar los tipos de comentario en cada lote:
   - Testimonio personal relacionado con el tema del programa
   - Agradecimiento al programa o los conductores
   - Referencia a una situación cotidiana conectada con el tema
   - Pregunta o reflexión dirigida a los conductores
   - Identificación con algo específico que se dijo
   - Mención espontánea de la ciudad de origen (no en todos)

════════════════════════════════════
LO QUE DEBES EVITAR
════════════════════════════════════
- Que TODOS los comentarios tengan errores ortográficos (la distribución debe ser aleatoria)
- Que TODOS los comentarios tengan emojis
- Lenguaje demasiado formal, estructurado o que suene a redacción
- Comentarios que parezcan plantillas repetidas
- Exceso de hashtags
- Que todos mencionen el nombre del programa o los conductores de la misma forma

════════════════════════════════════
EJEMPLOS DEL TONO DESEADO
════════════════════════════════════
✓ "Uff esto me llego al corazon, aveces me cuesta tanto reconocer cuando meto lapata. Saludos desde Monterrey 🙏"
✓ "Que tema tan importante! La verdad nunca había pensado en eso desde ese ángulo"
✓ "Justo hoy discutí con mi esposo porqué no quería aceptar que me equivoqué... este programa fue para mi. Bendiciones"
✓ "muy muy cierto lo que dijo [conductor], eso es algo que vivimos todos los días en las empresas"
✓ "desde Mérida siguiendo el programa, de verdad gracias por tratar estos temas enserio que hacen falta"
✓ "Qué bueno que tocaron este tema. Yo llevo años en esto y todavía aprendo cosas nuevas 😅"
✓ "La parte donde hablaron de [tema específico] me pareció lo mejor. Ojalá profundicen más en eso"`;

// Helper maps for human-readable labels
const GENERACION_LABELS: Record<string, string> = {
  boomers: "Baby Boomers (1946-1964, 60-78 años): formales, respetuosos, bajo nivel tecnológico",
  genx: "Generación X (1965-1980, 44-59 años): equilibrados entre formal e informal, moderado nivel tecnológico",
  millennials: "Millennials (1981-1998, 28-43 años): casual pero correcto, alto nivel tecnológico, usan referencias pop",
  genz: "Generación Z (1997-2012, 12-27 años): muy casual, slang, nativos digitales, muchos emojis",
  alfa: "Generación Alfa (2013+, 0-11 años): simple y entusiasta, nativos digitales extremos",
};

const TONO_LABELS: Record<string, string> = {
  serio: "Serio/Formal: vocabulario culto, oraciones completas, sin slang",
  comico: "Cómico/Ligero: humor, chistes relacionados al tema, tono festivo",
  sarcastico: "Sarcástico: ironía sutil, doble sentido, comentarios con segunda intención",
  hater: "Hater: crítico pero sin insultar, encuentra fallas o puntos débiles en lo dicho",
  humor_negro: "Humor Negro: humor oscuro pero inteligente, no ofensivo",
  optimista: "Optimista: súper positivo, entusiasta, ve el lado bueno de todo",
  pesimista: "Pesimista: escéptico, ve el lado negativo, duda de todo",
  dramatico: "Dramático: exagera las emociones, muy emotivo y teatral",
  academico: "Académico: análisis profundo, cita datos o conceptos, usa terminología técnica",
  infantil: "Infantil: simple, inocente, comentarios de niño o adolescente muy joven",
  cinico: "Cínico: desconfiado, escéptico, cree que todo tiene trampa",
  motivacional: "Motivacional/Coach: inspirador, da consejos, usa frases de superación personal",
  villano: "Villano: tono maquiavélico, manipulador sutil, frío y calculador",
  nerd: "Nerd: referencias geek, técnicas o de cultura pop, análisis detallado",
  bohemio: "Bohemio: artístico, filosófico, referencias culturales o espirituales libres",
  pasivo_agresivo: "Pasivo-agresivo: aparentemente positivo pero con crítica velada",
  conspiranoico: "Conspiranoico: teorías conspirativas, desconfía de los medios y el gobierno",
  chismoso: "Chismoso/Tóxico: especulativo, dramático, le gusta el conflicto y el cotilleo",
  espiritual: "Espiritual Zen: referencias a la energía, el universo, la meditación, frases de paz",
  politico: "Político: relaciona el tema con política, partidos o ideología",
  diplomatico: "Diplomático: equilibrado, considera todos los puntos de vista, muy considerado",
  cristiano_ev: "Cristiano Evangélico: referencias bíblicas evangélicas, menciona a Dios y bendiciones frecuentemente",
  cristiano_cat: "Cristiano Católico: referencias católicas tradicionales, menciona santos, la Virgen o el Papa",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const {
      transcription,
      programa,
      conductores,
      numConductores,
      generoConductores,
      tema,
      ciudades,
      longitud,
      generaciones,
      tonos,
      modo,
      promptLibre,
    } = body;
    const count = Math.min(25, Math.max(5, Number(body.count) || 10));

    if (!transcription || typeof transcription !== "string") {
      return new Response(JSON.stringify({ error: "No transcription provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (transcription.length > 50000) {
      return new Response(JSON.stringify({ error: "Transcription too long. Maximum 50,000 characters." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeModo = typeof modo === "string" ? modo : "normal";

    let userPrompt: string;

    if (safeModo === "prompt_libre") {
      // Free prompt mode: use the user's prompt directly
      const safePromptLibre = typeof promptLibre === "string" ? promptLibre.slice(0, 5000) : "";
      userPrompt = `${safePromptLibre}

Transcripción del audio: ${transcription}

Genera exactamente ${count} comentarios. Cada uno debe incluir:
- Nombre completo ficticio pero verosímil (nombre y apellido latinoamericanos)
- Ciudad
- El comentario en sí`;
    } else {
      // Normal mode: build structured prompt from config
      const safePrograma = typeof programa === "string" ? programa.slice(0, 200) : "";
      const safeConductores = typeof conductores === "string" ? conductores.slice(0, 200) : "";
      const safeCiudades = typeof ciudades === "string" ? ciudades.slice(0, 500) : "";
      const safeTema = typeof tema === "string" ? tema.slice(0, 300) : "";
      const safeNumConductores = typeof numConductores === "string" ? numConductores : "auto";
      const safeGeneroConductores = typeof generoConductores === "string" ? generoConductores : "auto";
      const safeLongitud = typeof longitud === "string" ? longitud : "variado";
      const safeGeneraciones = Array.isArray(generaciones) ? generaciones.slice(0, 3) : [];
      const safeTonos = Array.isArray(tonos) ? tonos.slice(0, 4) : [];

      const ciudadesText = safeCiudades === "__MEXICO__"
        ? "Genera ciudades reales de México de forma aleatoria para cada comentario (variadas, no solo las más grandes)"
        : `Ciudades disponibles: ${safeCiudades || "cualquier ciudad hispanohablante"}`;

      let conductorContext = "";
      if (safeNumConductores === "uno") conductorContext += "El programa tiene UN solo conductor.";
      else if (safeNumConductores === "varios") conductorContext += "El programa tiene VARIOS conductores.";
      else conductorContext += "Detecta automáticamente cuántos conductores hay según la transcripción.";

      if (safeGeneroConductores === "masculino") conductorContext += " El/los conductor(es) son MASCULINOS.";
      else if (safeGeneroConductores === "femenino") conductorContext += " El/los conductor(es) son FEMENINOS.";
      else conductorContext += " Detecta automáticamente el género según la transcripción.";

      let longitudInstruction = "";
      if (safeLongitud === "cortos") {
        longitudInstruction = "LONGITUD REQUERIDA: Comentarios CORTOS (15-35 palabras). Breves y directos, ideales para menciones rápidas.";
      } else if (safeLongitud === "largos") {
        longitudInstruction = "LONGITUD REQUERIDA: Comentarios LARGOS con ejemplos (80-120 palabras). Extensos con historias personales. Incluye experiencias y ejemplos relacionados al tema.";
      } else {
        longitudInstruction = "LONGITUD: Variada y libre. El modelo decide la longitud de forma natural.";
      }

      let generacionesInstruction = "";
      if (safeGeneraciones.length > 0) {
        const labels = safeGeneraciones.map((g: string) => GENERACION_LABELS[g] || g).filter(Boolean);
        generacionesInstruction = `GRUPOS DEMOGRÁFICOS: Distribuye los comentarios entre estos perfiles: ${labels.join(" | ")}. Adapta el lenguaje, slang, tecnología y referencias a cada generación.`;
      }

      let tonosInstruction = "";
      if (safeTonos.length > 0) {
        const labels = safeTonos.map((t: string) => TONO_LABELS[t] || t).filter(Boolean);
        tonosInstruction = `TONO Y ESTILO: Mezcla estos estilos en los comentarios: ${labels.join(" | ")}. Distribuye los tonos de forma natural y variada.`;
      }

      userPrompt = `════════════════════════════════════
DATOS DEL PROGRAMA A USAR
════════════════════════════════════
Programa: ${safePrograma || "No especificado"}
Conductores: ${safeConductores || "No especificado"}
${conductorContext}
${safeTema ? `Tema principal: ${safeTema}` : ""}
${ciudadesText}
Cantidad de comentarios a generar: ${count}

════════════════════════════════════
INSTRUCCIONES DE GENERACIÓN
════════════════════════════════════
${longitudInstruction}
${generacionesInstruction}
${tonosInstruction}

Transcripción del audio: ${transcription}

Genera exactamente ${count} comentarios. Cada uno debe incluir:
- Nombre completo ficticio pero verosímil (nombre y apellido latinoamericanos)
- Ciudad (tomada de la lista o generada aleatoriamente de México si aplica)
- El comentario en sí`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_comments",
              description: "Return the generated comments as structured JSON",
              parameters: {
                type: "object",
                properties: {
                  comments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nombre: { type: "string" },
                        ciudad: { type: "string" },
                        comentario: { type: "string" },
                      },
                      required: ["nombre", "ciudad", "comentario"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["comments"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_comments" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta de nuevo más tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ comments: parsed.comments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-comments error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to generate comments. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
