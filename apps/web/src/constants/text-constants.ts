import type { TextElement } from "@/types/timeline";
import { TIMELINE_CONSTANTS } from "./timeline-constants";

export const DEFAULT_TEXT_ELEMENT: Omit<TextElement, "id"> = {
	type: "text",
	name: "Text",
	content: "Default Text",
	fontSize: 48,
	fontFamily: "Arial",
	color: "#ffffff",
	backgroundColor: "transparent",
	textAlign: "center",
	fontWeight: "normal",
	fontStyle: "normal",
	textDecoration: "none",
	duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
	startTime: 0,
	trimStart: 0,
	trimEnd: 0,
	transform: {
		scale: 1,
		position: {
			x: 0,
			y: 0,
		},
		rotate: 0,
	},
	opacity: 1,
};
