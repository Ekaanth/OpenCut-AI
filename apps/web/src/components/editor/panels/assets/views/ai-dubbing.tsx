"use client";

import { useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranscriptStore } from "@/stores/transcript-store";
import { useAIDubbing, type DubbingEngine } from "@/hooks/use-ai-dubbing";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/ui";
import { SARVAM_TTS_LANGUAGES, SARVAM_TTS_SPEAKERS } from "@/constants/sarvam-constants";
import { toast } from "sonner";

const DUBBING_LANGUAGES = [
	{ code: "hi", name: "Hindi" },
	{ code: "bn", name: "Bengali" },
	{ code: "ta", name: "Tamil" },
	{ code: "te", name: "Telugu" },
	{ code: "mr", name: "Marathi" },
	{ code: "gu", name: "Gujarati" },
	{ code: "kn", name: "Kannada" },
	{ code: "ml", name: "Malayalam" },
	{ code: "pa", name: "Punjabi" },
	{ code: "od", name: "Odia" },
	{ code: "en", name: "English" },
	{ code: "es", name: "Spanish" },
	{ code: "fr", name: "French" },
	{ code: "de", name: "German" },
	{ code: "pt", name: "Portuguese" },
	{ code: "ja", name: "Japanese" },
	{ code: "ko", name: "Korean" },
	{ code: "zh", name: "Chinese" },
	{ code: "ar", name: "Arabic" },
	{ code: "ru", name: "Russian" },
	{ code: "it", name: "Italian" },
];

const ENGINES: Array<{
	value: DubbingEngine;
	label: string;
	description: string;
}> = [
	{
		value: "sarvam",
		label: "Sarvam AI",
		description: "11 Indian languages, 23 voices",
	},
	{
		value: "smallest",
		label: "Smallest AI",
		description: "15 languages, 80+ voices, low latency",
	},
	{
		value: "local",
		label: "Local XTTS",
		description: "Voice cloning, any language",
	},
];

export function AIDubbingPanel() {
	const segments = useTranscriptStore((s) => s.segments);
	const language = useTranscriptStore((s) => s.language);
	const editor = useEditor();
	const { runDubbing, isDubbing, progress } = useAIDubbing();

	const [targetLanguage, setTargetLanguage] = useState("hi");
	const [engine, setEngine] = useState<DubbingEngine>("sarvam");
	const [voiceId, setVoiceId] = useState("shubh");

	const isSarvamLang = SARVAM_TTS_LANGUAGES.some(
		(l) => l.code === targetLanguage,
	);

	const handleDub = useCallback(() => {
		if (segments.length === 0) {
			toast.error("No transcript available. Transcribe first.");
			return;
		}
		if (language === targetLanguage) {
			toast.error("Target language is same as source.");
			return;
		}
		runDubbing({
			targetLanguage,
			engine,
			voiceId,
		});
	}, [segments, language, targetLanguage, engine, voiceId, runDubbing]);

	const voiceOptions =
		engine === "sarvam"
			? SARVAM_TTS_SPEAKERS.map((s) => ({ id: s.id, name: s.name }))
			: engine === "smallest"
				? [
						{ id: "emily", name: "Emily" },
						{ id: "jasper", name: "Jasper" },
						{ id: "matthew", name: "Matthew" },
						{ id: "maitrayi", name: "Maitrayi" },
					]
				: [{ id: "default", name: "Default" }];

	return (
		<div className="flex flex-col gap-4 p-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<span className="text-xs font-medium">AI Dubbing</span>
					{segments.length > 0 && (
						<Badge variant="secondary" className="text-[8px] px-1 py-0">
							{segments.length} segments
						</Badge>
					)}
				</div>
				<Badge variant="outline" className="text-[8px] px-1 py-0">
					Source: {language}
				</Badge>
			</div>

			<p className="text-[10px] text-muted-foreground leading-relaxed">
				Translates transcript segments and generates speech in the target
				language. Each dubbed segment is placed as a new audio track aligned to
				the original timestamps.
			</p>

			<div className="flex flex-col gap-1.5">
				<Label className="text-[10px]">Target language</Label>
				<Select value={targetLanguage} onValueChange={setTargetLanguage}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{DUBBING_LANGUAGES.map((lang) => (
							<SelectItem key={lang.code} value={lang.code}>
								{lang.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label className="text-[10px]">TTS Engine</Label>
				<div className="flex flex-col gap-1">
					{ENGINES.map((e) => {
						const isActive = engine === e.value;
						const isDisabled =
							e.value === "sarvam" && !isSarvamLang && targetLanguage !== "en";
						return (
							<button
								key={e.value}
								type="button"
								disabled={isDisabled}
								onClick={() => setEngine(e.value)}
								className={cn(
									"flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors",
									isActive
										? "border-primary/40 bg-primary/5"
										: isDisabled
											? "opacity-50 cursor-not-allowed"
											: "border-border hover:bg-accent cursor-pointer",
								)}
							>
								<div className="flex items-center gap-1.5">
									{isActive ? (
										<svg
											className="size-3 text-primary shrink-0"
											viewBox="0 0 16 16"
											fill="none"
										>
											<path
												d="M3 8.5L6.5 12L13 4"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									) : (
										<span className="size-3 shrink-0" />
									)}
									<span className="text-[10px] font-medium">{e.label}</span>
								</div>
								<span className="text-[9px] text-muted-foreground">
									{e.description}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label className="text-[10px]">Voice</Label>
				<Select value={voiceId} onValueChange={setVoiceId}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{voiceOptions.map((v) => (
							<SelectItem key={v.id} value={v.id}>
								{v.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{progress && (
				<div className="flex flex-col gap-1 rounded-md border border-primary/20 bg-primary/5 p-2">
					<div className="flex items-center justify-between">
						<span className="text-[9px] font-medium">
							{progress.phase === "translating"
								? "Translating..."
								: progress.phase === "generating"
									? "Generating speech..."
									: progress.phase === "placing"
										? "Placing on timeline..."
										: "Done"}
						</span>
						<span className="text-[9px] text-muted-foreground">
							{progress.currentSegment}/{progress.totalSegments}
						</span>
					</div>
					<div className="w-full bg-muted rounded-full h-1">
						<div
							className="bg-primary h-1 rounded-full transition-all"
							style={{
								width: `${(progress.currentSegment / progress.totalSegments) * 100}%`,
							}}
						/>
					</div>
					<span className="text-[8px] text-muted-foreground truncate">
						{progress.currentText}
					</span>
				</div>
			)}

			<button
				type="button"
				disabled={isDubbing || segments.length === 0}
				onClick={handleDub}
				className={cn(
					"w-full rounded-md py-2 text-xs font-medium transition-colors",
					isDubbing
						? "bg-muted text-muted-foreground cursor-not-allowed"
						: "bg-primary text-primary-foreground hover:bg-primary/90",
				)}
			>
				{isDubbing ? "Dubbing..." : "Start Dubbing"}
			</button>
		</div>
	);
}
