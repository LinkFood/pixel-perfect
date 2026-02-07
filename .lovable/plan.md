

# Fix Dev Auto-Fill Dropdown

## Problem
The Auto-Fill dropdown uses CSS `group-hover` to show/hide, but there's a 4px gap (`mt-1`) between the button and the dropdown menu. When you move your mouse from the button to the dropdown options, your cursor crosses that gap, the hover state drops, and the menu disappears before you can click anything.

## Fix

**File: `src/pages/ProjectInterview.tsx`**

Replace the CSS hover-based dropdown with a React state-controlled dropdown using `useState`:

1. Add a `showDevMenu` state variable (`useState(false)`)
2. Replace `group-hover:block` / `hidden` classes with conditional rendering based on `showDevMenu`
3. Toggle `showDevMenu` on button click instead of relying on hover
4. Add a click-outside handler (or onBlur) to close the menu when clicking elsewhere
5. Remove the `mt-1` gap that causes the hover disconnect (or keep it since we won't rely on hover anymore)

This is a small, isolated change -- just the dropdown interaction pattern. No other files need to change.

## Technical Detail

```text
Before:  <div className="relative group">
           <Button ...>Dev: Auto-Fill</Button>
           <div className="... hidden group-hover:block ...">  <-- CSS hover, breaks on gap
             ...options...
           </div>
         </div>

After:   <div className="relative">
           <Button onClick={() => setShowDevMenu(!showDevMenu)}>Dev: Auto-Fill</Button>
           {showDevMenu && (
             <div className="... z-50" onMouseLeave={() => setShowDevMenu(false)}>
               ...options (each onClick also closes menu)...
             </div>
           )}
         </div>
```

## Toast Check
No toast errors were found in the console logs. The toasts (success/error notifications) from the interview and auto-fill features appear to be functioning correctly.

