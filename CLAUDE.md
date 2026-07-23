# Studio — agentic video pipeline

Templated workflow. Raw files in, finished MP4 out. Three tools, the agent routes
between them from their skills — this file is the whole "workflow", there is no glue code.

## Tools (each wired in differently)
- **HeyGen** — Claude Code MCP + skills plugin (`mcp__plugin_heygen_heygen__*`). Generates
  presenter / avatar / voiceover clips.
- **video-use** — skill at `.claude/skills/video-use/` (Python/uv). Trims fillers & silence,
  color-grades, burns subtitles, composites the final render. Needs `ELEVENLABS_API_KEY` in `.env`.
- **HyperFrames** — plugin (`hyperframes:*`), npm dep `hyperframes`. HTML/CSS/JS → deterministic MP4
  for title cards, lower-thirds, animated overlays.

## Pipeline
Start a job: `cp -r projects/_template projects/<name>`.

0. **HeyGen (optional)** — if the request needs a presenter/avatar/voiceover, generate it and
   save the clip into `projects/<name>/raw/`. Skip if the user supplied all footage.
1. **video-use** — edit everything in `projects/<name>/raw/`: cut fillers/silence, grade, subtitle.
   Session state → `projects/<name>/project.md`. Edited cut → `projects/<name>/out/`.
2. **HyperFrames** — build title cards / overlays as HTML in `projects/<name>/compositions/`;
   `npx hyperframes preview` then `render`. Output → `projects/<name>/out/`.
3. **Composite** — video-use's render step ffmpeg-assembles edited cut + rendered animations
   into the final MP4 in `projects/<name>/out/`.

## Hard rules
- Renders go to `projects/<name>/out/` only — never the repo root.
- One project = one folder under `projects/`.
- Don't edit anything in `.claude/skills/video-use/` (it's an upstream clone).
