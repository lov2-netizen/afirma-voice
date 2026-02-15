import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read file data
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    if (uint8.length === 0) {
      return new Response(JSON.stringify({ error: "Empty audio file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (uint8.length > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "File too large. Maximum 25MB." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine filename with valid extension
    const originalName = file.name || "audio";
    const hasExt = /\.(webm|mp3|wav|m4a|ogg|flac|mp4|mpeg|mpga|oga)$/i.test(originalName);
    const fileName = hasExt ? originalName : "recording.webm";

    // Build multipart form manually to ensure proper filename
    const boundary = "----FormBoundary" + crypto.randomUUID().replace(/-/g, "");
    const encoder = new TextEncoder();
    
    const parts: Uint8Array[] = [];
    
    // File part
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${file.type || "audio/webm"}\r\n\r\n`;
    parts.push(encoder.encode(fileHeader));
    parts.push(uint8);
    parts.push(encoder.encode("\r\n"));
    
    // Model part
    parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`));
    
    // Language part
    parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nes\r\n`));
    
    // End boundary
    parts.push(encoder.encode(`--${boundary}--\r\n`));
    
    // Combine all parts
    const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
    const body = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Whisper API error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({ transcription: result.text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("transcribe-audio error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to process audio. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
