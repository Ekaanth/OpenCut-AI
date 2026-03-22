/**
 * Question card templates for podcast clip intros.
 *
 * These templates define how AI-generated topic questions are
 * rendered as animated title slides in short-form video clips.
 */

import type { CreateTextElement } from "@/types/timeline";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";

export interface QuestionCardTemplate {
	id: string;
	name: string;
	description: string;
	/** Background color — "transparent" for overlay-on-video */
	backgroundColor: string;
	backgroundEnabled: boolean;
	backgroundOpacity: number;
	/** Text color */
	textColor: string;
	/** Font size (in editor units) */
	fontSize: number;
	fontFamily: string;
	fontWeight: "normal" | "bold";
}

export const QUESTION_CARD_TEMPLATES: QuestionCardTemplate[] = [
	{
		id: "overlay",
		name: "Overlay (Transparent)",
		description: "Text over video with no background",
		backgroundColor: "transparent",
		backgroundEnabled: false,
		backgroundOpacity: 1,
		textColor: "#FFFFFF",
		fontSize: 10,
		fontFamily: "Inter",
		fontWeight: "bold",
	},
	{
		id: "overlay-dim",
		name: "Overlay (Dimmed)",
		description: "Text over video with semi-transparent dark backdrop",
		backgroundColor: "#000000",
		backgroundEnabled: true,
		backgroundOpacity: 0.5,
		textColor: "#FFFFFF",
		fontSize: 10,
		fontFamily: "Inter",
		fontWeight: "bold",
	},
	{
		id: "dark",
		name: "Dark Minimal",
		description: "Solid dark background",
		backgroundColor: "#0F172A",
		backgroundEnabled: true,
		backgroundOpacity: 0.9,
		textColor: "#F8FAFC",
		fontSize: 10,
		fontFamily: "Inter",
		fontWeight: "bold",
	},
	{
		id: "gradient",
		name: "Gradient Glow",
		description: "Deep indigo background",
		backgroundColor: "#1E1B4B",
		backgroundEnabled: true,
		backgroundOpacity: 0.9,
		textColor: "#E0E7FF",
		fontSize: 10,
		fontFamily: "Inter",
		fontWeight: "bold",
	},
	{
		id: "bold",
		name: "Bold Statement",
		description: "Red accent background",
		backgroundColor: "#DC2626",
		backgroundEnabled: true,
		backgroundOpacity: 0.85,
		textColor: "#FFFFFF",
		fontSize: 12,
		fontFamily: "Inter",
		fontWeight: "bold",
	},
	{
		id: "neon",
		name: "Neon Night",
		description: "Dark background with neon text",
		backgroundColor: "#0C0A09",
		backgroundEnabled: true,
		backgroundOpacity: 0.9,
		textColor: "#22D3EE",
		fontSize: 10,
		fontFamily: "Inter",
		fontWeight: "bold",
	},
];

export function getQuestionCardTemplate(themeId: string): QuestionCardTemplate {
	return (
		QUESTION_CARD_TEMPLATES.find((t) => t.id === themeId) ??
		QUESTION_CARD_TEMPLATES[0]
	);
}

/**
 * Build a text element for a question card.
 */
export function buildQuestionCardElement({
	question,
	startTime,
	duration = 2.5,
	theme = "overlay",
	emoji,
	useTransparentBackground,
}: {
	question: string;
	startTime: number;
	duration?: number;
	theme?: string;
	emoji?: string;
	/** Override: force transparent background regardless of template */
	useTransparentBackground?: boolean;
}): Omit<CreateTextElement, "type"> & { type: "text" } {
	const template = getQuestionCardTemplate(theme);
	const content = emoji ? `${emoji}\n${question}` : question;

	const forceTransparent = useTransparentBackground === true;
	const bgEnabled = forceTransparent ? false : template.backgroundEnabled;
	const bgColor = forceTransparent ? "transparent" : template.backgroundColor;

	return {
		...DEFAULT_TEXT_ELEMENT,
		type: "text",
		name: `Card: ${question.slice(0, 30)}`,
		content,
		fontSize: template.fontSize,
		fontFamily: template.fontFamily,
		fontWeight: template.fontWeight,
		color: template.textColor,
		textAlign: "center",
		startTime,
		duration,
		trimStart: 0,
		trimEnd: 0,
		background: {
			enabled: bgEnabled,
			color: bgColor,
			cornerRadius: bgEnabled ? 8 : 0,
			paddingX: bgEnabled ? 40 : 0,
			paddingY: bgEnabled ? 30 : 0,
			offsetX: 0,
			offsetY: 0,
		},
		opacity: template.backgroundOpacity,
		transform: {
			scale: 1,
			position: { x: 0, y: 0 },
			rotate: 0,
		},
	};
}
