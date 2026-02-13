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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { transcription, programa, conductores, ciudades, count } = await req.json();

    if (!transcription) {
      return new Response(JSON.stringify({ error: "No transcription provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ciudadesText = ciudades === "__MEXICO__"
      ? "Genera ciudades reales de México de forma aleatoria para cada comentario (variadas, no solo las más grandes)"
      : `Ciudades disponibles: ${ciudades || "cualquier ciudad hispanohablante"}`;

    const userPrompt = `════════════════════════════════════
DATOS DEL PROGRAMA A USAR
════════════════════════════════════
Programa: ${programa || "No especificado"}
Conductores: ${conductores || "No especificado"}
${ciudadesText}
Cantidad de comentarios a generar: ${count || 10}
Transcripción del audio: ${transcription}

Genera exactamente ${count || 10} comentarios. Cada uno debe incluir:
- Nombre completo ficticio pero verosímil (nombre y apellido latinoamericanos)
- Ciudad (tomada de la lista o generada aleatoriamente de México si aplica)
- El comentario en sí`;

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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
