import { Forms, General } from "@vendetta/ui/components";
import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";

const { FormSection, FormRow, FormSwitch, FormInput, FormDivider, FormText } = Forms;
const { ScrollView } = General;

const COLOR_PRESETS = [
    { name: "💜 Purple (tnktok)", value: 6513919, hex: "#635BFF" },
    { name: "❤️ Red (fixtiktok)", value: 16711760, hex: "#FF0050" },
    { name: "💗 Pink (TikTok)", value: 16657493, hex: "#FE2C55" },
    { name: "💙 Blue", value: 3447003, hex: "#3498DB" },
    { name: "💚 Green", value: 5763719, hex: "#57F287" },
    { name: "🤍 White", value: 16777215, hex: "#FFFFFF" },
    { name: "🖤 Dark", value: 2303786, hex: "#2326AA" },
];

const SENSITIVE_MODES = [
    { label: "📹 Show as normal video", value: "normal" },
    { label: "⚠️ Show warning", value: "warn" },
    { label: "🚫 Hide completely", value: "hide" },
];

const FOOTER_PRESETS = ["TikTok", "fxTikTok", "TikTok Embed Fix", "🎵 TikTok"];

export default () => {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

    // Defaults
    if (storage.embedColor === undefined) storage.embedColor = 6513919;
    if (storage.footerText === undefined) storage.footerText = "TikTok";
    if (storage.showFooter === undefined) storage.showFooter = true;
    if (storage.showAuthor === undefined) storage.showAuthor = true;
    if (storage.showStats === undefined) storage.showStats = true;
    if (storage.sensitiveMode === undefined) storage.sensitiveMode = "normal";

    const color = storage.embedColor as number;
    const colorPreset = COLOR_PRESETS.find((p) => p.value === color);
    const colorHex = `#${color.toString(16).padStart(6, "0").toUpperCase()}`;

    const sensMode = storage.sensitiveMode as string;
    const sensLabel = SENSITIVE_MODES.find((m) => m.value === sensMode);

    return (
        <ScrollView>
            {/* ── Appearance ── */}
            <FormSection title="Embed Appearance">
                <FormRow
                    label="Show Author"
                    subLabel="Author name and @handle at the top"
                    trailing={
                        <FormSwitch
                            value={storage.showAuthor !== false}
                            onValueChange={(v: boolean) => {
                                storage.showAuthor = v;
                                forceUpdate();
                            }}
                        />
                    }
                />
                <FormDivider />

                <FormRow
                    label="Show Stats"
                    subLabel="❤️ likes  💬 comments"
                    trailing={
                        <FormSwitch
                            value={storage.showStats !== false}
                            onValueChange={(v: boolean) => {
                                storage.showStats = v;
                                forceUpdate();
                            }}
                        />
                    }
                />
                <FormDivider />

                <FormRow
                    label="Show Footer"
                    subLabel="Text at the bottom of the embed"
                    trailing={
                        <FormSwitch
                            value={storage.showFooter !== false}
                            onValueChange={(v: boolean) => {
                                storage.showFooter = v;
                                forceUpdate();
                            }}
                        />
                    }
                />
                <FormDivider />

                <FormRow
                    label="Footer Text"
                    subLabel={`Current: "${storage.footerText || "TikTok"}"`}
                    onPress={() => {
                        const cur = (storage.footerText as string) || "TikTok";
                        const idx = FOOTER_PRESETS.indexOf(cur);
                        storage.footerText =
                            FOOTER_PRESETS[(idx + 1) % FOOTER_PRESETS.length];
                        forceUpdate();
                    }}
                />
                <FormDivider />

                <FormRow
                    label="Embed Color"
                    subLabel={`${colorPreset?.name || "Custom"} — ${colorHex}`}
                    onPress={() => {
                        const idx = COLOR_PRESETS.findIndex((p) => p.value === color);
                        const next = COLOR_PRESETS[(idx + 1) % COLOR_PRESETS.length];
                        storage.embedColor = next.value;
                        forceUpdate();
                    }}
                />
            </FormSection>

            {/* ── Sensitive Content ── */}
            <FormSection title="Sensitive Content (18+)">
                <FormRow
                    label="Sensitive Mode"
                    subLabel={sensLabel?.label || "Unknown"}
                    onPress={() => {
                        const idx = SENSITIVE_MODES.findIndex((m) => m.value === sensMode);
                        const next = SENSITIVE_MODES[(idx + 1) % SENSITIVE_MODES.length];
                        storage.sensitiveMode = next.value;
                        forceUpdate();
                    }}
                />
                <FormDivider />
                <FormText style={{ padding: 12, opacity: 0.5, fontSize: 12 }}>
                    Tap to cycle. "Show as normal video" forces the player
                    with full dimensions so age-restricted content can play.
                </FormText>
            </FormSection>

            {/* ── About ── */}
            <FormSection title="About">
                <FormText style={{ padding: 12, opacity: 0.6 }}>
                    TikTok Embed Fix • Transforms embeds into styled cards.
                    {"\n"}Links are never modified.
                </FormText>
            </FormSection>
        </ScrollView>
    );
};