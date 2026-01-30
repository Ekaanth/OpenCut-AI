import { useState } from "react";
import { cn } from "@/utils/ui";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDownIcon } from "@hugeicons/core-free-icons";

interface PropertyItemProps {
	direction?: "row" | "column";
	children: React.ReactNode;
	className?: string;
}

export function PropertyItem({
	direction = "row",
	children,
	className,
}: PropertyItemProps) {
	return (
		<div
			className={cn(
				"flex gap-2",
				direction === "row"
					? "items-center justify-between gap-6"
					: "flex-col gap-1.5",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function PropertyItemLabel({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<span className={cn("text-muted-foreground text-xs", className)}>
			{children}
		</span>
	);
}

export function PropertyItemValue({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return <div className={cn("flex-1 text-sm", className)}>{children}</div>;
}

interface PropertyGroupProps {
	title: string;
	children: React.ReactNode;
	defaultExpanded?: boolean;
	className?: string;
	titleClassName?: string;
}

export function PropertyGroup({
	title,
	children,
	defaultExpanded = true,
	className,
	titleClassName,
}: PropertyGroupProps) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	return (
		<PropertyItem direction="column" className={cn("gap-3", className)}>
			<button
				type="button"
				className="flex items-center gap-1.5 cursor-pointer"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<PropertyItemLabel className={cn(titleClassName)}>
					{title}
				</PropertyItemLabel>
				<HugeiconsIcon
					icon={ArrowDownIcon}
					className={cn("size-3", !isExpanded && "-rotate-90")}
				/>
			</button>
			{isExpanded && <PropertyItemValue>{children}</PropertyItemValue>}
		</PropertyItem>
	);
}
