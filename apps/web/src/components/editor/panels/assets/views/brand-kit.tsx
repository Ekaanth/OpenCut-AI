"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import { FontPicker } from "@/components/ui/font-picker";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { toast } from "sonner";

// ── Types ──

type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface BrandConfig {
	// Identity
	channelName: string;
	tagline: string;
	// Social
	socialHandle: string;
	websiteUrl: string;
	ctaText: string;
	// Logo
	logoPosition: LogoPosition;
	logoOpacity: number;
	logoScale: number;
	logoFile: File | null;
	logoPreviewUrl: string | null;
	// Colors
	primaryColor: string;
	secondaryColor: string;
	accentColor: string;
	textColor: string;
	// Typography
	headingFont: string;
	bodyFont: string;
}

const POSITION_OFFSETS: Record<LogoPosition, { x: number; y: number }> = {
	"top-left": { x: -0.4, y: -0.4 },
	"top-right": { x: 0.4, y: -0.4 },
	"bottom-left": { x: -0.4, y: 0.4 },
	"bottom-right": { x: 0.4, y: 0.4 },
};

const DEFAULT_BRAND: BrandConfig = {
	channelName: "",
	tagline: "",
	socialHandle: "",
	websiteUrl: "",
	ctaText: "",
	logoPosition: "top-right",
	logoOpacity: 0.8,
	logoScale: 0.10,
	logoFile: null,
	logoPreviewUrl: null,
	primaryColor: "#3B82F6",
	secondaryColor: "#1E293B",
	accentColor: "#F59E0B",
	textColor: "#FFFFFF",
	headingFont: "Inter",
	bodyFont: "Inter",
};

// ── Persistence ──

const STORAGE_KEY = "opencut:brand-kit";
const LOGO_STORAGE_KEY = "opencut:brand-kit-logo";

/** Fields safe to serialize (everything except File/blob URL). */
type SerializableBrand = Omit<BrandConfig, "logoFile" | "logoPreviewUrl"> & {
	hasLogo: boolean;
	logoFileName: string;
};

function saveBrandConfig(config: BrandConfig): void {
	try {
		const serializable: SerializableBrand = {
			channelName: config.channelName,
			tagline: config.tagline,
			socialHandle: config.socialHandle,
			websiteUrl: config.websiteUrl,
			ctaText: config.ctaText,
			logoPosition: config.logoPosition,
			logoOpacity: config.logoOpacity,
			logoScale: config.logoScale,
			primaryColor: config.primaryColor,
			secondaryColor: config.secondaryColor,
			accentColor: config.accentColor,
			textColor: config.textColor,
			headingFont: config.headingFont,
			bodyFont: config.bodyFont,
			hasLogo: config.logoFile !== null,
			logoFileName: config.logoFile?.name ?? "",
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));

		// Store logo as base64 data URL (only when it changes)
		if (config.logoFile) {
			const reader = new FileReader();
			reader.onload = () => {
				try {
					localStorage.setItem(LOGO_STORAGE_KEY, reader.result as string);
				} catch {
					// Logo too large for localStorage — skip silently
				}
			};
			reader.readAsDataURL(config.logoFile);
		} else {
			localStorage.removeItem(LOGO_STORAGE_KEY);
		}
	} catch {
		// localStorage unavailable
	}
}

function loadBrandConfig(): BrandConfig {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_BRAND;

		const saved: SerializableBrand = JSON.parse(raw);

		// Reconstruct logo File from stored base64
		let logoFile: File | null = null;
		let logoPreviewUrl: string | null = null;

		if (saved.hasLogo) {
			const dataUrl = localStorage.getItem(LOGO_STORAGE_KEY);
			if (dataUrl) {
				try {
					// Convert data URL to File
					const [header, base64] = dataUrl.split(",");
					const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
					const binary = atob(base64);
					const bytes = new Uint8Array(binary.length);
					for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
					logoFile = new File([bytes], saved.logoFileName || "logo.png", { type: mime });
					logoPreviewUrl = dataUrl;
				} catch {
					// Corrupted data — skip
				}
			}
		}

		return {
			channelName: saved.channelName ?? "",
			tagline: saved.tagline ?? "",
			socialHandle: saved.socialHandle ?? "",
			websiteUrl: saved.websiteUrl ?? "",
			ctaText: saved.ctaText ?? "",
			logoPosition: saved.logoPosition ?? "top-right",
			logoOpacity: saved.logoOpacity ?? 0.8,
			logoScale: saved.logoScale ?? 0.10,
			logoFile,
			logoPreviewUrl,
			primaryColor: saved.primaryColor ?? DEFAULT_BRAND.primaryColor,
			secondaryColor: saved.secondaryColor ?? DEFAULT_BRAND.secondaryColor,
			accentColor: saved.accentColor ?? DEFAULT_BRAND.accentColor,
			textColor: saved.textColor ?? DEFAULT_BRAND.textColor,
			headingFont: saved.headingFont ?? "Inter",
			bodyFont: saved.bodyFont ?? "Inter",
		};
	} catch {
		return DEFAULT_BRAND;
	}
}

// ── Helpers ──

function ColorSwatch({ color, onChange, label }: { color: string; onChange: (c: string) => void; label: string }) {
	return (
		<div className="flex items-center gap-2">
			<ColorPicker value={color} onChange={onChange} />
			<span className="text-[10px] text-muted-foreground">{label}</span>
		</div>
	);
}

// ── Component ──

export function BrandKitView() {
	const editor = useEditor();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [config, setConfig] = useState<BrandConfig>(() => loadBrandConfig());
	const [appliedTrackIds, setAppliedTrackIds] = useState<string[]>([]);

	const update = useCallback((patch: Partial<BrandConfig>) => {
		setConfig((prev) => ({ ...prev, ...patch }));
	}, []);

	// Persist to localStorage whenever config changes
	useEffect(() => {
		saveBrandConfig(config);
	}, [config]);

	// ── Logo Upload ──
	const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			toast.error("Please upload an image file (PNG, JPG, SVG).");
			return;
		}
		const url = URL.createObjectURL(file);
		update({ logoFile: file, logoPreviewUrl: url });
	}, [update]);

	const handleRemoveLogo = useCallback(() => {
		if (config.logoPreviewUrl) URL.revokeObjectURL(config.logoPreviewUrl);
		update({ logoFile: null, logoPreviewUrl: null });
	}, [config.logoPreviewUrl, update]);

	// ── Apply All Brand Elements ──
	const handleApplyBrand = useCallback(async () => {
		const totalDuration = editor.timeline.getTotalDuration();
		if (totalDuration <= 0) {
			toast.error("Add media to the timeline first.");
			return;
		}

		const activeProject = editor.project.getActive();
		const canvasSize = activeProject.settings.canvasSize;
		const posOffset = POSITION_OFFSETS[config.logoPosition];
		const newTrackIds: string[] = [];

		// 1. Channel name
		if (config.channelName.trim()) {
			const trackId = editor.timeline.addTrack({ type: "text", index: 0 });
			editor.timeline.renameTrack({ trackId, name: "Brand: Name" });
			const nameX = posOffset.x > 0 ? -0.38 : 0.38;
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element: {
					...DEFAULT_TEXT_ELEMENT,
					name: "Channel Name",
					content: config.channelName,
					fontSize: 3,
					fontFamily: config.headingFont,
					fontWeight: "bold",
					color: config.textColor,
					textAlign: "center",
					startTime: 0,
					duration: totalDuration,
					trimStart: 0,
					trimEnd: 0,
					opacity: config.logoOpacity,
					background: { enabled: false, color: "transparent", cornerRadius: 0, paddingX: 0, paddingY: 0, offsetX: 0, offsetY: 0 },
					transform: { scale: 1, position: { x: nameX * canvasSize.width, y: posOffset.y * canvasSize.height }, rotate: 0 },
				},
			});
			newTrackIds.push(trackId);
		}

		// 2. Social handle / website
		const socialText = [config.socialHandle, config.websiteUrl].filter(Boolean).join("  ·  ");
		if (socialText) {
			const trackId = editor.timeline.addTrack({ type: "text", index: 0 });
			editor.timeline.renameTrack({ trackId, name: "Brand: Social" });
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element: {
					...DEFAULT_TEXT_ELEMENT,
					name: "Social Handle",
					content: socialText,
					fontSize: 2.5,
					fontFamily: config.bodyFont,
					fontWeight: "normal",
					color: config.textColor,
					textAlign: "center",
					startTime: 0,
					duration: totalDuration,
					trimStart: 0,
					trimEnd: 0,
					opacity: config.logoOpacity * 0.8,
					background: { enabled: false, color: "transparent", cornerRadius: 0, paddingX: 0, paddingY: 0, offsetX: 0, offsetY: 0 },
					transform: { scale: 1, position: { x: 0, y: canvasSize.height * 0.44 }, rotate: 0 },
				},
			});
			newTrackIds.push(trackId);
		}

		// 3. CTA overlay (e.g. "Subscribe", "Follow for more")
		if (config.ctaText.trim()) {
			const trackId = editor.timeline.addTrack({ type: "text", index: 0 });
			editor.timeline.renameTrack({ trackId, name: "Brand: CTA" });
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element: {
					...DEFAULT_TEXT_ELEMENT,
					name: "CTA",
					content: config.ctaText,
					fontSize: 3.5,
					fontFamily: config.headingFont,
					fontWeight: "bold",
					color: config.textColor,
					textAlign: "center",
					startTime: Math.max(0, totalDuration - 5),
					duration: 5,
					trimStart: 0,
					trimEnd: 0,
					opacity: 1,
					background: {
						enabled: true,
						color: config.accentColor,
						cornerRadius: 50,
						paddingX: 24,
						paddingY: 10,
						offsetX: 0,
						offsetY: 0,
					},
					transform: { scale: 1, position: { x: 0, y: canvasSize.height * 0.3 }, rotate: 0 },
				},
			});
			newTrackIds.push(trackId);
		}

		// 4. Tagline
		if (config.tagline.trim()) {
			const trackId = editor.timeline.addTrack({ type: "text", index: 0 });
			editor.timeline.renameTrack({ trackId, name: "Brand: Tagline" });
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element: {
					...DEFAULT_TEXT_ELEMENT,
					name: "Tagline",
					content: config.tagline,
					fontSize: 3,
					fontFamily: config.bodyFont,
					fontWeight: "normal",
					fontStyle: "italic",
					color: config.textColor,
					textAlign: "center",
					startTime: 0,
					duration: Math.min(5, totalDuration),
					trimStart: 0,
					trimEnd: 0,
					opacity: 0.9,
					background: { enabled: false, color: "transparent", cornerRadius: 0, paddingX: 0, paddingY: 0, offsetX: 0, offsetY: 0 },
					transform: { scale: 1, position: { x: 0, y: canvasSize.height * -0.35 }, rotate: 0 },
				},
			});
			newTrackIds.push(trackId);
		}

		// 5. Logo
		if (config.logoFile) {
			try {
				const logoUrl = URL.createObjectURL(config.logoFile);
				const mediaId = await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset: {
						name: config.logoFile.name || `brand-logo-${Date.now()}`,
						type: "image",
						file: config.logoFile,
						url: logoUrl,
					},
				});
				const imgTrackId = editor.timeline.addTrack({ type: "video", index: 0 });
				editor.timeline.renameTrack({ trackId: imgTrackId, name: "Brand: Logo" });
				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId: imgTrackId },
					element: {
						type: "image",
						mediaId,
						name: "Brand Logo",
						startTime: 0,
						duration: totalDuration,
						trimStart: 0,
						trimEnd: 0,
						opacity: config.logoOpacity,
						transform: {
							scale: config.logoScale,
							position: {
								x: posOffset.x * canvasSize.width,
								y: posOffset.y * canvasSize.height,
							},
							rotate: 0,
						},
					},
				});
				newTrackIds.push(imgTrackId);
			} catch (err) {
				console.error("Failed to add logo:", err);
				toast.error("Failed to add logo.");
			}
		}

		if (newTrackIds.length === 0) {
			toast.info("Fill in at least one brand field first.");
			return;
		}

		setAppliedTrackIds((prev) => [...prev, ...newTrackIds]);
		toast.success(`Applied ${newTrackIds.length} brand element${newTrackIds.length > 1 ? "s" : ""}`);
	}, [editor, config]);

	// ── Add Lower Third ──
	const handleAddLowerThird = useCallback(() => {
		const totalDuration = editor.timeline.getTotalDuration();
		if (totalDuration <= 0) { toast.error("Add media first."); return; }

		const canvasSize = editor.project.getActive().settings.canvasSize;
		const trackId = editor.timeline.addTrack({ type: "text", index: 0 });
		editor.timeline.renameTrack({ trackId, name: "Brand: Lower Third" });

		const nameText = config.channelName || "Speaker Name";
		const titleText = config.tagline || "Title / Role";

		editor.timeline.insertElement({
			placement: { mode: "explicit", trackId },
			element: {
				...DEFAULT_TEXT_ELEMENT,
				name: "Lower Third",
				content: `${nameText}\n${titleText}`,
				fontSize: 4,
				fontFamily: config.headingFont,
				fontWeight: "bold",
				color: config.textColor,
				textAlign: "left",
				startTime: 0,
				duration: Math.min(8, totalDuration),
				trimStart: 0,
				trimEnd: 0,
				opacity: 1,
				lineHeight: 1.5,
				background: {
					enabled: true,
					color: config.secondaryColor,
					cornerRadius: 6,
					paddingX: 20,
					paddingY: 12,
					offsetX: 0,
					offsetY: 0,
				},
				transform: { scale: 1, position: { x: -canvasSize.width * 0.2, y: canvasSize.height * 0.35 }, rotate: 0 },
			},
		});

		setAppliedTrackIds((prev) => [...prev, trackId]);
		toast.success("Lower third added");
	}, [editor, config]);

	// ── Helper: add logo image to a specific time range ──
	const addLogoToTimeRange = useCallback(async (startTime: number, duration: number, yOffset: number): Promise<string | null> => {
		if (!config.logoFile) return null;

		try {
			const activeProject = editor.project.getActive();
			const canvasSize = activeProject.settings.canvasSize;
			const logoUrl = URL.createObjectURL(config.logoFile);
			const mediaId = await editor.media.addMediaAsset({
				projectId: activeProject.metadata.id,
				asset: {
					name: `brand-logo-card-${Date.now()}`,
					type: "image",
					file: config.logoFile,
					url: logoUrl,
				},
			});

			const imgTrackId = editor.timeline.addTrack({ type: "video", index: 0 });
			editor.timeline.renameTrack({ trackId: imgTrackId, name: "Brand: Card Logo" });
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId: imgTrackId },
				element: {
					type: "image",
					mediaId,
					name: "Card Logo",
					startTime,
					duration,
					trimStart: 0,
					trimEnd: 0,
					opacity: 1,
					transform: {
						scale: 0.15,
						position: { x: 0, y: canvasSize.height * yOffset },
						rotate: 0,
					},
				},
			});
			return imgTrackId;
		} catch (err) {
			console.error("Failed to add logo to card:", err);
			return null;
		}
	}, [editor, config.logoFile]);

	// ── Add Intro Card ──
	const handleAddIntroCard = useCallback(async () => {
		const totalDuration = editor.timeline.getTotalDuration();
		if (totalDuration <= 0) { toast.error("Add media first."); return; }

		const canvasSize = editor.project.getActive().settings.canvasSize;
		const cardDuration = 3;
		const ids: string[] = [];

		// Add logo above the text
		if (config.logoFile) {
			const logoTrackId = await addLogoToTimeRange(0, cardDuration, -0.2);
			if (logoTrackId) ids.push(logoTrackId);
		}

		// Add text card (positioned lower if logo exists)
		const textY = config.logoFile ? 0.1 : 0;
		const trackId = editor.timeline.addTrack({ type: "text", index: 0 });
		editor.timeline.renameTrack({ trackId, name: "Brand: Intro" });

		const content = [
			config.channelName || "Channel Name",
			config.tagline ? `\n${config.tagline}` : "",
		].join("");

		editor.timeline.insertElement({
			placement: { mode: "explicit", trackId },
			element: {
				...DEFAULT_TEXT_ELEMENT,
				name: "Intro Card",
				content,
				fontSize: 12,
				fontFamily: config.headingFont,
				fontWeight: "bold",
				color: config.textColor,
				textAlign: "center",
				startTime: 0,
				duration: cardDuration,
				trimStart: 0,
				trimEnd: 0,
				opacity: 1,
				lineHeight: 1.6,
				background: {
					enabled: !config.logoFile,
					color: config.primaryColor,
					cornerRadius: 0,
					paddingX: 60,
					paddingY: 40,
					offsetX: 0,
					offsetY: 0,
				},
				transform: { scale: 1, position: { x: 0, y: canvasSize.height * textY }, rotate: 0 },
			},
		});
		ids.push(trackId);

		setAppliedTrackIds((prev) => [...prev, ...ids]);
		toast.success("Intro card added at start");
	}, [editor, config, addLogoToTimeRange]);

	// ── Add Outro Card ──
	const handleAddOutroCard = useCallback(async () => {
		const totalDuration = editor.timeline.getTotalDuration();
		if (totalDuration <= 0) { toast.error("Add media first."); return; }

		const canvasSize = editor.project.getActive().settings.canvasSize;
		const cardDuration = 4;
		const cardStart = Math.max(0, totalDuration - cardDuration);
		const ids: string[] = [];

		// Add logo above the text
		if (config.logoFile) {
			const logoTrackId = await addLogoToTimeRange(cardStart, cardDuration, -0.2);
			if (logoTrackId) ids.push(logoTrackId);
		}

		// Add text card
		const textY = config.logoFile ? 0.1 : 0;
		const trackId = editor.timeline.addTrack({ type: "text", index: 0 });
		editor.timeline.renameTrack({ trackId, name: "Brand: Outro" });

		const lines = [
			config.ctaText || "Thanks for watching!",
			config.socialHandle ? `\n${config.socialHandle}` : "",
			config.websiteUrl ? `\n${config.websiteUrl}` : "",
		].join("");

		editor.timeline.insertElement({
			placement: { mode: "explicit", trackId },
			element: {
				...DEFAULT_TEXT_ELEMENT,
				name: "Outro Card",
				content: lines,
				fontSize: 8,
				fontFamily: config.headingFont,
				fontWeight: "bold",
				color: config.textColor,
				textAlign: "center",
				startTime: cardStart,
				duration: cardDuration,
				trimStart: 0,
				trimEnd: 0,
				opacity: 1,
				lineHeight: 1.8,
				background: {
					enabled: !config.logoFile,
					color: config.secondaryColor,
					cornerRadius: 0,
					paddingX: 60,
					paddingY: 40,
					offsetX: 0,
					offsetY: 0,
				},
				transform: { scale: 1, position: { x: 0, y: canvasSize.height * textY }, rotate: 0 },
			},
		});
		ids.push(trackId);

		setAppliedTrackIds((prev) => [...prev, ...ids]);
		toast.success("Outro card added at end");
	}, [editor, config, addLogoToTimeRange]);

	// ── Remove All ──
	const handleRemoveBrand = useCallback(() => {
		for (const trackId of appliedTrackIds) {
			try { editor.timeline.removeTrack({ trackId }); } catch { /* */ }
		}
		setAppliedTrackIds([]);
		toast.success("Brand overlays removed");
	}, [editor, appliedTrackIds]);

	return (
		<PanelView title="Brand Kit">
			<div className="flex flex-col gap-4 pb-6">
				<p className="text-xs text-muted-foreground leading-relaxed">
					Define your brand identity once and apply it consistently across all your clips.
				</p>

				{/* ── Identity ── */}
				<div className="flex flex-col gap-2">
					<Label className="text-xs font-medium">Identity</Label>
					<Input value={config.channelName} onChange={(e) => update({ channelName: e.target.value })} placeholder="Channel / Brand name" className="h-8 text-xs" />
					<Input value={config.tagline} onChange={(e) => update({ tagline: e.target.value })} placeholder="Tagline or subtitle" className="h-8 text-xs" />
				</div>

				{/* ── Social & CTA ── */}
				<div className="border-t pt-3 flex flex-col gap-2">
					<Label className="text-xs font-medium">Social & CTA</Label>
					<Input value={config.socialHandle} onChange={(e) => update({ socialHandle: e.target.value })} placeholder="@handle" className="h-8 text-xs" />
					<Input value={config.websiteUrl} onChange={(e) => update({ websiteUrl: e.target.value })} placeholder="website.com" className="h-8 text-xs" />
					<Input value={config.ctaText} onChange={(e) => update({ ctaText: e.target.value })} placeholder="Subscribe for more!" className="h-8 text-xs" />
				</div>

				{/* ── Brand Colors ── */}
				<div className="border-t pt-3 flex flex-col gap-2">
					<Label className="text-xs font-medium">Brand colors</Label>
					<div className="grid grid-cols-2 gap-2">
						<ColorSwatch color={config.primaryColor} onChange={(c) => update({ primaryColor: c })} label="Primary" />
						<ColorSwatch color={config.secondaryColor} onChange={(c) => update({ secondaryColor: c })} label="Secondary" />
						<ColorSwatch color={config.accentColor} onChange={(c) => update({ accentColor: c })} label="Accent" />
						<ColorSwatch color={config.textColor} onChange={(c) => update({ textColor: c })} label="Text" />
					</div>
				</div>

				{/* ── Typography ── */}
				<div className="border-t pt-3 flex flex-col gap-2">
					<Label className="text-xs font-medium">Typography</Label>
					<div className="flex flex-col gap-2.5">
						<div className="flex flex-col gap-1">
							<span className="text-[10px] text-muted-foreground">Heading font</span>
							<FontPicker
								defaultValue={config.headingFont}
								onValueChange={(v) => update({ headingFont: v })}
							/>
						</div>
						<div className="flex flex-col gap-1">
							<span className="text-[10px] text-muted-foreground">Body font</span>
							<FontPicker
								defaultValue={config.bodyFont}
								onValueChange={(v) => update({ bodyFont: v })}
							/>
						</div>
					</div>
				</div>

				{/* ── Logo ── */}
				<div className="border-t pt-3 flex flex-col gap-2">
					<Label className="text-xs font-medium">Logo</Label>
					{config.logoPreviewUrl ? (
						<div className="flex items-center gap-3">
							<div className="size-12 rounded-md border bg-muted/50 flex items-center justify-center overflow-hidden">
								<img src={config.logoPreviewUrl} alt="Brand logo" className="max-h-full max-w-full object-contain" />
							</div>
							<Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={handleRemoveLogo}>
								Remove
							</Button>
						</div>
					) : (
						<Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
							Upload logo
						</Button>
					)}
					<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

					<div className="flex flex-col gap-1.5">
						<Select value={config.logoPosition} onValueChange={(v) => update({ logoPosition: v as LogoPosition })}>
							<SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="top-left">Top Left</SelectItem>
								<SelectItem value="top-right">Top Right</SelectItem>
								<SelectItem value="bottom-left">Bottom Left</SelectItem>
								<SelectItem value="bottom-right">Bottom Right</SelectItem>
							</SelectContent>
						</Select>

						<div className="flex items-center justify-between">
							<span className="text-[10px] text-muted-foreground">Opacity</span>
							<span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(config.logoOpacity * 100)}%</span>
						</div>
						<Slider value={[config.logoOpacity]} onValueChange={([v]) => update({ logoOpacity: v })} min={0.1} max={1} step={0.05} />

						<div className="flex items-center justify-between">
							<span className="text-[10px] text-muted-foreground">Size</span>
							<span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(config.logoScale * 100)}%</span>
						</div>
						<Slider value={[config.logoScale]} onValueChange={([v]) => update({ logoScale: v })} min={0.05} max={0.5} step={0.01} />
					</div>
				</div>

				{/* ── Quick Add ── */}
				<div className="border-t pt-3 flex flex-col gap-2">
					<Label className="text-xs font-medium">Quick add</Label>
					<div className="grid grid-cols-2 gap-1.5">
						<Button variant="outline" size="sm" className="text-[11px] h-8" onClick={handleAddLowerThird}>
							Lower Third
						</Button>
						<Button variant="outline" size="sm" className="text-[11px] h-8" onClick={handleAddIntroCard}>
							Intro Card
						</Button>
						<Button variant="outline" size="sm" className="text-[11px] h-8" onClick={handleAddOutroCard}>
							Outro Card
						</Button>
					</div>
				</div>

				{/* ── Apply / Remove ── */}
				<div className="border-t pt-3 flex flex-col gap-2">
					<Button variant="default" size="sm" className="w-full" onClick={handleApplyBrand}>
						Apply full brand overlay
					</Button>
					{appliedTrackIds.length > 0 && (
						<Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive" onClick={handleRemoveBrand}>
							Remove all brand overlays ({appliedTrackIds.length})
						</Button>
					)}
				</div>
			</div>
		</PanelView>
	);
}
