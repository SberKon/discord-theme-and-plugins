import { FluxDispatcher } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./Settings";

// ─── Settings helper ─────────────────────────────────────────────────
const DEFAULTS: Record<string, any> = {
    embedColor: 6513919,
    footerText: "TikTok",
    showFooter: true,
    showAuthor: true,
    showStats: true,
    sensitiveMode: "normal",
};

function cfg(k: string): any {
    const v = (storage as any)[k];
    return v !== undefined ? v : DEFAULTS[k];
}

// ─── Domain helpers ──────────────────────────────────────────────────
const TIKTOK_HOSTS = [
    "tiktok.com", "www.tiktok.com",
    "vt.tiktok.com", "vm.tiktok.com", "m.tiktok.com",
];

function isTikTokUrl(url: string): boolean {
    try {
        return TIKTOK_HOSTS.some((d) => new URL(url).hostname === d);
    } catch { return false; }
}

function isTikTokEmbed(e: any): boolean {
    return isTikTokUrl(e.rawUrl || e.url || "") ||
        (e.provider?.name?.toLowerCase() || "") === "tiktok";
}

// ─── Detection ───────────────────────────────────────────────────────
function isSensitive(e: any): boolean {
    if (e.video && e.video.width === 0 && e.video.height === 0) return true;
    const t = (e.title || "").toLowerCase();
    if (["зайди в tiktok", "переглянути", "check out", "watch this"].some((m) => t.includes(m))) return true;
    if ((e.thumbnail?.url || "").includes("tiktok-logo")) return true;
    return false;
}

function isPhoto(url: string): boolean {
    return /\/photo\/\d+/.test(url);
}

// ─── Metadata parsers ────────────────────────────────────────────────
/** "TikTok · TRY-SAN" → "TRY-SAN" */
function getName(title?: string): string | null {
    const m = title?.match(/TikTok\s*[·•\-–]\s*(.+)/i);
    return m ? m[1].trim() : null;
}

/** URL → "@handle" */
function getHandle(url?: string): string | null {
    const m = url?.match(/@([^/?&#]+)/);
    return m ? `@${m[1]}` : null;
}

/** Parse TikTok description → likes, comments, caption */
function parseDesc(d?: string): { likes?: string; comments?: string; caption?: string } {
    if (!d) return {};
    const r: any = {};
    const cm = d.match(/[«\u201C\u201E](.+?)[»\u201D\u201F]/);
    if (cm) r.caption = cm[1];
    const nums = d.match(/\d[\d.,]*\s*[KkMmкК]?/g);
    if (nums) {
        const c = nums.map((n) => n.trim()).filter(Boolean);
        if (c[0]) r.likes = c[0];
        if (c[1]) r.comments = c[1];
    }
    return r;
}

// ─── Builder helpers ─────────────────────────────────────────────────
function mkAuthor(title?: string, url?: string): any {
    if (!cfg("showAuthor")) return undefined;
    const n = getName(title), h = getHandle(url);
    return {
        name: n && h ? `${n} (${h})` : n || h || "TikTok",
        url: h ? `https://tiktok.com/${h}` : url || "https://tiktok.com",
    };
}

function mkStats(s: { likes?: string; comments?: string }): string | undefined {
    if (!cfg("showStats") || (!s.likes && !s.comments)) return undefined;
    return `**❤️ ${s.likes || "?"} 💬 ${s.comments || "?"}**`;
}

function mkFooter(extra?: string): any {
    if (!cfg("showFooter")) return undefined;
    const base = cfg("footerText") || "TikTok";
    return { text: extra ? `${base} • ${extra}` : base };
}

function cpThumb(t: any): any {
    if (!t) return undefined;
    return {
        url: t.url, proxyURL: t.proxyURL || t.proxy_url,
        width: t.width || 720, height: t.height || 1280,
    };
}

function cpVideo(v: any): any {
    if (!v?.url) return undefined;
    return {
        url: v.url, proxyURL: v.proxyURL || v.proxy_url,
        width: v.width || 720, height: v.height || 1280,
    };
}

// ─── Build: Video (tnktok style) ─────────────────────────────────────
function buildVideo(e: any): any {
    const url = e.rawUrl || e.url;
    const stats = parseDesc(e.description);
    const r: any = { type: "rich", url, color: cfg("embedColor") };
    const a = mkAuthor(e.title, url); if (a) r.author = a;
    const sl = mkStats(stats); if (sl) r.description = sl;
    const th = cpThumb(e.thumbnail); if (th) r.thumbnail = th;
    const vi = cpVideo(e.video); if (vi) r.video = vi;
    const f = mkFooter(); if (f) r.footer = f;
    return r;
}

// ─── Build: Photo (tnktok style + count) ─────────────────────────────
function buildPhoto(e: any): any {
    const url = e.rawUrl || e.url;
    const stats = parseDesc(e.description);
    const parts: string[] = [];
    if (stats.caption) parts.push(`**${stats.caption}**`);
    const sl = mkStats(stats); if (sl) parts.push(sl);

    const r: any = { type: "rich", url, color: cfg("embedColor") };
    const a = mkAuthor(e.title, url); if (a) r.author = a;
    if (parts.length) r.description = parts.join("\n\n");
    if (e.thumbnail) {
        r.image = {
            url: e.thumbnail.url,
            proxyURL: e.thumbnail.proxyURL || e.thumbnail.proxy_url,
            width: e.thumbnail.width, height: e.thumbnail.height,
        };
    }
    const f = mkFooter("📷 Photo"); if (f) r.footer = f;
    return r;
}

// ─── Build: Sensitive → normal video with marker ─────────────────────
function buildSensitiveNormal(e: any): any {
    const url = e.rawUrl || e.url;
    const r: any = {
        type: "rich", url, color: cfg("embedColor"),
        description: "**⚠️ Sensitive Content**",
    };
    const a = mkAuthor(e.title, url); if (a) r.author = a;
    // Force non-zero dimensions on the player URL
    if (e.video?.url) {
        r.video = {
            url: e.video.url,
            proxyURL: e.video.proxyURL || e.video.proxy_url,
            width: 720, height: 1280,
        };
    }
    if (e.thumbnail?.url && !e.thumbnail.url.includes("tiktok-logo")) {
        r.thumbnail = cpThumb(e.thumbnail);
    }
    const f = mkFooter("18+"); if (f) r.footer = f;
    return r;
}

function buildSensitiveWarn(e: any): any {
    return {
        type: "rich",
        url: e.rawUrl || e.url,
        title: "⚠️ Sensitive Content",
        description: "This video is age-restricted by TikTok.\nVisit TikTok directly to view it.",
        color: 16237824,
        footer: mkFooter("18+"),
    };
}

// ─── Transform ───────────────────────────────────────────────────────
function transform(e: any): any | null {
    if (!isTikTokEmbed(e)) return e;
    if (isSensitive(e)) {
        const m = cfg("sensitiveMode");
        if (m === "hide") return null;
        if (m === "warn") return buildSensitiveWarn(e);
        return buildSensitiveNormal(e);
    }
    const url = e.rawUrl || e.url || "";
    return isPhoto(url) ? buildPhoto(e) : buildVideo(e);
}

function patchEmbeds(msg: any) {
    if (!msg?.embeds?.length) return;
    const out: any[] = [];
    for (const e of msg.embeds) {
        const r = transform(e);
        if (r !== null) out.push(r);
    }
    msg.embeds = out;
}

// ─── Lifecycle ───────────────────────────────────────────────────────
let patches: (() => void)[] = [];

export default {
    onLoad: () => {
        patches.push(
            before("dispatch", FluxDispatcher, ([ev]) => {
                if (ev.type === "MESSAGE_CREATE" || ev.type === "MESSAGE_UPDATE") {
                    if (ev.message) patchEmbeds(ev.message);
                }
                if (ev.type === "LOAD_MESSAGES_SUCCESS" && Array.isArray(ev.messages)) {
                    for (const m of ev.messages) patchEmbeds(m);
                }
            })
        );
    },
    onUnload: () => { for (const u of patches) u(); patches = []; },
    settings: Settings,
};