import { findByProps } from "@vendetta/metro";
import { React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { semanticColors } from "@vendetta/ui";
import type { MutableRefObject } from "react";
import { vstorage } from "..";
import getMessageLength, { display, hasSLM } from "../stuff/getMessageLength";
import type { ChatInputProps } from "../stuff/patcher";
import { useInput } from "./hooks/useInput";

const Text = findByProps("Text").Text;
const Reanimated = require("react-native-reanimated");

const xsFontSize = 12;
const styles = stylesheet.createThemedStyleSheet({
	androidRipple: {
		color: semanticColors.ANDROID_RIPPLE,
		cornerRadius: 8,
	} as any,
	container: {
		backgroundColor: semanticColors.BACKGROUND_SECONDARY_ALT,
		borderRadius: 8,
		marginRight: 8,
		marginTop: -12,
		paddingHorizontal: 8,
		paddingVertical: 8,
	},
	text: {
		color: semanticColors.TEXT_NORMAL,
		fontSize: 12,
		fontWeight: "600",
		textAlign: "right",
	},
	extraMessagesCircle: {
		backgroundColor: semanticColors.REDESIGN_BUTTON_PRIMARY_BACKGROUND,
		borderRadius: 2147483647,
		position: "absolute",
		left: 0,
		top: 0,
		transform: [
			{
				translateX: -xsFontSize,
			},
			{
				translateY: -xsFontSize,
			},
		],
		minWidth: xsFontSize * 2,
		height: xsFontSize * 2,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 2,
	},
});

const { useChatInputContainerHeight } = findByProps("useChatInputContainerHeight");

export default ({ inputProps }: { inputProps: MutableRefObject<ChatInputProps | undefined> }) => {
	const [isToggled, setIsToggled] = React.useState(false);
	const text = useInput(inputProps);

	const height = useChatInputContainerHeight();

	const fade = Reanimated.useSharedValue(vstorage.minChars === 0 ? 1 : 0);
	const fadeExtra = Reanimated.useSharedValue(0);

	const curLength = text.length,
		maxLength = getMessageLength();
	const extraMessages = hasSLM() ? Math.floor(curLength / maxLength) : 0;

	const actualLength = curLength - extraMessages * maxLength;
	const shouldAppear = curLength >= (vstorage.minChars ?? 1);

	React.useEffect(() => {
		fade.value = Reanimated.withTiming(
			shouldAppear ? (isToggled ? 0.3 : 1) : 0,
			{ duration: 100 },
		);
		fadeExtra.value = Reanimated.withTiming(extraMessages > 0 ? 1 : 0, {
			duration: 100,
		});
	}, [shouldAppear, isToggled, extraMessages]);

	return (
		<Reanimated.View
			style={[
				{
					flexDirection: "row-reverse",
					position: "absolute",
					right: 0,
					bottom: height + 8,
					zIndex: 1,
					opacity: fade.value,
				},
			]}
		>
			<RN.Pressable
				android_ripple={styles.androidRipple}
				style={styles.container}
				pointerEvents={shouldAppear ? "box-only" : "none"}
				onPress={shouldAppear
					? () => {
						setIsToggled(!isToggled);
					}
					: undefined}
			>
				<Reanimated.View
					style={[
						styles.extraMessagesCircle,
						{ opacity: fadeExtra.value },
					]}
				>
					<Text style={{ ...styles.text, paddingHorizontal: xsFontSize / 2, color: semanticColors.TEXT_DEFAULT }}>
						{extraMessages}
					</Text>
				</Reanimated.View>
				<Text
					style={{
						...styles.text,
						color: actualLength <= maxLength
							? semanticColors.TEXT_NORMAL
							: semanticColors.TEXT_FEEDBACK_CRITICAL,
					}}
				>
					{display(actualLength)}
				</Text>
			</RN.Pressable>
		</Reanimated.View>
	);
};
