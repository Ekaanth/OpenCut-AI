export function ClaudeIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
			<path d="M8 12h8" />
			<path d="M12 8v8" />
			<path d="M9 9l6 6" />
			<path d="M15 9l-6 6" />
		</svg>
	);
}

export function CursorIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M5 3l14 9-6 2-4 6-4-17z" />
		</svg>
	);
}

export function DockerIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<rect x="2" y="10" width="20" height="10" rx="2" />
			<rect x="5" y="6" width="3" height="4" />
			<rect x="9" y="4" width="3" height="6" />
			<rect x="13" y="6" width="3" height="4" />
			<rect x="17" y="7" width="3" height="3" />
		</svg>
	);
}

export function OllamaIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="9" r="6" />
			<path d="M8 14c-2.67 1-4 3-4 5h16c0-2-1.33-4-4-5" />
			<circle cx="10" cy="8" r="1" fill="currentColor" />
			<circle cx="14" cy="8" r="1" fill="currentColor" />
		</svg>
	);
}
