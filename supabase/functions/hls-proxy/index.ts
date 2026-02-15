// HLS Proxy v2
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HLS_BASE = "https://usa19.fastcast4u.com:3730/hls";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path");

    if (!path) {
      return new Response(JSON.stringify({ error: "Missing path param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate path to prevent abuse - only allow valid HLS segment patterns
    if (!/^[a-zA-Z0-9_\-\/\.]+\.(m3u8|ts|aac|mp4)$/.test(path)) {
      return new Response(JSON.stringify({ error: "Invalid path format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUrl = `${HLS_BASE}/${path}`;
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return new Response(`Upstream error: ${response.status}`, {
        status: response.status,
        headers: corsHeaders,
      });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const body = await response.arrayBuffer();

    // For m3u8 manifests, rewrite ALL non-comment lines to go through proxy
    if (path.endsWith(".m3u8")) {
      const text = new TextDecoder().decode(body);
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      // Resolve relative segment paths against the playlist's directory
      const dirPrefix = path.includes("/") ? path.substring(0, path.lastIndexOf("/") + 1) : "";
      const rewritten = text.replace(
        /^(?!#)(\S+)$/gm,
        (match) => {
          const trimmed = match.trim();
          // If already absolute URL, just proxy it; otherwise prepend directory
          const segmentPath = trimmed.startsWith("http") ? trimmed : `${dirPrefix}${trimmed}`;
          return `${supabaseUrl}/functions/v1/hls-proxy?path=${encodeURIComponent(segmentPath)}`;
        }
      );
      return new Response(rewritten, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache",
        },
      });
    }

    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("hls-proxy error:", e);
    return new Response(JSON.stringify({ error: "Proxy error. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
