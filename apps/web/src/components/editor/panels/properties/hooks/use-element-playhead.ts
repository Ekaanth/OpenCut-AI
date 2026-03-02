import { useEditor } from "@/hooks/use-editor";
import { getElementLocalTime } from "@/lib/animation";
import { TIME_EPSILON_SECONDS } from "@/constants/animation-constants";

export function useElementPlayhead({
	startTime,
	duration,
}: {
	startTime: number;
	duration: number;
}) {
	const editor = useEditor();
	const playheadTime = editor.playback.getCurrentTime();
	const localTime = getElementLocalTime({
		timelineTime: playheadTime,
		elementStartTime: startTime,
		elementDuration: duration,
	});
	const isPlayheadWithinElementRange =
		playheadTime >= startTime - TIME_EPSILON_SECONDS &&
		playheadTime <= startTime + duration + TIME_EPSILON_SECONDS;

	return { localTime, isPlayheadWithinElementRange };
}
