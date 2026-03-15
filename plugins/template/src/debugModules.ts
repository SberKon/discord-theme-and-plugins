import { logger } from "@vendetta";

export function debugModules() {
    try {
        const metro = require("@vendetta/metro");
        logger.log("Metro exports:", Object.keys(metro));
        
        const { getByStoreName } = metro;
        if (getByStoreName) {
            const stores = ["MessageStore", "ChannelStore", "UserStore"];
            stores.forEach(store => {
                try {
                    const result = getByStoreName(store);
                    logger.log(`${store}:`, result ? "found" : "not found");
                } catch (e) {
                    logger.warn(`${store} error:`, e.message);
                }
            });
        }
    } catch (e) {
        logger.warn("Metro debug failed:", e.message);
    }
}
