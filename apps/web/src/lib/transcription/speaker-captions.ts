import type { TranscriptionSegment } from "@/types/ai";

export const SPEAKER_COLORS: Record<string, string> = {
	"0": "#FF6B6B",
	"1": "#4ECDC4",
	"2": "#FFE66D",
	"3": "#A8E6CF",
	"4": "#DDA0DD",
	"5": "#87CEEB",
	"6": "#FFA07A",
	"7": "#98D8C8",
	"8": "#F7DC6F",
	"9": "#BB8FCE",
};

export const SPEAKER_COLORS_ARRAY = Object.values(SPEAKER_COLORS);

export function getSpeakerColor(speakerIndex: number): string {
	return SPEAKER_COLORS[String(speakerIndex % SPEAKER_COLORS_ARRAY.length)];
}

export function getSpeakerLabel(speaker: string | undefined, index: number): string {
	if (!speaker) return `Speaker ${index + 1}`;
	const match = speaker.match(/\d+/);
	const num = match ? parseInt(match[0], 10) : index;
	return `Speaker ${num + 1}`;
}

export interface SpeakerCaptionSegment {
	speaker: string;
	speakerIndex: number;
	speakerLabel: string;
	speakerColor: string;
	text: string;
	start: number;
	end: number;
	words: Array<{
		word: string;
		start: number;
		end: number;
	}>;
}

export function buildSpeakerCaptionSegments(
	segments: TranscriptionSegment[],
	speakerNames?: Record<string, string>,
): SpeakerCaptionSegment[] {
	const seenSpeakers = new Map<string, number>();
	let speakerCounter = 0;

	return segments.map((seg) => {
		const speaker = seg.speaker ?? "unknown";
		if (!seenSpeakers.has(speaker)) {
			seenSpeakers.set(speaker, speakerCounter);
			speakerCounter++;
		}
		const speakerIndex = seenSpeakers.get(speaker)!;
		const rawLabel = getSpeakerLabel(speaker, speakerIndex);
		const customLabel = speakerNames?.[speaker];

		return {
			speaker,
			speakerIndex,
			speakerLabel: customLabel ?? rawLabel,
			speakerColor: getSpeakerColor(speakerIndex),
			text: seg.text,
			start: seg.start,
			end: seg.end,
			words: seg.words.map((w) => ({
				word: w.word,
				start: w.start,
				end: w.end,
			})),
		};
	});
}
