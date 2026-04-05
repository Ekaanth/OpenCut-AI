"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useYouTubeReelsStore } from "@/stores/youtube-reels-store";

export function ConfigPanel({ onStart }: { onStart: () => void }) {
	const config = useYouTubeReelsStore((s) => s.config);
	const setConfig = useYouTubeReelsStore((s) => s.setConfig);

	return (
		<div className="space-y-4">
			<h3 className="text-sm font-semibold">Clip Settings</h3>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1">
					<Label className="text-xs">Max Duration</Label>
					<Select
						value={String(config.maxDuration)}
						onValueChange={(v) => setConfig({ maxDuration: Number(v) })}
					>
						<SelectTrigger className="h-8 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="15">15 seconds</SelectItem>
							<SelectItem value="30">30 seconds</SelectItem>
							<SelectItem value="60">60 seconds</SelectItem>
							<SelectItem value="90">90 seconds</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1">
					<Label className="text-xs">Max Clips</Label>
					<Select
						value={String(config.maxClips)}
						onValueChange={(v) => setConfig({ maxClips: Number(v) })}
					>
						<SelectTrigger className="h-8 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="5">5 clips</SelectItem>
							<SelectItem value="10">10 clips</SelectItem>
							<SelectItem value="20">20 clips</SelectItem>
							<SelectItem value="30">30 clips</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1">
					<Label className="text-xs">Output Format</Label>
					<Select
						value={config.outputFormat}
						onValueChange={(v) => setConfig({ outputFormat: v as "9:16" | "1:1" | "4:5" })}
					>
						<SelectTrigger className="h-8 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="9:16">9:16 (Reels/Shorts)</SelectItem>
							<SelectItem value="1:1">1:1 (Square)</SelectItem>
							<SelectItem value="4:5">4:5 (Instagram Feed)</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1">
					<Label className="text-xs">Caption Style</Label>
					<Select
						value={config.captionStyle}
						onValueChange={(v) => setConfig({ captionStyle: v as "modern" | "karaoke" | "classic" | "none" })}
					>
						<SelectTrigger className="h-8 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="modern">Modern</SelectItem>
							<SelectItem value="karaoke">Karaoke</SelectItem>
							<SelectItem value="classic">Classic</SelectItem>
							<SelectItem value="none">No Captions</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label className="text-xs">Auto-Reframe (16:9 to 9:16)</Label>
					<Switch checked={config.autoReframe} onCheckedChange={(v) => setConfig({ autoReframe: v })} />
				</div>
				<div className="flex items-center justify-between">
					<Label className="text-xs">Add Hook Text</Label>
					<Switch checked={config.addHook} onCheckedChange={(v) => setConfig({ addHook: v })} />
				</div>
			</div>

			<Button className="w-full" onClick={onStart}>
				Find Clips
			</Button>
		</div>
	);
}
