import { logger } from "@vendetta";
import { findByProps } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";
import Settings from "./Settings";

function replaceTikTokLinks(text: string): string {
	if (!text || typeof text !== "string") return text;
	
	const replaced = text.replace(/https?:\/\/(vm|vt|www)\.tiktok\.com\/([^\s<>"{}|\\^`\[\]]*)/gi, (match) => {
		try {
			const url = new URL(match);
			const path = url.pathname + url.search;
			logger.log(`Replacing: ${match} -> https://fixtiktok.com${path}`);
			return `https://fixtiktok.com${path}`;
		} catch (e) {
			logger.warn("URL parse error:", match);
			return match;
		}
	});
	
	return replaced;
}

function processContent(content: any): any {
	if (typeof content === "string") {
		return replaceTikTokLinks(content);
	} else if (Array.isArray(content)) {
		return content.map(c => processContent(c));
	} else if (content && typeof content === "object") {
		for (const key in content) {
			if (typeof content[key] === "string") {
				content[key] = replaceTikTokLinks(content[key]);
			} else if (Array.isArray(content[key]) || typeof content[key] === "object") {
				processContent(content[key]);
			}
		}
	}
	return content;
}

let unpatch: (() => void) | null = null;

export default {
	onLoad: () => {
		logger.log("TikTok Embed Fix loaded!");
		
		try {
			const RowsModule = findByProps("processRenderableContent");
			
			if (RowsModule?.processRenderableContent) {
				logger.log("Found processRenderableContent");
				
				unpatch = instead(
					"processRenderableContent",
					RowsModule,
					(args, original) => {
						const result = original.apply(this, args);
						if (result?.rows) {
							logger.log("Processing rows...");
							for (const row of result.rows) {
								if (row?.message?.content) {
									row.message.content = replaceTikTokLinks(row.message.content);
								}
							}
						}
						return result;
					}
				);
			} else {
				logger.warn("processRenderableContent not found, trying MessageStore");
				const MessageStore = findByProps("getMessage");
				
				if (MessageStore?.getMessage) {
					unpatch = instead(
						"getMessage",
						MessageStore,
						(args, original) => {
							const result = original.apply(this, args);
							if (result?.content) {
								result.content = replaceTikTokLinks(result.content);
							}
							return result;
						}
					);
					logger.log("Patched getMessage");
				}
			}
		} catch (e) {
			logger.warn("TikTok Embed Fix patch failed:", e);
		}
	},
	onUnload: () => {
		logger.log("TikTok Embed Fix unloaded!");
		unpatch?.();
	},
	settings: Settings,
}