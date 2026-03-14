import { before } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";

let unpatch;

export function onLoad() {
    // Знаходимо модуль semanticColors
    const ThemeStore = findByProps("theme", "darkSidebar");
    const colors = findByProps("TEXT_DEFAULT", "TEXT_NORMAL");

    if (colors) {
        // Патчимо TEXT_DEFAULT якщо він резолвиться в чорний
        const origTextDefault = colors.TEXT_DEFAULT;
        
        unpatch = before("render", colors, () => {
            if (colors.TEXT_DEFAULT === "#000000" || colors.TEXT_DEFAULT === "#000") {
                colors.TEXT_DEFAULT = "#e0def4";
            }
        });
    }

    // Більш прямий підхід — патч через stylesheet
    const stylesheet = findByProps("createThemedStyleSheet");
    if (stylesheet) {
        unpatch = before("createThemedStyleSheet", stylesheet, ([styles]) => {
            for (const key in styles) {
                if (styles[key]?.color === "#000000" || styles[key]?.color === "#000") {
                    styles[key].color = "#e0def4";
                }
            }
        });
    }
}

export function onUnload() {
    unpatch?.();
}
