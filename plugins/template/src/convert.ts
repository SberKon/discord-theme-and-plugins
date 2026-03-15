export const TIKTOK_HOSTS = [
	"vt.tiktok.com",
	"vm.tiktok.com",
	"m.tiktok.com",
	"www.tiktok.com",
	"tiktok.com"
];

export function isTikTokLink(u: string) {
	try {
		const url = new URL(u);
		const host = url.hostname.toLowerCase();
		return TIKTOK_HOSTS.some(h => host === h || host.endsWith("." + h));
	} catch {
		return false;
	}
}

export function convertToFixTikTok(u: string) {
	try {
		const url = new URL(u);
		// keep path + query, replace hostname with fixtiktok.com and use https
		url.hostname = "fixtiktok.com";
		url.protocol = "https:";
		return url.toString();
	} catch {
		return u;
	}
}

// regex to find tiktok-like links inside plain message text (used if needed)
export const TIKTOK_LINK_REGEX = /(https?:\/\/(?:vt\.tiktok\.com|vm\.tiktok\.com|(?:www\.)?tiktok\.com)\/[^\s<>"'()]+)/gi;
