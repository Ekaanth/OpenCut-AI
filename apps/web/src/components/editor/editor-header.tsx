"use client";

import { Button } from "../ui/button";
import { useMemo, useRef, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import Link from "next/link";
import { RenameProjectDialog } from "./dialogs/rename-project-dialog";
import { DeleteProjectDialog } from "./dialogs/delete-project-dialog";
import { useRouter } from "next/navigation";

import { ExportButton } from "./export-button";
import { ThemeToggle } from "../theme-toggle";
import { SOCIAL_LINKS } from "@/constants/site-constants";
import { toast } from "sonner";
import { useEditor } from "@/hooks/use-editor";
import { CommandIcon, Logout05Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShortcutsDialog } from "./dialogs/shortcuts-dialog";
import { OpenCutAILogo } from "@/components/footer";
import { cn } from "@/utils/ui";
import { AIStatusIndicator, type AIStatusInfo } from "@/components/editor/ai/ai-status-indicator";
import { useAIStatus } from "@/hooks/use-ai-status";
import { useAIStore } from "@/stores/ai-store";
import { aiClient } from "@/lib/ai-client";
import { MemoryStatusBar, type MemoryStatusInfo } from "@/components/editor/ai/memory-status-bar";
import { SaveStatus } from "@/components/editor/save-status";

export function EditorHeader() {
	const { isConnected, backendStatus, error, errorType, refresh } = useAIStatus();
	const toggleSetupGuide = useAIStore((s) => s.toggleSetupGuide);

	const memoryStatus: MemoryStatusInfo = useMemo(
		() => ({
			gpuUsedMb: backendStatus?.memoryUsage?.gpu?.usedMb ?? 0,
			gpuTotalMb: backendStatus?.memoryUsage?.gpu?.totalMb ?? 0,
			ramUsedMb: backendStatus?.memoryUsage?.ram?.usedMb ?? 0,
			ramTotalMb: backendStatus?.memoryUsage?.ram?.totalMb ?? 0,
		}),
		[backendStatus],
	);

	const aiStatusInfo: AIStatusInfo = useMemo(
		() => ({
			connected: isConnected,
			modelsLoaded: backendStatus?.models ?? [],
			memoryUsageMb: backendStatus?.memoryUsage?.ram?.usedMb ?? 0,
			memoryTotalMb: backendStatus?.memoryUsage?.ram?.totalMb ?? 0,
			gpuAvailable: backendStatus?.gpuAvailable ?? false,
			error: error ?? undefined,
			errorType: errorType ?? undefined,
			backendUrl: aiClient.getBaseUrl(),
		}),
		[isConnected, backendStatus, error, errorType],
	);

	return (
		<header className="bg-background flex h-[3.4rem] items-center justify-between px-3 pt-0.5">
			<div className="flex items-center gap-1">
				<ProjectDropdown />
				<EditableProjectName />
				<SaveStatus className="ml-2" />
			</div>
			<nav className="flex items-center gap-2">
				{isConnected && <MemoryStatusBar status={memoryStatus} />}
				<AIStatusIndicator
					status={aiStatusInfo}
					onSetupClick={toggleSetupGuide}
					onRefresh={refresh}
				/>
				<ExportButton />
				<ThemeToggle />
			</nav>
		</header>
	);
}

function ProjectDropdown() {
	const [openDialog, setOpenDialog] = useState<
		"delete" | "rename" | "shortcuts" | null
	>(null);
	const [isExiting, setIsExiting] = useState(false);
	const router = useRouter();
	const editor = useEditor();
	const activeProject = editor.project.getActive();

	const handleExit = async () => {
		if (isExiting) return;
		setIsExiting(true);

		try {
			await editor.project.prepareExit();
			editor.project.closeProject();
		} catch (error) {
			console.error("Failed to prepare project exit:", error);
		} finally {
			editor.project.closeProject();
			router.push("/projects");
		}
	};

	const handleSaveProjectName = async (newName: string) => {
		if (
			activeProject &&
			newName.trim() &&
			newName !== activeProject.metadata.name
		) {
			try {
				await editor.project.renameProject({
					id: activeProject.metadata.id,
					name: newName.trim(),
				});
			} catch (error) {
				toast.error("Failed to rename project", {
					description:
						error instanceof Error ? error.message : "Please try again",
				});
			} finally {
				setOpenDialog(null);
			}
		}
	};

	const handleDeleteProject = async () => {
		if (activeProject) {
			try {
				await editor.project.deleteProjects({
					ids: [activeProject.metadata.id],
				});
				router.push("/projects");
			} catch (error) {
				toast.error("Failed to delete project", {
					description:
						error instanceof Error ? error.message : "Please try again",
				});
			} finally {
				setOpenDialog(null);
			}
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className="p-0 rounded-sm size-10 [&_svg]:!size-auto">
						<OpenCutAILogo size={36} />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="z-100 w-44">
					<DropdownMenuItem
						onClick={handleExit}
						disabled={isExiting}
						icon={<HugeiconsIcon icon={Logout05Icon} />}
					>
						Exit project
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={() => setOpenDialog("shortcuts")}
						icon={<HugeiconsIcon icon={CommandIcon} />}
					>
						Shortcuts
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					</DropdownMenuContent>
			</DropdownMenu>
			<RenameProjectDialog
				isOpen={openDialog === "rename"}
				onOpenChange={(isOpen) => setOpenDialog(isOpen ? "rename" : null)}
				onConfirm={(newName) => handleSaveProjectName(newName)}
				projectName={activeProject?.metadata.name || ""}
			/>
			<DeleteProjectDialog
				isOpen={openDialog === "delete"}
				onOpenChange={(isOpen) => setOpenDialog(isOpen ? "delete" : null)}
				onConfirm={handleDeleteProject}
				projectNames={[activeProject?.metadata.name || ""]}
			/>
			<ShortcutsDialog
				isOpen={openDialog === "shortcuts"}
				onOpenChange={(isOpen) => setOpenDialog(isOpen ? "shortcuts" : null)}
			/>
		</>
	);
}

function EditableProjectName() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const originalNameRef = useRef("");

	const projectName = activeProject?.metadata.name || "";

	const startEditing = () => {
		if (isEditing) return;
		originalNameRef.current = projectName;
		setIsEditing(true);

		requestAnimationFrame(() => {
			inputRef.current?.select();
		});
	};

	const saveEdit = async () => {
		if (!inputRef.current || !activeProject) return;
		const newName = inputRef.current.value.trim();
		setIsEditing(false);

		if (!newName) {
			inputRef.current.value = originalNameRef.current;
			return;
		}

		if (newName !== originalNameRef.current) {
			try {
				await editor.project.renameProject({
					id: activeProject.metadata.id,
					name: newName,
				});
			} catch (error) {
				toast.error("Failed to rename project", {
					description:
						error instanceof Error ? error.message : "Please try again",
				});
			}
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			inputRef.current?.blur();
		} else if (event.key === "Escape") {
			event.preventDefault();
			if (inputRef.current) {
				inputRef.current.value = originalNameRef.current;
			}
			setIsEditing(false);
			inputRef.current?.blur();
		}
	};

	return (
		<input
			ref={inputRef}
			type="text"
			defaultValue={projectName}
			readOnly={!isEditing}
			onClick={startEditing}
			onBlur={saveEdit}
			onKeyDown={handleKeyDown}
			style={{ fieldSizing: "content" }}
			className={cn(
				"text-[0.9rem] h-8 px-2 py-1 rounded-sm bg-transparent outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground",
				isEditing && "ring-1 ring-ring cursor-text hover:bg-transparent",
			)}
		/>
	);
}
