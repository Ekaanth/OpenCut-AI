"use client";

import { useParams } from "next/navigation";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import { AssetsPanel } from "@/components/editor/panels/assets";
import { Timeline } from "@/components/editor/panels/timeline";
import { PreviewPanel } from "@/components/editor/panels/preview";
import { EditorHeader } from "@/components/editor/editor-header";
import { EditorProvider } from "@/components/providers/editor-provider";
import { Onboarding } from "@/components/editor/onboarding";
import { MigrationDialog } from "@/components/editor/dialogs/migration-dialog";
import { usePanelStore } from "@/stores/panel-store";
import { usePasteMedia } from "@/hooks/use-paste-media";
import { MobileGate } from "@/components/editor/mobile-gate";
import { AIPanelWrapper } from "@/components/editor/ai/ai-panel-wrapper";
import { QuickActionsBar } from "@/components/editor/ai/quick-actions-bar";
import { EmptyEditorGuide } from "@/components/editor/empty-editor-guide";
import { RightPanel } from "@/components/editor/panels/right-panel";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useEditor } from "@/hooks/use-editor";
import { useTranscribePrompt } from "@/hooks/use-transcribe-prompt";
import { useEffect, useRef } from "react";
import type { TextElement } from "@/types/timeline";
import { BackgroundTasksWidget } from "@/components/editor/background-tasks";

export default function Editor() {
	const params = useParams();
	const projectId = params.project_id as string;

	return (
		<MobileGate>
			<EditorProvider projectId={projectId}>
				<div className="bg-background flex h-screen w-screen flex-col overflow-hidden">
					<EditorHeader />
					<div className="min-h-0 min-w-0 flex-1">
						<EditorLayout />
					</div>
					<AIPanelWrapper />
					<Onboarding />
					<MigrationDialog />
					<BackgroundTasksWidget />
				</div>
			</EditorProvider>
		</MobileGate>
	);
}

function EditorLayout() {
	usePasteMedia();
	useTranscribePrompt();
	const { panels, setPanel } = usePanelStore();
	const transcriptSegments = useTranscriptStore((s) => s.segments);
	const isTranscribing = useTranscriptStore((s) => s.isTranscribing);
	const editor = useEditor();
	const hasTimelineContent = editor.timeline.getTracks().some(
		(track) => track.elements.length > 0,
	);
	const hasMedia = editor.timeline.getTracks().some(
		(t) =>
			(t.type === "video" || t.type === "audio") &&
			t.elements.length > 0,
	);
	const hasTranscript = hasMedia && (transcriptSegments.length > 0 || isTranscribing);

	// Restore transcript from existing caption text elements on the timeline
	const hasRestoredTranscript = useRef(false);
	useEffect(() => {
		if (hasRestoredTranscript.current) return;
		const storeSegments = useTranscriptStore.getState().segments;
		if (storeSegments.length > 0) return;

		const tracks = editor.timeline.getTracks();

		// Only restore if there's actually a video/audio on the timeline
		const hasMedia = tracks.some(
			(t) =>
				(t.type === "video" || t.type === "audio") &&
				t.elements.length > 0,
		);
		if (!hasMedia) return;

		const textTrack = tracks.find(
			(t) => t.type === "text" && t.elements.length > 0,
		);
		if (!textTrack) return;

		// Sort text elements by startTime
		const sortedElements = [...textTrack.elements]
			.sort((a, b) => a.startTime - b.startTime);

		if (sortedElements.length === 0) return;

		const segments = sortedElements.map((el, index) => {
			const textEl = el as TextElement;
			const text = textEl.content || textEl.name || "";
			const start = el.startTime;
			const end = el.startTime + el.duration;
			const segWords = text.trim().split(/\s+/).filter(Boolean);
			const segDuration = end - start;
			const wordDuration = segWords.length > 0 ? segDuration / segWords.length : segDuration;

			return {
				id: index,
				text,
				start,
				end,
				words: segWords.map((word, wordIndex) => ({
					word,
					start: start + wordIndex * wordDuration,
					end: start + (wordIndex + 1) * wordDuration,
					confidence: 0.9,
				})),
			};
		});

		if (segments.length > 0) {
			hasRestoredTranscript.current = true;
			useTranscriptStore.getState().setSegments(segments);
		}
	}, [editor]);

	// Clear transcript when all video/audio elements are removed (any deletion path)
	useEffect(() => {
		return editor.timeline.subscribe(() => {
			const { segments } = useTranscriptStore.getState();
			if (segments.length === 0) return;

			const tracks = editor.timeline.getTracks();
			const hasMedia = tracks.some(
				(t) =>
					(t.type === "video" || t.type === "audio") &&
					t.elements.length > 0,
			);
			if (!hasMedia) {
				useTranscriptStore.getState().reset();
			}
		});
	}, [editor]);

	return (
		<ResizablePanelGroup
			direction="vertical"
			className="size-full gap-[0.18rem]"
			onLayout={(sizes) => {
				setPanel("mainContent", sizes[0] ?? panels.mainContent);
				setPanel("timeline", sizes[1] ?? panels.timeline);
			}}
		>
			<ResizablePanel
				defaultSize={panels.mainContent}
				minSize={30}
				maxSize={85}
				className="min-h-0"
			>
				<ResizablePanelGroup
					direction="horizontal"
					className="size-full gap-[0.19rem] px-3"
					onLayout={(sizes) => {
						setPanel("tools", sizes[0] ?? panels.tools);
						setPanel("preview", sizes[1] ?? panels.preview);
						setPanel("properties", sizes[2] ?? panels.properties);
					}}
				>
					<ResizablePanel
						defaultSize={panels.tools}
						minSize={15}
						maxSize={40}
						className="min-w-0"
					>
						<AssetsPanel />
					</ResizablePanel>

					<ResizableHandle withHandle />

					<ResizablePanel
						defaultSize={panels.preview}
						minSize={30}
						className="min-h-0 min-w-0 flex-1"
					>
						<PreviewPanel />
					</ResizablePanel>

					<ResizableHandle withHandle />

					<ResizablePanel
						defaultSize={panels.properties}
						minSize={15}
						maxSize={40}
						className="min-w-0"
					>
						{hasTranscript || hasTimelineContent ? (
							<RightPanel className="size-full" />
						) : (
							<EmptyEditorGuide />
						)}
					</ResizablePanel>
				</ResizablePanelGroup>
			</ResizablePanel>

			{/* Quick actions bar — appears between main content and timeline */}
			{hasTranscript && (
				<div className="flex justify-center px-3 py-1">
					<QuickActionsBar />
				</div>
			)}

			<ResizableHandle withHandle />

			<ResizablePanel
				defaultSize={panels.timeline}
				minSize={15}
				maxSize={70}
				className="min-h-0 px-3 pb-3"
			>
				<Timeline />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
