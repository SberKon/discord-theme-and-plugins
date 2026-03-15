import { findByProps } from "@vendetta/metro";
import { React, stylesheet } from "@vendetta/metro/common";
import { semanticColors } from "@vendetta/ui";
import type { MutableRefObject } from "react";
import { vstorage } from "..";
import getMessageLength, { display, hasSLM } from "../stuff/getMessageLength";
import type { ChatInputProps } from "../stuff/patcher";
import { useInput } from "./hooks/useInput";

const Text = findByProps("Text").Text;
const Reanimated = require("react-native-reanimated");

const styles = stylesheet.createThemedStyleSheet({
	container: {
		position: "absolute",
		right: 0,
		bottom: -8,
	},
	text: {
		fontSize: 12,
		fontWeight: "600",
	},
});

export default ({ inputProps }: { inputProps: MutableRefObject<ChatInputProps | undefined> }) => {
	const text = useInput(inputProps);

	const fade = Reanimated.useSharedValue(vstorage.minChars === 0 ? 1 : 0);

	const curLength = text.length,
		maxLength = getMessageLength();
	const extraMessages = hasSLM() ? Math.floor(curLength / maxLength) : 0;

	const actualLength = curLength - extraMessages * maxLength;
	const shouldAppear = curLength >= vstorage.minChars;

	React.useEffect(() => {
		fade.value = Reanimated.withTiming(shouldAppear ? 1 : 0, {
			duration: 100,
		});
	}, [shouldAppear]);

	return (
		<Reanimated.View
			style={[
				styles.container,
				{ opacity: fade.value },
			]}
		>
			<Text
				style={{
					...styles.text,
					color: actualLength <= maxLength
						? semanticColors.TEXT_MUTED
						: semanticColors.TEXT_FEEDBACK_CRITICAL,
				}}
			>
				{display(actualLength)}
			</Text>
		</Reanimated.View>
	);
};
