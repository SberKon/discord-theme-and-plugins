import { logger } from "@vendetta";
import { findByProps } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";
import Settings from "./Settings";

const HTTP_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
const invisibleChar = "\x00";

function replaceTikTokLinks(text: string): string {
	if (!text || typeof text !== "string") return text;
	
	return text.replace(/https?:\/\/(vm|vt|www)\.tiktok\.com\/([^\s<>"{}|\\^`\[\]]*)/gi, (match) => {
		try {
			const url = new URL(match);
			const path = url.pathname + url.search;
			return `https://fixtiktok.com${path}`;
		} catch {
			return match;
		}
	});
}

function processRows(rows: any[]) {
	for (const row of rows) {
		if (row?.message?.content && typeof row.message.content === "string") {
			const originalContent = row.message.content;
			const modifiedContent = replaceTikTokLinks(originalContent);
			
			if (originalContent !== modifiedContent) {
				row.message.content = modifiedContent;
				logger.log("TikTok link replaced in message");
			}
		}
	}
}

let unpatch: (() => void) | null = null;

export default {
	onLoad: () => {
		logger.log("TikTok Embed Fix loaded!");
		
		try {
			const { MessagesHandlers } = findByProps("MessagesHandlers");
			
			if (MessagesHandlers) {
				unpatch = instead(
					"renderRows",
					MessagesHandlers.prototype,
					(args, original) => {
						const rows = args[0];
						if (Array.isArray(rows)) {
							processRows(rows);
						}
						return original.apply(this, args);
					}
				);
				logger.log("TikTok Embed Fix patched successfully");
			}
		} catch (e) {
			logger.warn("Failed to patch MessagesHandlers:", e);
		}
	},
	onUnload: () => {
		logger.log("TikTok Embed Fix unloaded!");
		unpatch?.();
	},
	settings: Settings,
}
