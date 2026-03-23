import { FluxDispatcher } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";
import Settings from "./Settings";

const TIKTOK_DOMAINS = [
    "tiktok.com",
    "www.tiktok.com",
    "vt.tiktok.com",
    "vm.tiktok.com",
    "m.tiktok.com",
];

/**
 * Check if a URL belongs to TikTok
 */
function isTikTokUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return TIKTOK_DOMAINS.some(
            (domain) => parsed.hostname.toLowerCase() === domain
        );
    } catch {
        return false;
    }
}

/**
 * Replace tiktok.com with tiktokez.com in a URL string
 */
function fixTikTokUrl(url: string): string {
    return url.replace(/tiktok\.com/gi, "tiktokez.com");
}

/**
 * Patch embeds in a message: for any TikTok embed,
 * swap domain to tiktokez.com so Discord fetches a proper embed.
 */
function patchMessageEmbeds(message: any) {
    if (!message?.embeds?.length) return;

    for (let i = 0; i < message.embeds.length; i++) {
        const embed = message.embeds[i];

        // Check if this embed is from TikTok by its URL or provider
        const embedUrl = embed.url || "";
        const providerName = embed.provider?.name?.toLowerCase() || "";
        const isTikTok =
            isTikTokUrl(embedUrl) || providerName.includes("tiktok");

        if (!isTikTok) continue;

        // Clone the embed so we don't mutate cached objects
        const fixed = { ...embed };

        // Fix the main embed URL
        if (fixed.url) {
            fixed.url = fixTikTokUrl(fixed.url);
        }

        // Fix thumbnail URL
        if (fixed.thumbnail?.url) {
            fixed.thumbnail = {
                ...fixed.thumbnail,
                url: fixTikTokUrl(fixed.thumbnail.url),
            };
            if (fixed.thumbnail.proxyURL) {
                fixed.thumbnail.proxyURL = fixTikTokUrl(
                    fixed.thumbnail.proxyURL
                );
            }
        }

        // Fix video URL
        if (fixed.video?.url) {
            fixed.video = {
                ...fixed.video,
                url: fixTikTokUrl(fixed.video.url),
            };
            if (fixed.video.proxyURL) {
                fixed.video.proxyURL = fixTikTokUrl(fixed.video.proxyURL);
            }
        }

        // Fix provider URL
        if (fixed.provider?.url) {
            fixed.provider = {
                ...fixed.provider,
                url: fixTikTokUrl(fixed.provider.url),
            };
        }

        message.embeds[i] = fixed;
    }
}

let patches: (() => void)[] = [];

export default {
    onLoad: () => {
        // Patch MESSAGE_CREATE — new messages coming in
        patches.push(
            before("dispatch", FluxDispatcher, ([event]) => {
                if (
                    event.type === "MESSAGE_CREATE" ||
                    event.type === "MESSAGE_UPDATE"
                ) {
                    if (event.message) {
                        patchMessageEmbeds(event.message);
                    }
                }

                // Also patch bulk message loads (opening a channel / scrolling)
                if (event.type === "LOAD_MESSAGES_SUCCESS") {
                    if (Array.isArray(event.messages)) {
                        for (const msg of event.messages) {
                            patchMessageEmbeds(msg);
                        }
                    }
                }
            })
        );
    },
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch();
        }
        patches = [];
    },
    settings: Settings,
};