import { allChangelogs } from "content-collections";

export type Change = { type: string; text: string };
export type Release = (typeof allChangelogs)[number];

const knownSectionOrder = ["new", "improved", "fixed", "breaking"];

const knownSectionTitles: Record<string, string> = {
	new: "Features",
	improved: "Improvements",
	fixed: "Fixes",
	breaking: "Breaking Changes",
};

export function getSectionTitle(type: string): string {
	return (
		knownSectionTitles[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
	);
}

export function groupAndOrderChanges({ changes }: { changes: Change[] }) {
	const grouped = changes.reduce<Record<string, Change[]>>((acc, change) => {
		if (!acc[change.type]) acc[change.type] = [];
		acc[change.type].push(change);
		return acc;
	}, {});

	const customTypes = Object.keys(grouped).filter(
		(type) => !knownSectionOrder.includes(type),
	);
	const orderedTypes = [
		...knownSectionOrder.filter((type) => grouped[type]?.length > 0),
		...customTypes,
	];

	return { grouped, orderedTypes };
}

export function getSortedReleases() {
	return [...allChangelogs].sort((a, b) =>
		b.version.localeCompare(a.version, undefined, { numeric: true }),
	);
}
