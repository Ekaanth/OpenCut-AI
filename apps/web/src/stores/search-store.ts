/**
 * Bridge between the action system and the Visual Search panel.
 *
 * The `find-similar-clips` action sets `pendingFindSimilarMediaId` and the
 * panel consumes it on the next render — letting a context-menu action drive
 * the panel without the action handler reaching into React.
 */

import { create } from "zustand";

interface SearchStore {
	pendingFindSimilarMediaId: string | null;
	requestFindSimilar: (mediaId: string) => void;
	consumeFindSimilar: () => string | null;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
	pendingFindSimilarMediaId: null,
	requestFindSimilar: (mediaId) => set({ pendingFindSimilarMediaId: mediaId }),
	consumeFindSimilar: () => {
		const id = get().pendingFindSimilarMediaId;
		if (id) set({ pendingFindSimilarMediaId: null });
		return id;
	},
}));
