// Pulls David's Trello board and writes site/data/recs.json + site/img/*.
// Needs env: TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD (board id or short link from the board URL).
// Optional env: DISCLOSURE (footer text, e.g. affiliate disclosure).
//
// Board conventions:
//   List          = category ("🛒 Products & Gear"; a leading emoji becomes the category icon)
//   Card          = recommendation (title = name)
//   Description   = why you like it (first paragraph is the short blurb on the card)
//   Cover image   = photo
//   Link attached = "where to get it" button (rename the attachment to change the button text)
//   Labels        = tags; a label named "Top pick" adds the ★ badge; a label named "Hidden" hides the card
//   Lists starting with "_" (e.g. "_Ideas") never appear on the site.

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(root, "site");
const IMG = path.join(SITE, "img");
const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD, DISCLOSURE = "" } = process.env;

if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_BOARD) {
  console.log("Trello secrets not set — keeping existing site/data/recs.json.");
  process.exit(0);
}

const API = "https://api.trello.com/1";
const auth = `key=${encodeURIComponent(TRELLO_KEY)}&token=${encodeURIComponent(TRELLO_TOKEN)}`;
const authHeader = { Authorization: `OAuth oauth_consumer_key="${TRELLO_KEY}", oauth_token="${TRELLO_TOKEN}"` };

async function api(p) {
  const res = await fetch(`${API}${p}${p.includes("?") ? "&" : "?"}${auth}`);
  if (!res.ok) throw new Error(`Trello ${p.split("?")[0]} → ${res.status} ${await res.text()}`);
  return res.json();
}

const EMOJI = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:[️‍]|\p{Extended_Pictographic}|\p{Regional_Indicator})*)\s*/u;
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";
const isTop = (n) => /^(top pick|favorite|favourite|⭐|★)/i.test(n.trim());
const isHidden = (n) => /^(hidden|draft)$/i.test(n.trim());

function firstParagraph(desc) {
  const p = (desc || "").trim().split(/\n\s*\n/)[0] || "";
  const plain = p.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/https?:\/\/\S+/g, "").replace(/[*_#>]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > 200 ? plain.slice(0, 197).replace(/\s+\S*$/, "") + "…" : plain;
}

async function downloadImage(card, att) {
  // Prefer a ~1000px preview to keep the site fast.
  const previews = (att.previews || []).filter((p) => p.width >= 600).sort((a, b) => a.width - b.width);
  const src = previews[0]?.url || att.url;
  const ext = (path.extname(new URL(src).pathname) || path.extname(att.name || "") || ".jpg").toLowerCase().slice(0, 5);
  const file = `${card.shortLink}${ext}`;
  const res = await fetch(src, { headers: authHeader });
  if (!res.ok) { console.warn(`  ! image for "${card.name}" → ${res.status}`); return null; }
  await writeFile(path.join(IMG, file), Buffer.from(await res.arrayBuffer()));
  return `img/${file}`;
}

const board = await api(`/boards/${TRELLO_BOARD}?fields=name,desc`);
const lists = (await api(`/boards/${TRELLO_BOARD}/lists?filter=open&fields=name,pos`)).sort((a, b) => a.pos - b.pos);
const cards = await api(`/boards/${TRELLO_BOARD}/cards?filter=open&fields=name,desc,idList,labels,pos,shortLink,idAttachmentCover,dateLastActivity&attachments=true&attachment_fields=name,url,isUpload,mimeType,previews`);

await rm(IMG, { recursive: true, force: true });
await mkdir(IMG, { recursive: true });

const categories = [];
const listMap = new Map();
for (const l of lists) {
  if (l.name.trim().startsWith("_")) continue;
  const m = l.name.trim().match(EMOJI);
  const emoji = m ? m[1] : "★";
  const name = m ? l.name.trim().slice(m[0].length) : l.name.trim();
  const cat = { id: slug(name), name, emoji, pos: l.pos };
  categories.push(cat);
  listMap.set(l.id, cat);
}

const used = new Set();
const items = [];
let latest = 0;
for (const c of cards) {
  const cat = listMap.get(c.idList);
  if (!cat) continue;
  const labelNames = (c.labels || []).map((l) => l.name).filter(Boolean);
  if (labelNames.some(isHidden)) continue;

  const atts = c.attachments || [];
  const linkAtt = atts.find((a) => !a.isUpload && /^https?:/.test(a.url));
  const descUrl = (c.desc || "").match(/https?:\/\/[^\s)\]]+/)?.[0];
  const link = linkAtt?.url || descUrl || "";
  const linkLabel = linkAtt && linkAtt.name && linkAtt.name !== linkAtt.url && !/^https?:/.test(linkAtt.name) ? linkAtt.name : "";

  const imgAtt = atts.find((a) => a.id === c.idAttachmentCover && a.isUpload) ||
    atts.find((a) => a.isUpload && /^image\//.test(a.mimeType || ""));
  const image = imgAtt ? await downloadImage(c, imgAtt) : null;

  let id = slug(c.name);
  while (used.has(id)) id = `${id}-${c.shortLink.toLowerCase()}`;
  used.add(id);
  latest = Math.max(latest, Date.parse(c.dateLastActivity) || 0);

  items.push({
    id,
    category: cat.id,
    title: c.name.trim(),
    blurb: firstParagraph(c.desc),
    note: (c.desc || "").trim(),
    tags: labelNames.filter((n) => !isTop(n)),
    top: labelNames.some(isTop),
    link,
    linkLabel,
    image,
    _listPos: cat.pos,
    _pos: c.pos,
  });
}

items.sort((a, b) => (b.top - a.top) || (a._listPos - b._listPos) || (a._pos - b._pos));
items.forEach((i) => { delete i._listPos; delete i._pos; });
categories.forEach((c) => delete c.pos);

const out = {
  sample: false,
  updated: new Date(latest || Date.now()).toISOString(),
  disclosure: DISCLOSURE,
  categories: categories.filter((c) => items.some((i) => i.category === c.id)),
  items,
};
await mkdir(path.join(SITE, "data"), { recursive: true });
await writeFile(path.join(SITE, "data", "recs.json"), JSON.stringify(out, null, 2));
console.log(`Synced "${board.name}": ${out.categories.length} categories, ${items.length} recommendations, ${items.filter((i) => i.image).length} photos.`);
