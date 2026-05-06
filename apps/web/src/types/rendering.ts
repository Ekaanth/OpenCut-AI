export interface Transform {
	scale: number;
	position: {
		x: number;
		y: number;
	};
	rotate: number;
}

export interface CropRect {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export interface MaskShape {
	type: "rectangle" | "ellipse" | "polygon";
	feather: number;
	inverted: boolean;
	points?: { x: number; y: number }[];
}

export type BlendMode =
	| "normal"
	| "darken"
	| "multiply"
	| "color-burn"
	| "lighten"
	| "screen"
	| "plus-lighter"
	| "color-dodge"
	| "overlay"
	| "soft-light"
	| "hard-light"
	| "difference"
	| "exclusion"
	| "hue"
	| "saturation"
	| "color"
	| "luminosity";
