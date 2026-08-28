import { useEffect, useRef, useCallback } from 'react';

export type WindowId =
  | 'location_picker'       // Level 3: Location Selector sub-mode
  | 'pdf_preview'           // Level 3: PDF Document Viewer Modal
  | 'field_report'          // Level 2: Field Report Creation & Edit Modal
  | 'reports_summary'       // Level 2: Accomplishment Reports Summary (Ledger / WMR / Photos)
  | 'layer_panel'           // Level 2: GIS Layers Bottom Drawer
  | 'location_filter'       // Level 2: Partition & NIS Filter Modal
  | 'sync_modal'            // Level 2: Data Synchronization Modal
  | 'upload_modal'          // Level 2: GIS Layer Upload Modal
  | 'attribute_inspector'   // Level 2: Selected Feature Attribute Inspector Drawer
  | 'dev_panel'             // Level 2: Developer User Management Modal
  | 'help_modal';           // Level 2: Help & Quick Guide Modal

interface UseMobileBackStackProps {
  onCloseWindow: (windowId: WindowId) => void;
  onExitAppRequested: () => void;
}

export function useMobileBackStack({
  onCloseWindow,
  onExitAppRequested
}: UseMobileBackStackProps) {
  // LIFO Stack of active open windows
  const stackRef = useRef<WindowId[]>([]);
  const isHandlingPopRef = useRef(false);

  // Initialize History Safety Trap on Mount
  useEffect(() => {
    try {
      // Replace initial state with base anchor
      window.history.replaceState({ app: 'nia_gis_base', depth: 0 }, '');
      // Push the active navigation trap
      window.history.pushState({ app: 'nia_gis_trap', depth: 1 }, '');
    } catch (_) {}

    const handlePopState = (event: PopStateEvent) => {
      // Prevent recursive trigger loops
      if (isHandlingPopRef.current) return;

      const currentStack = stackRef.current;

      if (currentStack.length > 0) {
        // Step 1: Pop the topmost window/mode from stack
        const topWindow = currentStack.pop();

        // Step 2: Trigger its specific close handler
        if (topWindow) {
          onCloseWindow(topWindow);
        }

        // Step 3: Re-arm the history trap so subsequent Back presses are captured
        isHandlingPopRef.current = true;
        try {
          window.history.pushState({ app: 'nia_gis_trap', depth: 1 }, '');
        } catch (_) {}

        setTimeout(() => {
          isHandlingPopRef.current = false;
        }, 80);
      } else {
        // No windows open -> User is on Base Map
        onExitAppRequested();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onCloseWindow, onExitAppRequested]);

  // Method to register a window when it opens
  const pushWindow = useCallback((id: WindowId) => {
    // Avoid duplicate entries of the same window ID
    stackRef.current = stackRef.current.filter(item => item !== id);
    stackRef.current.push(id);
  }, []);

  // Method to remove a window when closed manually (e.g. tapping "X" or "Submit")
  const removeWindow = useCallback((id: WindowId) => {
    stackRef.current = stackRef.current.filter(item => item !== id);
  }, []);

  // Method to clear all active windows from stack (e.g. on full logout)
  const clearStack = useCallback(() => {
    stackRef.current = [];
  }, []);

  return { pushWindow, removeWindow, clearStack };
}
