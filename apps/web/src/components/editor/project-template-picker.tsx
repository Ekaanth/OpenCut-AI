"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogBody,
	DialogFooter,
} from "@/components/ui/dialog";
import { PROJECT_TEMPLATES, type ProjectTemplate } from "@/constants/project-constants";
import { aiClient } from "@/lib/ai-client";
import { getApiKey } from "@/lib/api-keys";
import { toast } from "sonner";

// ----- Types -----

interface ProjectTemplatePickerProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectTemplate: (template: ProjectTemplate) => void;
}

// ----- Icon map -----

const TEMPLATE_ICONS: Record<string, string> = {
	youtube: "▶",
	tiktok: "♪",
	podcast: "🎙",
	instagram: "◻",
	presentation: "📊",
	custom: "⚙",
};

// ----- Component -----

export function ProjectTemplatePicker({
	isOpen,
	onOpenChange,
	onSelectTemplate,
}: ProjectTemplatePickerProps) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [view, setView] = useState<"grid" | "detail">("grid");

	// Detail editor state
	const [editTitle, setEditTitle] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editPrompt, setEditPrompt] = useState("");
	const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
	const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
	const [videoResult, setVideoResult] = useState<{ url: string; status: string } | null>(null);
	const [videoProvider, setVideoProvider] = useState<"seedance" | "local">("seedance");
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const selectedTemplate = PROJECT_TEMPLATES.find((t) => t.id === selectedId);

	const hasSeedanceKey = !!getApiKey("seedance");

	const handleOpenTemplate = useCallback((template: ProjectTemplate) => {
		setSelectedId(template.id);
		setEditTitle(template.name);
		setEditDescription(template.description);
		setEditPrompt("");
		setVideoResult(null);
		setView("detail");
	}, []);

	const handleBack = useCallback(() => {
		setView("grid");
		setVideoResult(null);
		if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
	}, []);

	const handleSelect = () => {
		if (selectedTemplate) {
			onSelectTemplate(selectedTemplate);
			onOpenChange(false);
		}
	};

	const handleGeneratePrompt = useCallback(async () => {
		if (!editTitle.trim() && !editDescription.trim()) return;
		setIsGeneratingPrompt(true);
		try {
			const result = await aiClient.generateVideoPrompt(
				editTitle,
				editDescription,
				selectedTemplate?.icon,
			);
			setEditPrompt(result.prompt);
			toast.success("Prompt generated");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to generate prompt. Make sure the AI backend is running.");
		} finally {
			setIsGeneratingPrompt(false);
		}
	}, [editTitle, editDescription, selectedTemplate]);

	const handleGenerateVideo = useCallback(async () => {
		if (!editPrompt.trim()) {
			toast.error("Enter or generate a prompt first");
			return;
		}

		if (videoProvider === "seedance" && !hasSeedanceKey) {
			toast.error("Add your Seedance 2.0 key in Settings to generate videos");
			return;
		}

		setIsGeneratingVideo(true);
		setVideoResult(null);
		try {
			const canvas = selectedTemplate?.canvas ?? { width: 1920, height: 1080 };
			const result = await aiClient.generateVideo({
				prompt: editPrompt,
				duration: 5,
				width: canvas.width,
				height: canvas.height,
				provider: videoProvider,
			});

			if (result.status === "completed" && result.videoUrl) {
				setVideoResult({ url: result.videoUrl, status: "completed" });
				setIsGeneratingVideo(false);
				toast.success("Video generated");
				return;
			}

			if (result.jobId) {
				setVideoResult({ url: "", status: "processing" });
				// Poll for completion
				pollRef.current = setInterval(async () => {
					try {
						const job = await aiClient.getVideoJob(result.jobId!);
						if (job.status === "completed" && job.videoUrl) {
							setVideoResult({ url: job.videoUrl, status: "completed" });
							setIsGeneratingVideo(false);
							if (pollRef.current) clearInterval(pollRef.current);
							toast.success("Video generated");
						} else if (job.status === "failed") {
							setVideoResult({ url: "", status: "failed" });
							setIsGeneratingVideo(false);
							if (pollRef.current) clearInterval(pollRef.current);
							toast.error(job.error || "Video generation failed");
						}
					} catch {
						// keep polling
					}
				}, 3000);
			} else {
				setIsGeneratingVideo(false);
				toast.error("Video generation did not return a result");
			}
		} catch (err) {
			setIsGeneratingVideo(false);
			toast.error(err instanceof Error ? err.message : "Video generation failed");
		}
	}, [editPrompt, videoProvider, hasSeedanceKey, selectedTemplate]);

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className={cn("transition-all", view === "detail" ? "max-w-2xl" : "max-w-lg")}>
				<DialogHeader>
					{view === "detail" && selectedTemplate ? (
						<>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleBack}
									className="text-muted-foreground hover:text-foreground text-sm shrink-0"
								>
									&larr;
								</button>
								<DialogTitle>
									{TEMPLATE_ICONS[selectedTemplate.icon] ?? "📹"}{" "}
									{editTitle || selectedTemplate.name}
								</DialogTitle>
							</div>
							<DialogDescription>
								Customize your template, generate a video prompt, and create a video.
							</DialogDescription>
						</>
					) : (
						<>
							<DialogTitle>What are you making?</DialogTitle>
							<DialogDescription>
								Pick a template to set up your project. You can change settings later.
							</DialogDescription>
						</>
					)}
				</DialogHeader>

				<DialogBody>
					{view === "grid" ? (
						<>
							<div className="grid grid-cols-2 gap-2">
								{PROJECT_TEMPLATES.map((template) => {
									const isSelected = selectedId === template.id;

									return (
										<Card
											key={template.id}
											className={cn(
												"cursor-pointer transition-all rounded-lg hover:bg-accent",
												isSelected && "ring-2 ring-primary",
											)}
											onClick={() => handleOpenTemplate(template)}
										>
											<CardContent className="p-3">
												<div className="flex items-start gap-2.5">
													<span className="text-lg leading-none mt-0.5">
														{TEMPLATE_ICONS[template.icon] ?? "📹"}
													</span>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5">
															<span className="text-xs font-medium">
																{template.name}
															</span>
														</div>
														<p className="text-[10px] text-muted-foreground mt-0.5">
															{template.description}
														</p>
														<div className="flex items-center gap-1.5 mt-1.5">
															<Badge
																variant="secondary"
																className="text-[9px] px-1 py-0"
															>
																{template.canvas.width}x{template.canvas.height}
															</Badge>
															<Badge
																variant="secondary"
																className="text-[9px] px-1 py-0"
															>
																{template.fps} fps
															</Badge>
														</div>
													</div>
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						</>
					) : selectedTemplate ? (
						<TemplateDetailEditor
							template={selectedTemplate}
							editTitle={editTitle}
							setEditTitle={setEditTitle}
							editDescription={editDescription}
							setEditDescription={setEditDescription}
							editPrompt={editPrompt}
							setEditPrompt={setEditPrompt}
							isGeneratingPrompt={isGeneratingPrompt}
							onGeneratePrompt={handleGeneratePrompt}
							isGeneratingVideo={isGeneratingVideo}
							onGenerateVideo={handleGenerateVideo}
							videoResult={videoResult}
							videoProvider={videoProvider}
							setVideoProvider={setVideoProvider}
							hasSeedanceKey={hasSeedanceKey}
						/>
					) : null}
				</DialogBody>

				<DialogFooter>
					{view === "detail" ? (
						<>
							<Button variant="outline" onClick={handleBack}>
								Back
							</Button>
							<Button onClick={handleSelect} disabled={!selectedTemplate}>
								Create project
							</Button>
						</>
					) : (
						<>
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Skip
							</Button>
							<Button onClick={handleSelect} disabled={!selectedTemplate}>
								Create project
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ----- Template Detail Editor -----

interface TemplateDetailEditorProps {
	template: ProjectTemplate;
	editTitle: string;
	setEditTitle: (v: string) => void;
	editDescription: string;
	setEditDescription: (v: string) => void;
	editPrompt: string;
	setEditPrompt: (v: string) => void;
	isGeneratingPrompt: boolean;
	onGeneratePrompt: () => void;
	isGeneratingVideo: boolean;
	onGenerateVideo: () => void;
	videoResult: { url: string; status: string } | null;
	videoProvider: "seedance" | "local";
	setVideoProvider: (v: "seedance" | "local") => void;
	hasSeedanceKey: boolean;
}

function TemplateDetailEditor({
	template,
	editTitle,
	setEditTitle,
	editDescription,
	setEditDescription,
	editPrompt,
	setEditPrompt,
	isGeneratingPrompt,
	onGeneratePrompt,
	isGeneratingVideo,
	onGenerateVideo,
	videoResult,
	videoProvider,
	setVideoProvider,
	hasSeedanceKey,
}: TemplateDetailEditorProps) {
	return (
		<div className="flex flex-col gap-4">
			{/* Template info header */}
			<div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
				<Badge variant="secondary" className="text-[9px] px-1.5 py-0">
					{template.canvas.width}x{template.canvas.height}
				</Badge>
				<Badge variant="secondary" className="text-[9px] px-1.5 py-0">
					{template.fps} fps
				</Badge>
				<span className="text-[10px] text-muted-foreground ml-auto">
					{template.icon}
				</span>
			</div>

			{/* Heading */}
			<div className="flex flex-col gap-1.5">
				<label className="text-xs font-medium text-muted-foreground">
					Heading
				</label>
				<Input
					value={editTitle}
					onChange={(e) => setEditTitle(e.target.value)}
					placeholder="Template title..."
					className="text-sm font-medium"
				/>
			</div>

			{/* Description */}
			<div className="flex flex-col gap-1.5">
				<label className="text-xs font-medium text-muted-foreground">
					Description
				</label>
				<Textarea
					value={editDescription}
					onChange={(e) => setEditDescription(e.target.value)}
					placeholder="Describe what this video should contain..."
					rows={3}
					className="text-sm"
				/>
			</div>

			{/* Prompt section */}
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<label className="text-xs font-medium text-muted-foreground">
						Video Generation Prompt
					</label>
					<Button
						variant="outline"
						size="sm"
						onClick={onGeneratePrompt}
						disabled={isGeneratingPrompt || (!editTitle.trim() && !editDescription.trim())}
						className="h-6 text-[10px] px-2"
					>
						{isGeneratingPrompt ? (
							<>
								<Spinner className="size-3 mr-1" />
								Generating...
							</>
						) : (
							"Generate Prompt"
						)}
					</Button>
				</div>
				<Textarea
					value={editPrompt}
					onChange={(e) => setEditPrompt(e.target.value)}
					placeholder="A cinematic video showing... (click Generate Prompt to auto-create from your description)"
					rows={4}
					className="text-sm font-mono"
				/>
				<p className="text-[10px] text-muted-foreground">
					Write a prompt manually or generate one from the description above.
					This prompt will be used to create a video clip.
				</p>
			</div>

			{/* Video generation section */}
			<div className="flex flex-col gap-2 rounded-lg border p-3">
				<div className="flex items-center justify-between">
					<span className="text-xs font-medium">Generate Video</span>
					<div className="flex gap-1">
						<button
							type="button"
							onClick={() => setVideoProvider("seedance")}
							className={cn(
								"text-[10px] px-2 py-1 rounded-md border transition-colors",
								videoProvider === "seedance"
									? "bg-primary text-primary-foreground border-primary"
									: "bg-background hover:bg-accent border-border",
							)}
						>
							Seedance 2.0
						</button>
						<button
							type="button"
							onClick={() => setVideoProvider("local")}
							className={cn(
								"text-[10px] px-2 py-1 rounded-md border transition-colors",
								videoProvider === "local"
									? "bg-primary text-primary-foreground border-primary"
									: "bg-background hover:bg-accent border-border",
							)}
						>
							Local
						</button>
					</div>
				</div>

				{videoProvider === "seedance" && !hasSeedanceKey && (
					<p className="text-[10px] text-yellow-500">
						Add your Seedance 2.0 key in Settings &rarr; API Keys to use this provider.
					</p>
				)}

				<Button
					onClick={onGenerateVideo}
					disabled={
						isGeneratingVideo ||
						!editPrompt.trim() ||
						(videoProvider === "seedance" && !hasSeedanceKey)
					}
					size="sm"
					className="w-full"
				>
					{isGeneratingVideo ? (
						<>
							<Spinner className="size-3.5 mr-2" />
							{videoResult?.status === "processing"
								? "Processing video..."
								: "Starting generation..."}
						</>
					) : (
						`Generate with ${videoProvider === "seedance" ? "Seedance" : "Local AI"}`
					)}
				</Button>

				{/* Video result */}
				{videoResult?.status === "completed" && videoResult.url && (
					<div className="rounded-lg overflow-hidden border bg-black">
						<video
							src={videoResult.url}
							controls
							className="w-full max-h-48 object-contain"
						/>
					</div>
				)}

				{videoResult?.status === "failed" && (
					<div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
						Video generation failed. Try a different prompt or provider.
					</div>
				)}
			</div>

			{/* Tips */}
			<div className="rounded-lg bg-muted/50 px-3 py-2.5">
				<p className="text-[11px] font-medium text-muted-foreground mb-1.5">
					Suggested workflow
				</p>
				<ol className="flex flex-col gap-1">
					{template.tips.map((tip, index) => (
						<li
							key={tip}
							className="flex items-start gap-2 text-[11px] text-muted-foreground"
						>
							<span className="text-[10px] font-bold text-primary mt-px shrink-0">
								{index + 1}.
							</span>
							{tip}
						</li>
					))}
				</ol>
			</div>
		</div>
	);
}
