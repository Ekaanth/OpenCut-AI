export interface ProjectTemplate {
	id: string;
	name: string;
	description: string;
	category: "social" | "business" | "education" | "entertainment" | "personal";
	aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
	estimatedDuration: number;
	tags: string[];
	previewUrl?: string;
	tracks: Array<{
		type: "video" | "audio" | "text";
		name: string;
		description: string;
	}>;
}

export const TEMPLATE_CATEGORIES = [
	{ value: "social", label: "Social Media" },
	{ value: "business", label: "Business" },
	{ value: "education", label: "Education" },
	{ value: "entertainment", label: "Entertainment" },
	{ value: "personal", label: "Personal" },
] as const;

export const BUILTIN_TEMPLATES: ProjectTemplate[] = [
	{
		id: "youtube-intro",
		name: "YouTube Intro",
		description: "Animated intro with logo reveal and music",
		category: "social",
		aspectRatio: "16:9",
		estimatedDuration: 10,
		tags: ["youtube", "intro", "animated"],
		tracks: [
			{ type: "video", name: "Logo Animation", description: "Logo reveal with particles" },
			{ type: "text", name: "Channel Name", description: "Bold text animation" },
			{ type: "audio", name: "Intro Music", description: "Upbeat intro jingle" },
		],
	},
	{
		id: "tiktok-vlog",
		name: "TikTok Vlog",
		description: "Vertical vlog template with captions and music",
		category: "social",
		aspectRatio: "9:16",
		estimatedDuration: 60,
		tags: ["tiktok", "vlog", "vertical"],
		tracks: [
			{ type: "video", name: "Main Video", description: "Full-screen vertical video" },
			{ type: "text", name: "Captions", description: "Auto-generated captions" },
			{ type: "audio", name: "Background Music", description: "Trending music" },
		],
	},
	{
		id: "podcast-highlight",
		name: "Podcast Highlight",
		description: "Podcast clip with waveforms and speaker labels",
		category: "entertainment",
		aspectRatio: "16:9",
		estimatedDuration: 60,
		tags: ["podcast", "highlight", "waveform"],
		tracks: [
			{ type: "video", name: "Video", description: "Main podcast video" },
			{ type: "audio", name: "Audio", description: "Enhanced audio" },
			{ type: "text", name: "Speaker Labels", description: "Color-coded speaker names" },
		],
	},
	{
		id: "product-review",
		name: "Product Review",
		description: "Product review with B-roll sections and ratings",
		category: "business",
		aspectRatio: "16:9",
		estimatedDuration: 180,
		tags: ["product", "review", "business"],
		tracks: [
			{ type: "video", name: "Main Camera", description: "Talking head" },
			{ type: "video", name: "B-Roll", description: "Product shots" },
			{ type: "text", name: "Scores", description: "Rating overlays" },
			{ type: "audio", name: "Narration", description: "Voiceover" },
		],
	},
	{
		id: "classroom-lesson",
		name: "Classroom Lesson",
		description: "Educational lesson with slides and annotations",
		category: "education",
		aspectRatio: "16:9",
		estimatedDuration: 300,
		tags: ["education", "lesson", "slides"],
		tracks: [
			{ type: "video", name: "Slides", description: "Presentation slides" },
			{ type: "video", name: "Camera", description: "Instructor camera (PIP)" },
			{ type: "text", name: "Annotations", description: "Key points" },
			{ type: "audio", name: "Narration", description: "Voice narration" },
		],
	},
	{
		id: "instagram-reel",
		name: "Instagram Reel",
		description: "Fast-paced reel with transitions and trending effects",
		category: "social",
		aspectRatio: "9:16",
		estimatedDuration: 30,
		tags: ["instagram", "reel", "fast"],
		tracks: [
			{ type: "video", name: "Main Clip", description: "Vertical video" },
			{ type: "text", name: "Hook Text", description: "Attention-grabbing text" },
			{ type: "audio", name: "Music", description: "Trending audio" },
		],
	},
	{
		id: "travel-vlog",
		name: "Travel Vlog",
		description: "Cinematic travel montage with maps and transitions",
		category: "personal",
		aspectRatio: "16:9",
		estimatedDuration: 120,
		tags: ["travel", "cinematic", "montage"],
		tracks: [
			{ type: "video", name: "Footage", description: "Travel footage" },
			{ type: "text", name: "Location Cards", description: "Place names" },
			{ type: "audio", name: "Music", description: "Cinematic score" },
			{ type: "audio", name: "Ambient", description: "Natural sounds" },
		],
	},
	{
		id: "tutorial-step",
		name: "Step-by-Step Tutorial",
		description: "Screen recording tutorial with numbered steps",
		category: "education",
		aspectRatio: "16:9",
		estimatedDuration: 180,
		tags: ["tutorial", "screencast", "steps"],
		tracks: [
			{ type: "video", name: "Screen Recording", description: "Screencast" },
			{ type: "text", name: "Step Numbers", description: "Step 1, 2, 3..." },
			{ type: "audio", name: "Voiceover", description: "Instructions" },
		],
	},
];
