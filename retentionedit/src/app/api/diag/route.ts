import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function findFont(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require("node:path");
    const roots: string[] = [];
    try { roots.push(process.cwd()); } catch {}
    roots.push("/var/task", "/tmp");
    try {
      let d: string = __dirname;
      for (let i = 0; i < 6; i++) { roots.push(d); d = p.dirname(d); }
    } catch {}
    const seen = new Set<string>();
    const hit = (dir: string, depth: number): string | null => {
      if (depth < 0 || seen.has(dir)) return null;
      seen.add(dir);
      try {
        const direct = p.join(dir, "assets", "fonts", "Inter-Bold.ttf");
        if (fs.existsSync(direct)) return direct;
        if (depth === 0) return null;
        const entries: string[] = fs.readdirSync(dir);
        for (const e of entries) {
          if (e === "node_modules" || e.startsWith(".")) continue;
          try {
            const sub = p.join(dir, e);
            if (fs.statSync(sub).isDirectory()) {
              const r = hit(sub, depth - 1);
              if (r) return r;
            }
          } catch {}
        }
      } catch {}
      return null;
    };
    for (const r of roots) {
      const f = hit(r, 3);
      if (f) return f;
    }
  } catch {}
  return null;
}

export async function GET(req: NextRequest) {
  const secret = process.env.DIAG_SECRET || "";
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const which = req.nextUrl.searchParams.get("which") || "all";
  const sharp = (await import("sharp")).default;
  const out: Record<string, unknown> = {};
  try {
    const fontPath = findFont();
    out.fontPath = fontPath;
    let b64 = "";
    if (fontPath) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("node:fs");
      b64 = fs.readFileSync(fontPath).toString("base64");
      out.fontBytes = b64.length;
    }
    const W = 1080; const H = 300;
    const mk = (style: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>${style}</style><text x="540" y="150" class="cap">the game is great</text></svg>`;
    const st = (fam: string) =>
      `.cap { font-family: ${fam}; font-size: 56px; font-weight: 700; fill: #ffffff; text-anchor: middle; }`;
    const variants: Record<string, string> = {
      sys: mk(st("'Helvetica Neue', Helvetica, Arial, sans-serif")),
      ttf: b64 ? mk(`@font-face { font-family: 'CapFont'; src: url(data:font/ttf;base64,${b64}) format('truetype'); }` + st("'CapFont', sans-serif")) : "NOFONT",
      serif: mk(st("serif")),
      mono: mk(st("monospace")),
    };
    const sharpAny = sharp as unknown as (input: Buffer) => { png: () => { toBuffer: () => Promise<Buffer> } };
    const keys = which === "all" ? Object.keys(variants) : [which];
    for (const k of keys) {
      const svg = variants[k];
      if (!svg || svg === "NOFONT") { out[k] = "NOFONT"; continue; }
      const buf = await sharpAny(Buffer.from(svg)).png().toBuffer();
      out[k] = "data:image/png;base64," + buf.toString("base64");
    }
    try {
      const { execFileSync } = await import("node:child_process");
      const { mediaBinaries } = await import("@/lib/media-bins");
      const bins = mediaBinaries();
      const filters = execFileSync(bins.ffmpeg, ["-hide_banner", "-filters"], { timeout: 15000 }).toString();
      out.has_drawtext = filters.includes(" drawtext ");
      out.has_subtitles = filters.includes(" subtitles ");
      out.has_ass = filters.includes(" ass ");
    } catch (e) { out.filters_error = String(e).slice(0, 120); }
  } catch (e) {
    out.error = String(e).slice(0, 300);
  }
  return NextResponse.json(out);
}
