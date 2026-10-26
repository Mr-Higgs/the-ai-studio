import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePosts, postsFor, videoPosts, toScript, shapeFor, linkPostVideo, linkCalendarVideo, polishPrompt } from '../ui/web/src/posts.js';

const KIT = `# Content kit

## Facebook

### Post 1 (Launch)
**Hook:** Your brakes shouldn't squeal.
**Body:** We fix them the same day, guaranteed.
**CTA:** Book a free check at [link].
#brakes #autorepair

### Post 2
**Hook:** Squeaky brakes again?
**Caption:** Honest quotes, no upsells.
**Call to action:** Call us today.

## Instagram

### Post 1 (Launch)
Stop scrolling — your commute needs this.
Same-day brake service near you.
DM us to book.
#local #cars

## Google Business Profile

### Post 1
**Hook:** Now booking Saturday slots.
**Body:** Reserve online in a minute.
**CTA:** Book now.
`;

test('parsePosts reads labelled posts out of channel sections', () => {
  const posts = parsePosts(KIT);
  assert.equal(posts.length, 4);
  const fb1 = posts[0];
  assert.equal(fb1.id, 'facebook-1');
  assert.equal(fb1.channel, 'Facebook');
  assert.equal(fb1.phase, 'Launch');
  assert.equal(fb1.hook, "Your brakes shouldn't squeal.");
  assert.equal(fb1.body, 'We fix them the same day, guaranteed.');
  assert.equal(fb1.cta, 'Book a free check at [link].');
  assert.deepEqual(fb1.hashtags, ['brakes', 'autorepair']);
  const fb2 = posts[1];
  assert.equal(fb2.body, 'Honest quotes, no upsells.');
  assert.equal(fb2.cta, 'Call us today.');
});

test('parsePosts falls back to first/middle/last lines for unlabelled posts', () => {
  const ig = parsePosts(KIT).find(p => p.channel === 'Instagram');
  assert.equal(ig.id, 'instagram-1');
  assert.equal(ig.phase, 'Launch');
  assert.equal(ig.hook, 'Stop scrolling — your commute needs this.');
  assert.equal(ig.body, 'Same-day brake service near you.');
  assert.equal(ig.cta, 'DM us to book.');
  assert.deepEqual(ig.hashtags, ['local', 'cars']);
});

test('parsePosts handles empty input and videoPosts filters to FB/IG', () => {
  assert.deepEqual(parsePosts(''), []);
  assert.deepEqual(parsePosts(null), []);
  const { posts, parsed } = videoPosts({ docs: { content: { content: KIT } } });
  assert.equal(parsed, true);
  assert.equal(posts.length, 3);
  assert.ok(posts.every(p => ['Facebook', 'Instagram'].includes(p.channel)));
  const structured = { posts: [{ id: 'a', channel: 'Facebook' }], docs: { content: { content: KIT } } };
  assert.deepEqual(postsFor(structured), { posts: structured.posts, parsed: false });
});

test('toScript strips hashtags, links and markup and caps at 90 words on a sentence end', () => {
  const post = { hook: '**Big** hook.', body: `Visit https://x.com now. ${'word '.repeat(95)}end.`, cta: 'Call us [link] #promo' };
  const s = toScript(post);
  assert.ok(!s.includes('#'), s);
  assert.ok(!s.includes('http'), s);
  assert.ok(!s.includes('[link]'), s);
  assert.ok(!s.includes('**'), s);
  assert.ok(s.split(' ').length <= 90);
  assert.match(s, /[.!?]$/); // cut at a sentence boundary
  const short = toScript({ hook: 'Hi.', body: 'Buy the thing.', cta: 'Call us.' });
  assert.equal(short, 'Hi. Buy the thing. Call us.');
  assert.equal(toScript({ hook: 'x '.repeat(100) }), 'x '.repeat(90).trim());
});

test('shapeFor picks the aspect preset per channel', () => {
  assert.equal(shapeFor('Instagram'), 'vertical');
  assert.equal(shapeFor('Facebook'), 'square');
  assert.equal(shapeFor('TikTok'), 'vertical');
});

test('linkPostVideo sets video on the matching post only', () => {
  const posts = [{ id: 'a', channel: 'Facebook' }, { id: 'b', channel: 'Instagram' }];
  const video = { project: 'p', file: 'f.mp4' };
  const next = linkPostVideo(posts, 'b', video);
  assert.deepEqual(next[1].video, video);
  assert.ok(!('video' in next[0]));
  assert.ok(!('video' in posts[1])); // new array, original untouched
});

test('linkCalendarVideo matches channel + copy and skips linked items', () => {
  const video = { project: 'p', file: 'f.mp4' };
  const post = { id: 'x', channel: 'Facebook', title: 'Brake promo', hook: 'Your brakes should not squeal at all ever' };
  const calendar = [
    { date: '2026-01-01', channel: 'Facebook', title: 'Brake promo', copy: 'old', video: { project: 'q', file: 'g.mp4' } },
    { date: '2026-01-02', channel: 'Instagram', title: 'Brake promo', copy: 'x' },
    { date: '2026-01-03', channel: 'Facebook', title: 'Weekly post', copy: 'remember: your brakes should not squeal at all ever, folks' },
  ];
  const { items, index } = linkCalendarVideo(calendar, post, video);
  assert.equal(index, 2);
  assert.deepEqual(items[2].video, video);
  assert.equal(linkCalendarVideo(calendar.slice(0, 2), post, video).index, -1);
  assert.equal(linkCalendarVideo([], post, video).index, -1);
});

test('polishPrompt asks Devin for a spoken rewrite in chat', () => {
  const p = polishPrompt('say this');
  assert.match(p, /60–90 words/);
  assert.match(p, /Reply with the script only in chat/);
  assert.ok(p.endsWith('say this'));
});
