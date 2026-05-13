/**
 * 4×36pt pill used at the top of bottom sheets. Spec §SHEET-AP.
 * Visual affordance for the drag-to-dismiss gesture the sheets already
 * support via Framer Motion's drag prop.
 */
export function DragHandle({ className }: { className?: string }) {
  return (
    <div className={`flex justify-center pt-2 pb-1 ${className ?? ''}`}>
      <div
        className="h-1 w-9 rounded-full"
        style={{ background: 'hsl(0 0% 100% / 0.3)' }}
        aria-hidden="true"
      />
    </div>
  );
}
