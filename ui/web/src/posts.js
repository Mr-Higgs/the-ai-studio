// Social posts from the content kit — structured (biz.posts / posts.json) or parsed
// out of an older content.md. Pure JS so node --test can import it.
import { CHANNELS } from './steps.js';

export const SOCIAL_VIDEO_CHANNELS = ['Facebook', 'Instagram'];

const slug = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const HEAD = /^(#{1,4})\s+(.+?)\s*$/;
const POST_MARK = /^\s*\*{0,2}(?:post|caption)\s*\d+/i;
const LABELS = [
  ['hook', /^\*{0,2}hook\*{0,2}\s*:/i],
  ['body', /^\*{0,2}(?:body|caption)\*{0,2}\s*:/i],
  ['cta', /^\*{0,2}(?:cta|call\s*to\s*action)\*{0,2}\s*:/i],
  ['phase', /^\*{0,2}phase\*{0,2}\s*:/i],
];

// A section heading belongs to a channel when it names one; also accept short aliases.
const channelOf = title => {
  const t = title.toLowerCase().replace(/\*+/g, '');
  const hit = CHANNELS.find(c => t.includes(c.toLowerCase()));
  if (hit) return hit;
  if (/\big\b/.test(t)) return 'Instagram';
  if (/\bfb\b/.test(t)) return 'Facebook';
  return null;
};

// Lines that are mostly hashtags (e.g. "#candles #austin #smallbiz") feed hashtags.
const hashtagLine = line => {
  const words = line.split(/\s+/).filter(Boolean);
  const tags = words.filter(w => /^#[\w-]+/.test(w)).map(w => w.replace(/^#/, '').replace(/[^\w-].*$/, '')).filter(Boolean);
  return tags.length && tags.length * 2 > words.length ? tags : null;
};
const append = (a, b) => (a ? `${a}\n${b}` : b);
const tidy = s => s.replace(/\*\*/g, '').trim();

function extractPost(chunk, id) {
  const post = { id, channel: chunk.channel, phase: '', title: '', hook: '', body: '', cta: '', hashtags: [] };
  const loose = []; // unlabelled, non-hashtag lines — fallback source
  let labelled = false, cur = null;
  for (const raw of chunk.lines) {
    const line = raw.trim();
    if (!line) { if (cur) post[cur] = append(post[cur], ''); continue; }
    const tags = hashtagLine(line);
    if (tags) { post.hashtags.push(...tags); cur = null; continue; }
    const lab = LABELS.find(([, re]) => re.test(line));
    if (lab) {
      labelled = true;
      const rest = tidy(line.replace(lab[1], ''));
      if (lab[0] === 'phase') { post.phase = rest; cur = null; continue; }
      cur = lab[0];
      if (rest) post[cur] = append(post[cur], rest);
      continue;
    }
    if (cur) post[cur] = append(post[cur], line);
    else loose.push(line);
  }
  if (!labelled) {
    post.hook = tidy(loose[0] || '');
    post.cta = loose.length > 1 ? tidy(loose[loose.length - 1]) : '';
    post.body = tidy(loose.slice(1, loose.length > 1 ? -1 : 1).join('\n'));
  } else if (!post.body && loose.length) {
    post.body = tidy(loose.join('\n'));
  }
  for (const k of ['hook', 'body', 'cta', 'phase']) post[k] = tidy(post[k]);
  post.hashtags = [...new Set(post.hashtags)];
  const parens = chunk.heading.match(/\(([^)]+)\)/);
  if (!post.phase && parens) post.phase = parens[1].trim();
  post.title = chunk.heading.replace(/\*(.+?)\*/g, '$1')
    .replace(/^\s*(?:post|caption)\s*\d+\s*[:.\-–—)]?\s*/i, '')
    .replace(/^\([^)]*\)\s*/, '').trim()
    || (post.hook || post.body).slice(0, 60);
  return post.hook || post.body ? post : null;
}

// Fallback for kits written before posts.json: carve posts out of the markdown.
export function parsePosts(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) return [];
  const chunks = [];
  let channel = null, channelLevel = 0, cur = null;
  const push = () => { if (cur && cur.lines.some(l => l.trim())) chunks.push(cur); };
  for (const raw of markdown.split('\n')) {
    const h = raw.match(HEAD);
    if (h) {
      const level = h[1].length, ch = channelOf(h[2]);
      push();
      if (ch) { channel = ch; channelLevel = level; cur = { channel, heading: '', lines: [] }; }
      else if (channel && level > channelLevel) cur = { channel, heading: h[2], lines: [] };
      else { channel = null; cur = null; }
      continue;
    }
    if (channel && POST_MARK.test(raw)) { push(); cur = { channel, heading: raw.trim().replace(/\*+/g, ''), lines: [] }; continue; }
    if (channel) (cur ||= { channel, heading: '', lines: [] }).lines.push(raw);
  }
  push();
  const counts = {}, posts = [];
  for (const c of chunks) {
    const n = counts[c.channel] = (counts[c.channel] || 0) + 1;
    const p = extractPost(c, `${slug(c.channel)}-${n}`);
    if (p) posts.push(p);
  }
  return posts;
}

// Prefer the structured posts.json; fall back to parsing the content doc.
export function postsFor(biz) {
  return biz?.posts?.length
    ? { posts: biz.posts, parsed: false }
    : { posts: parsePosts(biz?.docs?.content?.content || ''), parsed: true };
}

export function videoPosts(biz) {
  const { posts, parsed } = postsFor(biz);
  return { posts: posts.filter(p => SOCIAL_VIDEO_CHANNELS.some(c => c.toLowerCase() === (p.channel || '').toLowerCase())), parsed };
}

// Hook + body + CTA as a spoken script: no hashtags, links or markup, ≤90 words.
export function toScript(post) {
  if (!post) return '';
  const text = [post.hook, post.body, post.cta].filter(Boolean).join(' ')
    .replace(/#\w+/g, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/\[link\]/gi, ' ')
    .replace(/\*\*/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = text.split(' ').filter(Boolean);
  if (words.length <= 90) return text;
  const head = words.slice(0, 90).join(' ');
  const sentence = head.match(/^(.*[.!?])\s*[^.!?]*$/);
  return sentence && sentence[1].trim() ? sentence[1].trim() : head;
}

export const shapeFor = channel =>
  (channel || '').toLowerCase() === 'instagram' ? 'vertical'
    : (channel || '').toLowerCase() === 'facebook' ? 'square' : 'vertical';

export const linkPostVideo = (posts, postId, video) =>
  (posts || []).map(p => (p.id === postId ? { ...p, video } : p));

// Attach the finished video to the first unlinked calendar item for this post.
export function linkCalendarVideo(calendar, post, video) {
  const items = Array.isArray(calendar) ? calendar.map(x => ({ ...x })) : [];
  const chan = (post?.channel || '').toLowerCase();
  const needles = [post?.title || '', (post?.hook || '').slice(0, 40)]
    .map(s => s.toLowerCase()).filter(Boolean);
  const index = items.findIndex(item => !item.video
    && (item.channel || '').toLowerCase() === chan
    && needles.some(n => (item.title || '').toLowerCase().includes(n) || (item.copy || '').toLowerCase().includes(n)));
  if (index >= 0) items[index] = { ...items[index], video };
  return { items, index };
}

export const polishPrompt = script => `Rewrite this as a spoken HeyGen presenter script: 60–90 words, hook in the first sentence, keep the call-to-action, no hashtags or links, plain spoken English. Reply with the script only in chat — don't write a file.\n\n${script}`;
