import type { EditorCore } from "@/core";
import type { SelectedKeyframeRef } from "@/types/animation";

type ElementRef = { trackId: string; elementId: string };

export class SelectionManager {
	private selectedElements: ElementRef[] = [];
	private selectedKeyframes: SelectedKeyframeRef[] = [];
	private keyframeSelectionAnchor: SelectedKeyframeRef | null = null;
	private listeners = new Set<() => void>();

	constructor(editor: EditorCore) {
		void editor;
	}

	getSelectedElements(): ElementRef[] {
		return this.selectedElements;
	}

	getSelectedKeyframes(): SelectedKeyframeRef[] {
		return this.selectedKeyframes;
	}

	getKeyframeSelectionAnchor(): SelectedKeyframeRef | null {
		return this.keyframeSelectionAnchor;
	}

	setSelectedElements({ elements }: { elements: ElementRef[] }): void {
		this.selectedElements = elements;
		this.selectedKeyframes = [];
		this.keyframeSelectionAnchor = null;
		this.notify();
	}

	setSelectedKeyframes({
		keyframes,
		anchorKeyframe,
	}: {
		keyframes: SelectedKeyframeRef[];
		anchorKeyframe?: SelectedKeyframeRef | null;
	}): void {
		this.selectedKeyframes = keyframes;
		if (anchorKeyframe !== undefined) {
			this.keyframeSelectionAnchor = anchorKeyframe;
		} else if (keyframes.length === 0) {
			this.keyframeSelectionAnchor = null;
		}
		this.notify();
	}

	clearSelection(): void {
		this.selectedElements = [];
		this.selectedKeyframes = [];
		this.keyframeSelectionAnchor = null;
		this.notify();
	}

	clearKeyframeSelection(): void {
		this.selectedKeyframes = [];
		this.keyframeSelectionAnchor = null;
		this.notify();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}
