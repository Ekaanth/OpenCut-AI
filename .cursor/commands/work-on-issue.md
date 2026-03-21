# Work on OpenCut AI Issue

Work on the specified issue from the OpenCut AI issue tracker.

## Instructions

1. Read the issue from `opencut-ai-issues-with-skills.md` in the repo root
2. Check the **Depends on** field — verify prerequisites are complete by checking if the relevant code/files exist
3. Read all relevant existing code before making changes
4. Follow the **Steps** in the issue precisely
5. Match existing code patterns:
   - TypeScript: use destructured props, `cn()` for classNames, Zustand selectors for high-frequency stores
   - Python: singleton + lazy loading for services, Pydantic models for request/response
   - React: components in `components/editor/ai/`, hooks in `hooks/`, types in `types/`
6. After implementation, verify all **Acceptance criteria**

## Input

Issue ID (e.g., OCAI-011) or issue title to work on: {{issue}}
