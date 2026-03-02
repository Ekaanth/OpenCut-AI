import { create } from "zustand";

interface ClipEffectsTarget {
	elementId: string;
	trackId: string;
}

interface PropertiesState {
	clipEffectsTarget: ClipEffectsTarget | null;
	openClipEffects: ({ elementId, trackId }: ClipEffectsTarget) => void;
	closeClipEffects: () => void;
}

export const usePropertiesStore = create<PropertiesState>()((set) => ({
	clipEffectsTarget: null,
	openClipEffects: ({ elementId, trackId }) =>
		set({ clipEffectsTarget: { elementId, trackId } }),
	closeClipEffects: () => set({ clipEffectsTarget: null }),
}));
