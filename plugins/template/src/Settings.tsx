import { Forms } from "@vendetta/ui/components";
import { React } from "@vendetta/metro/common";

const { FormSection, FormText, FormDivider } = Forms;

export default () => (
    <FormSection title="TikTok Embed Fix">
        <FormText>
            Fixes broken TikTok embeds by routing them through tiktokez.com for
            proper video previews.
        </FormText>
        <FormDivider />
        <FormText>
            • Works on all messages (yours and others'){"\n"}
            • Visual only — original links stay unchanged{"\n"}
            • Supports vt.tiktok.com, vm.tiktok.com, www.tiktok.com
        </FormText>
    </FormSection>
);