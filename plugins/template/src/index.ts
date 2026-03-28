import { FluxDispatcher, React } from "@vendetta/metro/common";
import { find, findByName, findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./Settings";
import TikTokEmbedView from "./TikTokEmbed";

// ─── Default Settings ────────────────────────────────────────────────
export const DEFAULTS: Record<string, any> = {
    pluginName: "fxTikTok",
    embedColor: 0x638DFF,
    maxDescLength: 150,
    videoDescLine: "❤️ {likes} 💬 {comments} 🔁 {shares}",
    photoDescLine: "❤️ {likes} 💬 {comments} 🔁 {shares}",
    sensitiveTitle: "⚠️ Sensitive Content",
    sensitiveDesc:
        "Sorry, we were unable to show this video due to the video being age-restricted. If you would like to view the video, please visit TikTok directly.",
    enableVideo: true,
    enablePhoto: true,
    enableSensitive: true,
    sensitiveBypass: false,
};

export function cfg(k: string): any {
    try {
        const v = (storage as any)[k];
        return v !== undefined && v !== null && v !== "" ? v : DEFAULTS[k];
    } catch {
        return DEFAULTS[k];
    }
}

// ─── Domain detection ────────────────────────────────────────────────
const TIKTOK_HOSTS = [
    "tiktok.com", "www.tiktok.com",
    "vt.tiktok.com", "vm.tiktok.com", "m.tiktok.com",
];

function isTikTokUrl(url: string): boolean {
    try { return TIKTOK_HOSTS.some(d => new URL(url).hostname === d); }
    catch { return false; }
}

function isTikTokEmbed(e: any): boolean {
    const url = e.rawUrl || e.url || "";
    const prov = (e.provider?.name || "").toLowerCase();
    return isTikTokUrl(url) || prov === "tiktok";
}

function isSensitive(e: any): boolean {
    if (e.video && e.video.width === 0 && e.video.height === 0) return true;
    const t = (e.title || "").toLowerCase();
    if (t.includes("sensitive content")) return true;
    if (t.includes("зайди в tiktok")) return true;
    if ((e.thumbnail?.url || "").includes("tiktok-logo")) return true;
    return false;
}

function isPhotoUrl(url: string): boolean {
    return /\/photo\/\d+/.test(url);
}

// ─── Parsers (from original embed text) ──────────────────────────────
function parseName(title?: string): string | null {
    if (!title) return null;
    const m = title.match(/TikTok\s*[·•\-–]\s*(.+)/i);
    return m ? m[1].trim() : null;
}

function parseHandle(url?: string): string | null {
    if (!url) return null;
    const m = url.match(/@([^/?&#]+)/);
    return m ? `@${m[1]}` : null;
}

function parseBasicStats(desc?: string): { likes?: string; comments?: string } {
    if (!desc) return {};
    const nums = desc.match(/\d[\d.,]*\s*[KkMmBb]?/g);
    if (!nums) return {};
    const c = nums.map(n => n.trim()).filter(Boolean);
    return { likes: c[0], comments: c[1] };
}

// ─── Anti-loop ───────────────────────────────────────────────────────
let isOurDispatch = false;
const apiDone = new Set<string>();

function cleanupSet() {
    if (apiDone.size > 1000) {
        const arr = [...apiDone];
        arr.slice(0, 500).forEach(k => apiDone.delete(k));
    }
}

// ─── Format helpers ──────────────────────────────────────────────────
function fmtCount(v: number | null | undefined): string {
    if (v === null || v === undefined) return "0";
    if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(v);
}

function fmtDate(publish: any): string {
    if (!publish) return "";
    const raw = publish.iso || (publish.unix ? publish.unix * 1000 : null);
    if (!raw) return "";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function truncDesc(text: string | null | undefined, max: number): string {
    if (!text) return "";
    if (text.length <= max) return text;
    return text.slice(0, max).trimEnd() + "...";
}

function replaceTags(template: string, data: any): string {
    const stats = data.stats || {};
    const author = data.author || {};
    const desc = truncDesc(data.description, cfg("maxDescLength"));
    return template
        .replace(/\{likes\}/g, fmtCount(stats.likes))
        .replace(/\{comments\}/g, fmtCount(stats.comments))
        .replace(/\{shares\}/g, fmtCount(stats.shares))
        .replace(/\{views\}/g, fmtCount(stats.views))
        .replace(/\{saves\}/g, fmtCount(stats.saves))
        .replace(/\{description\}/g, desc)
        .replace(/\{author\}/g, author.nickname || "Unknown")
        .replace(/\{username\}/g, author.username ? `@${author.username}` : "@unknown");
}

// ═══════════════════════════════════════════════════════════════════════
// IN-PLACE EMBED MUTATION (always runs — guaranteed fallback)
// Only touches TEXT fields, preserves all media/proxy/internal data.
// ═══════════════════════════════════════════════════════════════════════

function mutateVideoSync(e: any): void {
    const url = e.rawUrl || e.url || "";
    const name = parseName(e.title);
    const handle = parseHandle(url);
    const stats = parseBasicStats(e.description);
    const statsLine = `❤️ ${stats.likes || "?"} 💬 ${stats.comments || "?"}`;
    const authorName = name || handle || "TikTok";

    e.color = cfg("embedColor");
    e.author = {
        name: name && handle ? `${name} (${handle})` : authorName,
        url: handle ? `https://tiktok.com/${handle}` : url,
    };
    e.description = statsLine;
    if ("rawDescription" in e) e.rawDescription = statsLine;
    e.footer = { text: cfg("pluginName") };
    e.title = undefined;
    if ("rawTitle" in e) e.rawTitle = undefined;
}

function mutatePhotoSync(e: any): void {
    const url = e.rawUrl || e.url || "";
    const name = parseName(e.title);
    const handle = parseHandle(url);
    const stats = parseBasicStats(e.description);
    const statsLine = `❤️ ${stats.likes || "?"} 💬 ${stats.comments || "?"}`;
    const authorName = name || handle || "TikTok";

    e.color = cfg("embedColor");
    e.author = {
        name: name && handle ? `${name} (${handle})` : authorName,
        url: handle ? `https://tiktok.com/${handle}` : url,
    };
    e.description = statsLine;
    if ("rawDescription" in e) e.rawDescription = statsLine;
    e.footer = { text: `${cfg("pluginName")} • 📷 Photo` };
    e.title = undefined;
    if ("rawTitle" in e) e.rawTitle = undefined;

    // Move thumbnail to image for full-width
    if (e.thumbnail && !e.image) {
        e.image = { ...e.thumbnail };
    }
}

function mutateSensitiveSync(e: any): void {
    if (cfg("sensitiveBypass")) {
        const url = e.rawUrl || e.url || "";
        const handle = parseHandle(url);

        e.color = cfg("embedColor");
        e.author = { name: handle || "TikTok", url: url };
        e.description = "⚠️ Sensitive Content (bypass)";
        if ("rawDescription" in e) e.rawDescription = e.description;
        e.footer = { text: `${cfg("pluginName")} • 18+` };
        e.title = undefined;
        if ("rawTitle" in e) e.rawTitle = undefined;

        if (e.video) { e.video.width = 720; e.video.height = 1280; }
        if (e.thumbnail && (e.thumbnail.url || "").includes("tiktok-logo")) {
            e.thumbnail = undefined;
        }
    } else {
        e.type = "rich";
        e.title = cfg("sensitiveTitle");
        if ("rawTitle" in e) e.rawTitle = e.title;
        e.description = cfg("sensitiveDesc");
        if ("rawDescription" in e) e.rawDescription = e.description;
        e.color = 16237824;
        e.footer = { text: `${cfg("pluginName")} • 18+` };
        e.author = undefined;
        e.thumbnail = undefined;
        e.video = undefined;
        e.image = undefined;
    }
}

// ─── Async API enhancement ───────────────────────────────────────────
async function fetchAndEnhance(
    url: string,
    channelId: string,
    messageId: string,
    originalClone: any,
    sensitive: boolean,
    photo: boolean,
): Promise<void> {
    const key = `${channelId}:${messageId}`;
    if (apiDone.has(key)) return;
    apiDone.add(key);
    cleanupSet();

    try {
        const apiUrl = `https://tiktok-api-discord.vercel.app/api/tiktok?url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!data || !data.ok) return;

        const e = originalClone;
        const author = data.author || {};
        const username = author.username || "unknown";
        const nickname = author.nickname || "Unknown";
        const pfp = author.avatar || null;
        const ts = fmtDate(data.publish);
        const plugin = cfg("pluginName");

        if (data.type === "sensitive" || data.sensitive) {
            if (!cfg("enableSensitive")) return;
            if (cfg("sensitiveBypass")) {
                e.color = cfg("embedColor");
                e.author = { name: `@${username}`, url: `https://tiktok.com/@${username}` };
                if (pfp) e.author.icon_url = pfp;
                e.description = "⚠️ Sensitive Content (bypass)";
                if ("rawDescription" in e) e.rawDescription = e.description;
                e.footer = { text: `${plugin} • 18+` };
                e.title = undefined;
                if ("rawTitle" in e) e.rawTitle = undefined;
                if (e.video) { e.video.width = 720; e.video.height = 1280; }
            } else {
                e.type = "rich";
                e.title = cfg("sensitiveTitle");
                if ("rawTitle" in e) e.rawTitle = e.title;
                e.description = cfg("sensitiveDesc");
                if ("rawDescription" in e) e.rawDescription = e.description;
                e.color = 16237824;
                e.footer = { text: `${plugin} • 18+` };
                e.author = undefined;
                e.thumbnail = undefined; e.video = undefined; e.image = undefined;
            }
        } else if (data.type === "photo") {
            if (!cfg("enablePhoto")) return;
            const total = data.media?.photoCount || 0;
            const range = total <= 4 ? `1 - ${total}` : `1 - 4 of ${total}`;
            e.color = cfg("embedColor");
            e.author = { name: `${nickname} (@${username})`, url: `https://tiktok.com/@${username}` };
            if (pfp) e.author.icon_url = pfp;
            e.description = replaceTags(cfg("photoDescLine"), data);
            if ("rawDescription" in e) e.rawDescription = e.description;
            e.footer = { text: `${plugin} • ${range} • ${ts}` };
            e.title = undefined;
            if ("rawTitle" in e) e.rawTitle = undefined;
            if (e.thumbnail && !e.image) e.image = { ...e.thumbnail };
        } else {
            if (!cfg("enableVideo")) return;
            e.color = cfg("embedColor");
            e.author = { name: `${nickname} (@${username})`, url: `https://tiktok.com/@${username}` };
            if (pfp) e.author.icon_url = pfp;
            e.description = replaceTags(cfg("videoDescLine"), data);
            if ("rawDescription" in e) e.rawDescription = e.description;
            e.footer = { text: `${plugin} • ${ts}` };
            e.title = undefined;
            if ("rawTitle" in e) e.rawTitle = undefined;
        }

        isOurDispatch = true;
        try {
            FluxDispatcher.dispatch({
                type: "MESSAGE_UPDATE",
                message: { id: messageId, channel_id: channelId, embeds: [e] },
            });
        } finally {
            isOurDispatch = false;
        }
    } catch {}
}

// ═══════════════════════════════════════════════════════════════════════
// EMBED COMPONENT DISCOVERY
// Try every possible way to find Discord's Embed renderer
// ═══════════════════════════════════════════════════════════════════════

export let embedDebugInfo = "Searching...";

function findEmbedModule(): any {
    // Method 1: findByName — try MANY possible names
    const names = [
        "Embed", "MessageEmbed", "EmbedCard", "EmbedWrapper",
        "EmbedContent", "EmbedBody", "EmbedRenderer", "EmbedView",
        "RichEmbed", "ChatEmbed", "EmbedPreview", "EmbedContainer",
        // Discord Client Design prefixed
        "DCDEmbed", "DCDChatEmbed", "DCDChatMessageEmbed",
        "DCDChatEmbedCard", "DCDMessageEmbed",
        // Chat / Message prefixed
        "ChatMessageEmbed", "MessageEmbedCard",
        "ChatCardEmbed", "MessageCard",
    ];

    for (const name of names) {
        try {
            const m = findByName(name, false);
            if (m?.default && typeof m.default === "function") {
                embedDebugInfo = `✅ Found via name: ${name}`;
                return m;
            }
        } catch {}
    }

    // Method 2: findByProps — look for modules with embed-related exports
    const propSets: string[][] = [
        ["renderEmbed"],
        ["EmbedContent"],
        ["embedWrapper"],
        ["renderRichEmbed"],
        ["getEmbedColor"],
        ["EmbedFooter"],
        ["EmbedAuthor"],
    ];
    for (const props of propSets) {
        try {
            const m = findByProps(...props);
            if (m?.default && typeof m.default === "function") {
                embedDebugInfo = `✅ Found via props: ${props.join(",")}`;
                return m;
            }
        } catch {}
    }

    // Method 3: find by predicate — search ALL modules
    try {
        const m = find((mod: any) => {
            const d = mod?.default;
            if (!d || typeof d !== "function") return false;
            const n = (d.displayName || d.name || "").toLowerCase();
            return n === "embed" || n === "messageembed" || n === "embedcard";
        });
        if (m) {
            const n = m.default?.displayName || m.default?.name || "?";
            embedDebugInfo = `✅ Found via find: ${n}`;
            return m;
        }
    } catch {}

    embedDebugInfo = "❌ Not found";
    return null;
}

// Discovery: scan ALL modules for embed-related names (for debug panel)
export function discoverEmbedModules(): string[] {
    const found: string[] = [];
    try {
        find((mod: any) => {
            if (!mod) return false;
            try {
                if (mod.default) {
                    const n = mod.default.displayName || mod.default.name || "";
                    if (n && /embed/i.test(n)) {
                        found.push(`${n} (default fn)`);
                    }
                }
                if (typeof mod === "object") {
                    for (const key of Object.keys(mod)) {
                        if (key === "default" || key === "__esModule") continue;
                        if (/embed/i.test(key)) {
                            const t = typeof mod[key];
                            found.push(`${key} (${t})`);
                        }
                    }
                }
            } catch {}
            return false; // Never match — just collect
        });
    } catch {}
    return [...new Set(found)].slice(0, 30);
}

// ─── Patch messages (FluxDispatcher) ─────────────────────────────────
let customRenderEnabled = false;

function patchMessage(msg: any) {
    try {
        if (!msg || !msg.embeds || !msg.embeds.length) return;
        if (!msg.id || !msg.channel_id) return;

        for (let i = 0; i < msg.embeds.length; i++) {
            const e = msg.embeds[i];
            if (!isTikTokEmbed(e)) continue;

            const url = e.rawUrl || e.url || "";
            if (!url) continue;

            const sensitive = isSensitive(e);
            const photo = isPhotoUrl(url);

            if (sensitive && !cfg("enableSensitive")) continue;
            if (photo && !cfg("enablePhoto")) continue;
            if (!sensitive && !photo && !cfg("enableVideo")) continue;

            // Deep clone BEFORE mutation (for async API enhancement)
            let originalClone: any;
            try { originalClone = JSON.parse(JSON.stringify(e)); }
            catch { originalClone = { ...e }; }

            // ★ ALWAYS mutate in-place — guaranteed visible change ★
            if (sensitive) {
                mutateSensitiveSync(e);
            } else if (photo) {
                mutatePhotoSync(e);
            } else {
                mutateVideoSync(e);
            }

            // Mark for custom rendering (if Embed component was patched)
            if (customRenderEnabled) {
                e._tiktok = true;
                e._tiktokUrl = url;
            }

            // Fire ONE async API call for accurate data
            const key = `${msg.channel_id}:${msg.id}`;
            if (!apiDone.has(key)) {
                fetchAndEnhance(url, msg.channel_id, msg.id, originalClone, sensitive, photo);
            }
        }
    } catch {}
}

// ─── Lifecycle ───────────────────────────────────────────────────────
let patches: (() => void)[] = [];

export default {
    onLoad: () => {
        // 1) ALWAYS patch FluxDispatcher — in-place mutation
        patches.push(
            before("dispatch", FluxDispatcher, ([ev]) => {
                if (isOurDispatch) return;
                try {
                    if (ev.type === "MESSAGE_CREATE" || ev.type === "MESSAGE_UPDATE") {
                        if (ev.message) patchMessage(ev.message);
                    }
                    if (ev.type === "LOAD_MESSAGES_SUCCESS" && Array.isArray(ev.messages)) {
                        for (const m of ev.messages) patchMessage(m);
                    }
                } catch {}
            })
        );

        // 2) TRY to find and patch Embed component (for custom rendering)
        try {
            const EmbedModule = findEmbedModule();
            if (EmbedModule?.default) {
                patches.push(
                    after("default", EmbedModule, (args: any[], ret: any) => {
                        try {
                            const embed = args?.[0]?.embed;
                            if (!embed?._tiktok || !embed?._tiktokUrl) return ret;
                            return React.createElement(TikTokEmbedView, { url: embed._tiktokUrl });
                        } catch {
                            return ret;
                        }
                    })
                );
                customRenderEnabled = true;
                embedDebugInfo += " (patched ✓)";
            }
        } catch {
            embedDebugInfo = "❌ Patching failed";
        }
    },

    onUnload: () => {
        for (const u of patches) u();
        patches = [];
        customRenderEnabled = false;
        apiDone.clear();
    },

    settings: Settings,
};