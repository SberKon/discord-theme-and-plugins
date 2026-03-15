import { logger } from "@vendetta";
import { patcher } from "@vendetta/ui";
import Settings from "./Settings";

const TIKTOK_REGEX = /https?:\/\/(vm|vt|www)\.tiktok\.com\/([^\s<>"{}|\\^`\[\]]*)/gi;

function getTikTokFixUrl(url) {
    try {
        const tiktokUrl = new URL(url);
        const path = tiktokUrl.pathname + tiktokUrl.search;
        return `https://fixtiktok.com${path}`;
    } catch {
        return url;
    }
}

let unpatch;

export default {
    onLoad: () => {
        logger.log("TikTok Embed Fix loaded!");
        
        try {
            // Get the message component
            const { getByStoreName } = require("@vendetta/metro");
            const MessageStore = getByStoreName?.("MessageStore");
            
            if (!MessageStore) {
                throw new Error("MessageStore not found");
            }
            
            // Patch getMessage to transform TikTok links
            unpatch = patcher.instead(
                MessageStore,
                "getMessage",
                function(args, original) {
                    const result = original.apply(this, args);
                    
                    if (result?.embeds && Array.isArray(result.embeds)) {
                        result.embeds = result.embeds.map(embed => {
                            if (embed?.url) {
                                const match = embed.url.match(/https?:\/\/(vm|vt|www)\.tiktok\.com\//);
                                if (match) {
                                    return {
                                        ...embed,
                                        url: getTikTokFixUrl(embed.url),
                                        original_url: embed.url,
                                    };
                                }
                            }
                            return embed;
                        });
                    }
                    
                    // Also fix links in content
                    if (result?.content) {
                        result.content = result.content.replace(TIKTOK_REGEX, getTikTokFixUrl);
                    }
                    
                    return result;
                }
            );
            
            logger.log("TikTok Embed Fix patches applied");
        } catch (e) {
            logger.warn("Failed to apply patches:", e.message);
        }
    },
    
    onUnload: () => {
        logger.log("TikTok Embed Fix unloaded!");
        unpatch?.();
    },
    
    settings: Settings,
}