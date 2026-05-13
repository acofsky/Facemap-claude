import { useState } from "react";
import { Sparkles, ChevronRight, X, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AI_MODEL_LABEL, AI_PROVIDER_LABEL } from "./AIBadge";
import { DragHandle } from "@/components/DragHandle";
import { haptics } from "@/lib/haptics";

const FEATURES = [
  {
    title: "Recall search",
    detail:
      "Your free-text query is sent to the model alongside the names, notes, and physical descriptions of the people you've added. It returns the closest matches with a short reason.",
  },
  {
    title: "Pre-meeting brief",
    detail:
      "When you ask for a brief on someone, their stored profile (notes, encounters, circles) is sent to the model, which writes a one-page refresher you can copy.",
  },
  {
    title: "Photo description",
    detail:
      "When you tap the wand on a photo, the image is sent to the model, which returns a short bulleted description you can edit or delete.",
  },
];

interface AIDisclosureProps {
  className?: string;
}

/**
 * Settings row + slide-up sheet that lists every AI surface in Membr.
 * Reachable from Profile. Apple expects this kind of plain-language
 * disclosure under App Store Review Guideline 2.5.18.
 */
export function AIDisclosure({ className }: AIDisclosureProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          "w-full flex items-center gap-3 px-4 py-3.5 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)] transition-colors text-left " +
          (className ?? "")
        }
      >
        <Sparkles className="w-4 h-4 text-muted-text" strokeWidth={1.75} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">Where AI is used in Membr</div>
          <div className="text-[11px] text-muted-text mt-0.5">
            {AI_MODEL_LABEL} · {AI_PROVIDER_LABEL}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-text" strokeWidth={1.75} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 380 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  haptics.light();
                  setOpen(false);
                }
              }}
              className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md z-50 bg-surface-2 rounded-t-2xl border border-[hsl(0_0%_100%/0.12)] max-h-[85vh] flex flex-col safe-bottom"
            >
              <DragHandle />
              <div className="flex items-center justify-between px-5 pt-2 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  <h2 className="font-display text-xl text-foreground tracking-[-0.02em]">
                    Where AI is used
                  </h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              <div className="overflow-y-auto px-5 pb-6 space-y-4">
                <p className="text-sm text-foreground/90 leading-relaxed">
                  Three features in Membr use a generative AI model from {AI_PROVIDER_LABEL}, called{" "}
                  <span className="font-semibold">{AI_MODEL_LABEL}</span>. Everywhere else, the app
                  is just storing what you type.
                </p>

                <div className="space-y-3">
                  {FEATURES.map((f) => (
                    <div
                      key={f.title}
                      className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4"
                    >
                      <div className="text-sm font-semibold text-foreground mb-1">{f.title}</div>
                      <p className="text-[13px] text-muted-text leading-relaxed">{f.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4 flex gap-3">
                  <ShieldCheck className="w-4 h-4 text-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
                  <div className="text-[13px] text-muted-text leading-relaxed">
                    Membr does not use your data to train any AI model. Inputs are sent to{" "}
                    {AI_PROVIDER_LABEL}'s API for the single request and aren't retained for training.
                    AI output can be wrong — review it before relying on it.
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
