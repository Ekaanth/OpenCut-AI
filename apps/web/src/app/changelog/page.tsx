import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/utils/ui";
import { allChangelogs } from "content-collections";

export const metadata: Metadata = {
	title: "Changelog - OpenCut",
	description: "Every update, improvement, and fix to OpenCut — documented.",
	openGraph: {
		title: "Changelog - OpenCut",
		description: "Every update, improvement, and fix to OpenCut — documented.",
		type: "website",
	},
};

const knownSectionOrder = ["new", "improved", "fixed", "breaking"];

const knownSectionTitles: Record<string, string> = {
	new: "Features",
	improved: "Improvements",
	fixed: "Fixes",
	breaking: "Breaking Changes",
};

function getSectionTitle(type: string): string {
	return (
		knownSectionTitles[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
	);
}

export default function ChangelogPage() {
	const releases = [...allChangelogs].sort((a, b) =>
		b.version.localeCompare(a.version, undefined, { numeric: true }),
	);

	return (
		<BasePage title="Changelog" description="See what's new in OpenCut">
			<div className="mx-auto w-full max-w-3xl">
				<div className="relative">
					<div
						aria-hidden
						className="absolute top-2 bottom-0 left-[5px] w-px bg-border hidden sm:block"
					/>

					<div className="flex flex-col">
						{releases.map((release, releaseIndex) => (
							<div key={release.version} className="flex flex-col">
								<ReleaseEntry release={release} />
								{releaseIndex < releases.length - 1 && (
									// ml-1.5 aligns with the center of the 11px timeline dot
									<Separator className="my-10 sm:ml-1.5" />
								)}
							</div>
						))}
					</div>
				</div>
			</div>
		</BasePage>
	);
}

type Change = { type: string; text: string };
type Release = (typeof allChangelogs)[number];

function groupAndOrderChanges({ changes }: { changes: Change[] }) {
	const grouped = changes.reduce<Record<string, Change[]>>((acc, change) => {
		if (!acc[change.type]) {
			acc[change.type] = [];
		}
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

function ReleaseEntry({ release }: { release: Release }) {
	const { grouped: groupedChanges, orderedTypes } = groupAndOrderChanges({
		changes: release.changes,
	});

	return (
		<article className="relative sm:pl-10">
			<div aria-hidden className="absolute left-0 top-[3px] hidden sm:block">
				<div
					className={cn(
						"size-[11px] rounded-full border-[1.5px]",
						release.isLatest
							? "border-foreground bg-foreground"
							: "border-muted-foreground/30 bg-background",
					)}
				/>
			</div>

			<div className="flex flex-col gap-5">
				<div className="flex items-center gap-2.5 flex-wrap">
					<span className="text-sm font-medium tracking-widest text-muted-foreground">
						{release.version} - {release.date}
					</span>
				</div>

				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold tracking-tight">{release.title}</h2>
					{release.description && (
						<p className="text-base text-foreground leading-relaxed max-w-xl">
							{release.description}
						</p>
					)}
				</div>

				<div className="flex flex-col gap-4">
					{orderedTypes.map((type) => (
						<div key={type} className="flex flex-col gap-1.5">
							<h3 className="text-base font-semibold text-foreground">
								{getSectionTitle(type)}:
							</h3>
							<ul className="list-disc pl-5 space-y-1.5">
								{groupedChanges[type].map((change) => (
									<li
										key={change.text}
										className="text-base text-foreground leading-relaxed"
									>
										{change.text}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>
		</article>
	);
}
