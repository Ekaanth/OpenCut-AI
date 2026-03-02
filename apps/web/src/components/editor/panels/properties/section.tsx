import { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/utils/ui";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDownIcon } from "@hugeicons/core-free-icons";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const sectionExpandedCache = new Map<string, boolean>();
const mountedSectionKeys = new Set<string>();

interface SectionContext {
	isOpen: boolean;
	toggle: () => void;
	collapsible: boolean;
}

const SectionCtx = createContext<SectionContext | null>(null);

function useSectionContext() {
	return useContext(SectionCtx);
}

interface SectionProps {
	children: React.ReactNode;
	collapsible?: boolean;
	defaultOpen?: boolean;
	sectionKey?: string;
	className?: string;
	showTopBorder?: boolean;
	showBottomBorder?: boolean;
}

export function Section({
	children,
	collapsible = false,
	defaultOpen = true,
	sectionKey,
	className,
	showTopBorder = true,
	showBottomBorder = true,
}: SectionProps) {
	const cached = sectionKey ? sectionExpandedCache.get(sectionKey) : undefined;
	const [isOpen, setIsOpen] = useState(cached ?? defaultOpen);

	useEffect(() => {
		if (!sectionKey) return;
		if (process.env.NODE_ENV !== "production" && mountedSectionKeys.has(sectionKey)) {
			console.error(`[Section] duplicate sectionKey mounted simultaneously: "${sectionKey}"`);
		}
		mountedSectionKeys.add(sectionKey);
		return () => { mountedSectionKeys.delete(sectionKey); };
	}, [sectionKey]);

	const toggle = () => {
		const next = !isOpen;
		setIsOpen(next);
		if (sectionKey) sectionExpandedCache.set(sectionKey, next);
	};

	return (
		<SectionCtx.Provider value={{ isOpen, toggle, collapsible }}>
			<div
				className={cn(
					"flex flex-col",
				showTopBorder && "border-t",
				showBottomBorder && "last:border-b",
					className,
				)}
			>
				{children}
			</div>
		</SectionCtx.Provider>
	);
}

interface SectionHeaderProps {
	children?: React.ReactNode;
	trailing?: React.ReactNode;
	leading?: React.ReactNode;
	actions?: React.ReactNode;
	onClick?: () => void;
	className?: string;
}

export function SectionHeader({
	children,
	trailing,
	leading,
	actions,
	onClick,
	className,
}: SectionHeaderProps) {
	const ctx = useSectionContext();
	const isCollapsible = ctx?.collapsible ?? false;
	const isOpen = ctx?.isOpen ?? true;
	const isInteractive = isCollapsible || !!onClick;
	const handleClick = isCollapsible ? ctx?.toggle : onClick;

	const chevronIcon = isCollapsible ? (
		<HugeiconsIcon
			icon={ArrowDownIcon}
			className={cn(
				"size-4 shrink-0 transition-transform duration-200 ease-out",
				isOpen ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground",
			)}
		/>
	) : null;

	const headerContent = (
		<>
			{leading}
			<div className="min-w-0 flex-1">{children}</div>
			{(trailing || chevronIcon) && (
				<div className="flex items-center">
					{trailing}
					{chevronIcon && (
						<Button
							variant="ghost"
							size="icon"
							aria-label={isOpen ? "Collapse section" : "Expand section"}
							onClick={(event) => {
								event.stopPropagation();
								handleClick?.();
							}}
						>
							{chevronIcon}
						</Button>
					)}
				</div>
			)}
			{actions}
		</>
	);

	if (!isInteractive) {
		return (
			<div className={cn("flex h-11 w-full items-center gap-2 px-3.5", className)}>
				{headerContent}
			</div>
		);
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: outer div intentionally wraps a nested <Button> (chevron), making <button> invalid HTML here
		<div
			role="button"
			tabIndex={0}
			className={cn(
				"flex h-11 w-full cursor-pointer items-center gap-2 px-3.5",
				className,
			)}
			onClick={handleClick}
			onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") handleClick?.(); }}
		>
			{headerContent}
		</div>
	);
}

export function SectionTitle({
	children,
	className,
	onClick,
}: {
	children: React.ReactNode;
	className?: string;
	onClick?: () => void;
}) {
	const ctx = useSectionContext();
	const isOpen = ctx?.isOpen ?? true;

	if (onClick) {
		return (
			<button
				type="button"
				className={cn(
					"cursor-pointer text-sm font-medium",
					isOpen ? "text-foreground" : "text-muted-foreground",
					className,
				)}
				onClick={onClick}
			>
				{children}
			</button>
		);
	}

	return (
		<span
			className={cn(
				"text-sm font-medium",
				isOpen ? "text-foreground" : "text-muted-foreground",
				className,
			)}
		>
			{children}
		</span>
	);
}

export function SectionFields({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-3.5", className)}>{children}</div>
	);
}

export function SectionField({
	label,
	beforeLabel,
	children,
	className,
}: {
	label: string;
	beforeLabel?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<div className="flex h-4 items-center gap-1.5">
				{beforeLabel}
				<Label>{label}</Label>
			</div>
			{children}
		</div>
	);
}

export function SectionContent({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	const ctx = useSectionContext();
	const isCollapsible = ctx?.collapsible ?? false;
	const isOpen = ctx?.isOpen ?? true;

	if (isCollapsible) {
		return (
			<div
				className={cn(
					"grid transition-[grid-template-rows] duration-100 ease-out",
					isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
				)}
			>
				<div className="overflow-hidden">
					<div className={cn("p-4 pt-0", className)}>{children}</div>
				</div>
			</div>
		);
	}

	return <div className={cn("p-4 pt-0", className)}>{children}</div>;
}
