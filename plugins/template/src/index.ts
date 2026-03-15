import { logger } from "@vendetta";
import Settings from "./Settings";

// Нові імпорти
import patcher from "./stuff/patcher";
import { Patcher } from "@vendetta/patcher";
import { findByDisplayName, findByProps } from "@vendetta/metro";
import { isTikTokLink, convertToFixTikTok, TIKTOK_LINK_REGEX } from "./convert";

const PATCHES: Array<() => void> = [];

function tryPatchComponent(displayName: string) {
	try {
		const comp = findByDisplayName(displayName) as any;
		if (!comp) return false;

		// patch default export or the component itself
		const target = comp.default ? comp : comp;
		if (!target) return false;

		const unpatch = Patcher.before(displayName, target, "default" in target ? "default" as any : "render", (thisArg: any, args: any[]) => {
			// args[0] is usually props
			const props = args[0];
			if (!props) return;

			// Replace single embed url
			if (props.embed && typeof props.embed.url === "string" && isTikTokLink(props.embed.url)) {
				props.embed = { ...props.embed, url: convertToFixTikTok(props.embed.url) };
			}

			// Replace embeds array
			if (Array.isArray(props.embeds)) {
				props.embeds = props.embeds.map((e: any) => {
					if (e && typeof e.url === "string" && isTikTokLink(e.url)) {
						return { ...e, url: convertToFixTikTok(e.url) };
					}
					return e;
				});
			}

			// Replace link preview props e.g., props.url or props.link
			if (typeof props.url === "string" && isTikTokLink(props.url)) {
				props.url = convertToFixTikTok(props.url);
			}
			if (typeof props.link === "string" && isTikTokLink(props.link)) {
				props.link = convertToFixTikTok(props.link);
			}

			// If component receives raw children / text, inject a simple embed url fix by replacing tiktok links inside text.
			if (typeof props.children === "string") {
				props.children = props.children.replace(TIKTOK_LINK_REGEX, (m: string) => convertToFixTikTok(m));
			}
		});

		PATCHES.push(() => unpatch());
		logger.log(`[TikTokEmbedFix] patched ${displayName}`);
		return true;
	} catch (e) {
		logger.warn("[TikTokEmbedFix] patch failed", e);
		return false;
	}
}

export default {
	onLoad: () => {
		logger.log("TikTok Embed Fix: loading");

		 // register dispatcher patcher that injects embeds
		try {
			const unpatchDispatcher = patcher();
			PATCHES.push(unpatchDispatcher);
		} catch (e) {
			logger.warn("[TikTokEmbedFix] failed to start dispatcher patcher", e);
		}

		// Список кандидатів для патчингу - у вашій збірці можуть бути інші імена, додайте їх якщо потрібно
		const candidates = ["LinkPreview", "Preview", "Embed", "RichPreview", "MessageEmbed", "VideoEmbed"];

		for (const name of candidates) {
			tryPatchComponent(name);
		}

		// Фолбек: інколи компоненти мають інші імена — можна знайти за пропсами
		const fb = findByProps("LinkPreview", "default");
		if (fb) tryPatchComponent((fb as any).displayName || "LinkPreviewFallback");
	},
	onUnload: () => {
		logger.log("TikTok Embed Fix: unloading");
		for (const unpatch of PATCHES) {
			try { unpatch(); } catch {}
		}
		PATCHES.length = 0;
	},
	settings: Settings,
};