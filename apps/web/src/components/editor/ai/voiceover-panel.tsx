"use client";

import { useRef, useState } from "react";
import { cn } from "@/utils/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AiMicIcon,
	PlayIcon,
	PauseIcon,
	Upload04Icon,
	Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useBackgroundTasksStore } from "@/stores/background-tasks-store";

// ----- Types -----

export interface VoiceOption {
	id: string;
	name: string;
	language: string;
	gender: "male" | "female" | "neutral";
	preview?: string;
	isCloned?: boolean;
}

export interface VoiceoverResult {
	audioUrl: string;
	duration: number;
}

interface VoiceoverPanelProps {
	voices: VoiceOption[];
	languages: { code: string; name: string }[];
	onGenerate: (params: {
		text: string;
		voiceId: string;
		language: string;
	}) => Promise<VoiceoverResult | null>;
	onUploadVoiceSample: (file: File) => Promise<VoiceOption | null>;
	onAddToTimeline: (result: VoiceoverResult) => void;
	className?: string;
}

// ----- Component -----

export function VoiceoverPanel({
	voices,
	languages,
	onGenerate,
	onUploadVoiceSample,
	onAddToTimeline,
	className,
}: VoiceoverPanelProps) {
	const [text, setText] = useState("");
	const [selectedLanguage, setSelectedLanguage] = useState(
		languages[0]?.code ?? "en",
	);
	const [selectedVoice, setSelectedVoice] = useState(
		voices[0]?.id ?? "",
	);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [result, setResult] = useState<VoiceoverResult | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const filteredVoices = voices.filter(
		(v) => v.language === selectedLanguage || v.isCloned,
	);

	const handleGenerate = async () => {
		if (!text.trim()) return;
		const taskId = `voiceover-${Date.now()}`;
		const bgTasks = useBackgroundTasksStore.getState();

		setIsGenerating(true);
		setError(null);
		setResult(null);

		bgTasks.addTask({
			id: taskId,
			type: "voiceover",
			label: "Voiceover",
			progress: "Generating speech...",
		});

		try {
			const generated = await onGenerate({
				text,
				voiceId: selectedVoice,
				language: selectedLanguage,
			});
			setResult(generated);
			bgTasks.updateTask(taskId, {
				status: "completed",
				progress: "Speech ready",
				completedAt: Date.now(),
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to generate voiceover";
			setError(message);
			bgTasks.updateTask(taskId, {
				status: "error",
				error: message,
				completedAt: Date.now(),
			});
		} finally {
			setIsGenerating(false);
		}
	};

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsUploading(true);
		setError(null);
		try {
			const newVoice = await onUploadVoiceSample(file);
			if (newVoice) {
				setSelectedVoice(newVoice.id);
			}
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to upload voice sample",
			);
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const togglePlayback = () => {
		if (!result) return;

		if (audioRef.current) {
			if (isPlaying) {
				audioRef.current.pause();
				setIsPlaying(false);
			} else {
				audioRef.current.play();
				setIsPlaying(true);
			}
		} else {
			const audio = new Audio(result.audioUrl);
			audioRef.current = audio;
			audio.onended = () => setIsPlaying(false);
			audio.onerror = () => {
				setIsPlaying(false);
				setError("Failed to play audio");
			};
			audio.play();
			setIsPlaying(true);
		}
	};

	const handleAddToTimeline = () => {
		if (result) {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
			setIsPlaying(false);
			onAddToTimeline(result);
		}
	};

	return (
		<div className={cn("flex flex-col h-full bg-background", className)}>
			{/* Header */}
			<div className="flex items-center gap-2 border-b px-4 py-3">
				<HugeiconsIcon
					icon={AiMicIcon}
					className="size-4 text-primary"
				/>
				<span className="text-sm font-medium">Voiceover</span>
			</div>

			<ScrollArea className="flex-1 px-4 py-3">
				<div className="flex flex-col gap-4">
					{/* Text input */}
					<div className="flex flex-col gap-2">
						<Label className="text-xs">Text</Label>
						<Textarea
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder="Enter the text you want to convert to speech..."
							rows={4}
							disabled={isGenerating}
						/>
						<p className="text-[10px] text-muted-foreground text-right">
							{text.length} characters
						</p>
					</div>

					{/* Language */}
					<div className="flex items-center gap-3">
						<Label className="text-xs w-20 shrink-0">Language</Label>
						<Select
							value={selectedLanguage}
							onValueChange={(v) => {
								setSelectedLanguage(v);
								const firstVoice = voices.find(
									(voice) => voice.language === v,
								);
								if (firstVoice) {
									setSelectedVoice(firstVoice.id);
								}
							}}
							disabled={isGenerating}
						>
							<SelectTrigger className="flex-1">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{languages.map((lang) => (
									<SelectItem key={lang.code} value={lang.code}>
										{lang.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Voice picker */}
					<div className="flex flex-col gap-2">
						<Label className="text-xs">Voice</Label>
						<div className="grid grid-cols-2 gap-1.5">
							{filteredVoices.map((voice) => (
								<Card
									key={voice.id}
									className={cn(
										"cursor-pointer transition-colors hover:bg-accent rounded-lg",
										selectedVoice === voice.id &&
											"ring-2 ring-primary",
									)}
									onClick={() => setSelectedVoice(voice.id)}
								>
									<CardContent className="p-2.5">
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium truncate">
												{voice.name}
											</span>
											{selectedVoice === voice.id && (
												<HugeiconsIcon
													icon={Tick01Icon}
													className="size-3 text-primary shrink-0"
												/>
											)}
										</div>
										<div className="flex items-center gap-1 mt-0.5">
											<span className="text-[10px] text-muted-foreground capitalize">
												{voice.gender}
											</span>
											{voice.isCloned && (
												<Badge
													variant="secondary"
													className="text-[9px] px-1 py-0"
												>
													Cloned
												</Badge>
											)}
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>

					{/* Voice cloning upload */}
					<div className="flex flex-col gap-2">
						<input
							ref={fileInputRef}
							type="file"
							accept="audio/*"
							onChange={handleUpload}
							className="hidden"
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={isUploading || isGenerating}
						>
							{isUploading ? (
								<>
									<Spinner className="size-3 mr-1" />
									Uploading...
								</>
							) : (
								<>
									<HugeiconsIcon
										icon={Upload04Icon}
										className="size-3 mr-1"
									/>
									Upload Voice Sample
								</>
							)}
						</Button>
						<p className="text-[10px] text-muted-foreground">
							Upload an audio sample to clone a voice. Minimum 10 seconds recommended.
						</p>
					</div>

					{/* Error */}
					{error && (
						<div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
							<p className="text-xs text-destructive">{error}</p>
						</div>
					)}

					{/* Generate */}
					<Button
						onClick={handleGenerate}
						disabled={!text.trim() || isGenerating}
					>
						{isGenerating ? (
							<>
								<Spinner className="size-3 mr-1" />
								Generating...
							</>
						) : (
							"Generate"
						)}
					</Button>

					{/* Result preview */}
					{result && (
						<Card className="rounded-lg">
							<CardContent className="p-3">
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-medium">
										Generated Audio
									</span>
									<span className="text-[10px] text-muted-foreground tabular-nums">
										{result.duration.toFixed(1)}s
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="icon"
										onClick={togglePlayback}
										className="size-8"
									>
										<HugeiconsIcon
											icon={isPlaying ? PauseIcon : PlayIcon}
											className="size-3.5"
										/>
									</Button>
									<div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden">
										<div className="h-full bg-primary/50 rounded-full w-0" />
									</div>
								</div>
								<Button
									variant="default"
									size="sm"
									onClick={handleAddToTimeline}
									className="w-full mt-2"
								>
									Add to Timeline
								</Button>
							</CardContent>
						</Card>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
