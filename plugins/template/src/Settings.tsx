import { Forms } from "@vendetta/ui/components";
const { FormText } = Forms;

export default () => (
    <FormText>
        This plugin rewrites TikTok embed URLs (vt.tiktok.com, vm.tiktok.com, www.tiktok.com, tiktok.com)
        into fixtiktok.com for local rendering in your client. Works only locally in this client.
    </FormText>
)