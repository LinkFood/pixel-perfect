

# Add Rename and Delete to Project Shelf Tabs

## What Changes

The project tabs at the bottom of the workspace currently only let you switch between projects. We'll add the ability to **rename** and **delete** projects directly from those tabs via a right-click/long-press context menu or tap-accessible controls.

## UX Design

Each project tab will get a small context menu (using Radix DropdownMenu) that appears when you click a "..." button on the active tab, or right-click any tab. The menu will have two options:

- **Rename** -- opens an inline editable text field replacing the project name on the tab. Press Enter or blur to save.
- **Delete** -- shows a confirmation dialog (reusing the existing AlertDialog pattern from the Dashboard) before permanently deleting the project and all its data.

The "..." button only appears on the currently active tab to keep things clean. Inactive tabs can still be right-clicked for the menu.

## Technical Details

### File: `src/components/workspace/ProjectShelf.tsx`

1. **Add new props**: `onRename(projectId, newName)` and `onDelete(projectId)`
2. **Add local state**: `editingId` (which project is being renamed) and `editName` (current input value)
3. **Add DropdownMenu** on each tab with "Rename" and "Delete" options
4. **Rename mode**: When "Rename" is clicked, replace the name `<p>` with an `<input>` field. Enter/blur saves via `onRename`. Escape cancels.
5. **Delete**: Show an AlertDialog confirmation before calling `onDelete`
6. **Imports**: Add `DropdownMenu` components, `AlertDialog` components, `Input`, `Pencil`, `Trash2`, `MoreHorizontal` from lucide

### File: `src/components/workspace/Workspace.tsx`

1. **Wire up `onRename`**: Call `updateProject.mutate({ id, pet_name: newName })` 
2. **Wire up `onDelete`**: Call `deleteProject.mutate(projectId)` and clear `activeProjectId` if the deleted project was active
3. **Pass both new callbacks** to all 4-5 `<ProjectShelf>` instances in the file

### No database changes needed
The existing `useUpdateProject` and `useDeleteProject` hooks already handle rename and delete operations -- we just need to surface them in the ProjectShelf UI.

