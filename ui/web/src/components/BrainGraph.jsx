import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { BRAIN_FEEDS, BRAIN_SECTIONS, answerOf, isAnswered, sectionProgress } from '../brain.js';

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SIZE = { biz: 16, section: 7, step: 5, item: 3.5, q: 1.4 };
const R = 4; // nodeRelSize; radius = R * sqrt(val), matching force-graph's pointer area
// Where the owner dropped nodes, per business, so the map keeps their layout across visits.
const pinKey = name => `brainGraph:${name || 'default'}`;
const loadPins = name => { try { return JSON.parse(localStorage.getItem(pinKey(name))) || {}; } catch { return {}; } };
const savePins = (name, pins) => { try { localStorage.setItem(pinKey(name), JSON.stringify(pins)); } catch {} };
const short = (t, n = 26) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

// Obsidian-style map: business → sections → answers (colored by tag) and → the steps they feed.
export default function BrainGraph({ brain, profile, name, byId, isDone, onSection, onStep }) {
  const wrap = useRef(null), fg = useRef(null), fitted = useRef(false);
  const [width, setWidth] = useState(600);
  const [, setPinned] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const items = brain?.items?.length || 0;
  // byId is a new object on every app render (polling, saves); key the graph on the step ids instead.
  const stepIds = Object.keys(BRAIN_FEEDS).filter(id => byId[id]).join();
  const steps = useRef(byId);
  steps.current = byId;
  const prev = useRef(new Map());
  const pins = useRef(null);
  const pinName = useRef(name).current; // fixed at mount so renaming the business mid-edit doesn't drop the layout
  if (!pins.current) pins.current = loadPins(pinName);
  // Structure only changes when an item is added/removed. Rebuilds keep every node's position.
  const data = useMemo(() => {
    const byId = steps.current;
    const nodes = [{ id: 'biz', kind: 'biz' }], links = [];
    for (const s of BRAIN_SECTIONS) {
      nodes.push({ id: 's:' + s.id, kind: 'section', section: s });
      links.push({ source: 'biz', target: 's:' + s.id, kind: 'spine' });
      for (const q of s.questions) { nodes.push({ id: 'q:' + q.id, kind: 'q', q, section: s }); links.push({ source: 's:' + s.id, target: 'q:' + q.id, kind: 'leaf' }); }
      if (s.items) for (let i = 0; i < items; i++) { nodes.push({ id: 'i:' + i, kind: 'item', index: i, section: s }); links.push({ source: 's:' + s.id, target: 'i:' + i, kind: 'leaf' }); }
    }
    for (const [step, secs] of Object.entries(BRAIN_FEEDS)) {
      if (!byId[step]) continue;
      nodes.push({ id: 't:' + step, kind: 'step', step: byId[step] });
      for (const s of secs) links.push({ source: 's:' + s, target: 't:' + step, kind: 'feeds' });
    }
    for (const n of nodes) {
      const old = prev.current.get(n.id), pin = pins.current[n.id];
      if (pin) { n.x = n.fx = pin[0]; n.y = n.fy = pin[1]; }
      else if (old) { n.x = old.x; n.y = old.y; }
    }
    prev.current = new Map(nodes.map(n => [n.id, n]));
    return { nodes, links };
  }, [items, stepIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const forcesSet = useRef(false);
  const setForces = () => {
    const g = fg.current;
    if (!g || forcesSet.current) return;
    forcesSet.current = true;
    g.d3Force('charge').strength(n => (n.kind === 'q' ? -18 : n.kind === 'biz' ? -260 : -120));
    g.d3Force('link').distance(l => (l.kind === 'spine' ? 70 : l.kind === 'feeds' ? 95 : 28));
    g.d3ReheatSimulation();
  };
  useEffect(setForces, []);
  const pinNode = n => {
    n.fx = n.x; n.fy = n.y;
    pins.current = { ...pins.current, [n.id]: [Math.round(n.x), Math.round(n.y)] };
    savePins(pinName, pins.current);
    setPinned(c => c + 1);
  };
  const unpinAll = () => {
    for (const n of data.nodes) { n.fx = undefined; n.fy = undefined; }
    pins.current = {};
    savePins(pinName, {});
    fg.current?.d3ReheatSimulation();
  };

  // Read live answers at paint time (ref), so colors update without rebuilding the graph.
  const live = useRef({});
  live.current = { brain, profile, name, isDone };
  const tone = n => {
    const { brain: b, profile: p, isDone: done } = live.current;
    if (n.kind === 'biz') return css('--primary');
    if (n.kind === 'step') return done(n.step.id) ? css('--accent') : css('--muted');
    if (n.kind === 'section') return sectionProgress(b, p, n.section).ready ? css('--ok') : n.section.required ? css('--bad') : css('--muted');
    const a = n.kind === 'q' ? answerOf(b, p, n.q) : b?.items?.[n.index]?.price;
    if (!isAnswered(a)) return css('--line');
    return a.s === 'estimate' ? '#e0a43a' : a.s === 'help' ? css('--bad') : a.s === 'known' ? css('--ok') : css('--muted');
  };
  const label = n => {
    const { brain: b, profile: p, name: nm } = live.current;
    if (n.kind === 'biz') return nm || 'Your business';
    if (n.kind === 'section') { const pr = sectionProgress(b, p, n.section); return `${n.section.title} ${pr.answered}/${pr.total}`; }
    if (n.kind === 'step') return n.step.title;
    if (n.kind === 'item') return b?.items?.[n.index]?.name?.v || `Item ${n.index + 1}`;
    return n.q.label;
  };
  const tooltip = n => {
    if (n.kind !== 'q') return label(n);
    const a = answerOf(live.current.brain, live.current.profile, n.q);
    const v = Array.isArray(a.v) ? a.v.join(', ') : a.v;
    return `${n.q.label}${v ? ` — ${short(String(v), 80)}` : ' (not answered)'}${a.s ? ` [${a.s}]` : ''}`;
  };

  const paint = (n, ctx, scale) => {
    const r = R * Math.sqrt(SIZE[n.kind]);
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = tone(n);
    ctx.fill();
    if (n.kind === 'step') { ctx.lineWidth = 1.5 / scale; ctx.strokeStyle = css('--panel'); ctx.stroke(); }
    if (n.kind === 'q' && scale < 2.4) return; // answers get labels once zoomed in
    const size = (n.kind === 'biz' ? 14 : n.kind === 'q' ? 9 : 11.5) / Math.min(scale, 2.4);
    ctx.font = `${n.kind === 'biz' || n.kind === 'section' ? 600 : 400} ${size}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = css(n.kind === 'q' ? '--muted' : '--ink');
    ctx.fillText(short(label(n), n.kind === 'q' ? 30 : 34), n.x, n.y + r + 2 / scale);
  };

  return (
    <div className="brain-graph" ref={wrap}>
      <ForceGraph2D
        ref={fg}
        graphData={data}
        width={width}
        height={420}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={R}
        nodeVal={n => SIZE[n.kind]}
        nodeLabel={tooltip}
        nodeCanvasObject={paint}
        linkColor={l => (l.kind === 'feeds' ? css('--accent') : css('--line'))}
        linkWidth={l => (l.kind === 'spine' ? 1.6 : 1)}
        linkLineDash={l => (l.kind === 'feeds' ? [3, 3] : null)}
        warmupTicks={80}
        cooldownTicks={120}
        d3VelocityDecay={0.45}
        onNodeDragEnd={pinNode}
        onEngineStop={() => { if (!fitted.current) { fitted.current = true; fg.current?.zoomToFit(400, 30); } }}
        onNodeClick={n => (n.kind === 'step' ? onStep(n.step.id) : n.section ? onSection(n.section.id, n.q?.id) : null)}
      />
      {Object.keys(pins.current).length > 0 && <button type="button" className="btn ghost brain-unpin" onClick={() => { unpinAll(); setPinned(0); }}>Reset layout</button>}
      <ul className="brain-legend" aria-hidden="true">
        <li><i style={{ background: 'var(--ok)' }} />Known</li>
        <li><i style={{ background: '#e0a43a' }} />Estimate</li>
        <li><i style={{ background: 'var(--bad)' }} />Help me work this out</li>
        <li><i style={{ background: 'var(--line)' }} />Not answered</li>
        <li><i style={{ background: 'var(--accent)' }} />Step that uses it</li>
      </ul>
    </div>
  );
}
