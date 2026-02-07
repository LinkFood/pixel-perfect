import { useState, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw, ImageIcon, Loader2 } from "lucide-react";

interface PageEditorProps {
  pageId: string;
  textContent: string | null;
  illustrationPrompt: string | null;
  isApproved: boolean;
  onUpdateText: (text: string) => void;
  onToggleApprove: (approved: boolean) => void;
  onRegenerateText?: () => Promise<void>;
  onRegenerateIllustration?: () => Promise<void>;
}

const PageEditor = ({
  textContent, illustrationPrompt, isApproved,
  onUpdateText, onToggleApprove, onRegenerateText, onRegenerateIllustration,
}: PageEditorProps) => {
  const [text, setText] = useState(textContent || "");
  const [regenTextLoading, setRegenTextLoading] = useState(false);
  const [regenIllLoading, setRegenIllLoading] = useState(false);

  useEffect(() => { setText(textContent || ""); }, [textContent]);

  const handleBlur = useCallback(() => {
    if (text !== (textContent || "")) onUpdateText(text);
  }, [text, textContent, onUpdateText]);

  const handleRegenText = async () => {
    if (!onRegenerateText) return;
    setRegenTextLoading(true);
    try { await onRegenerateText(); } finally { setRegenTextLoading(false); }
  };

  const handleRegenIll = async () => {
    if (!onRegenerateIllustration) return;
    setRegenIllLoading(true);
    try { await onRegenerateIllustration(); } finally { setRegenIllLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="font-display text-sm">Page Text</Label>
          {onRegenerateText && (
            <Button variant="ghost" size="sm" onClick={handleRegenText} disabled={regenTextLoading} className="gap-1.5 text-xs">
              {regenTextLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Regenerate Text
            </Button>
          )}
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          rows={6}
          className="font-body text-sm resize-none rounded-xl"
          placeholder="Edit the story text for this page..."
        />
      </div>

      {illustrationPrompt && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="font-display text-sm">Illustration Prompt</Label>
            {onRegenerateIllustration && (
              <Button variant="ghost" size="sm" onClick={handleRegenIll} disabled={regenIllLoading} className="gap-1.5 text-xs">
                {regenIllLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                Regenerate Image
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-body bg-secondary/50 rounded-xl p-3">
            {illustrationPrompt}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Checkbox
          id="approve"
          checked={isApproved}
          onCheckedChange={(v) => onToggleApprove(!!v)}
          className="border-primary data-[state=checked]:bg-primary"
        />
        <Label htmlFor="approve" className="font-body text-sm cursor-pointer">Approve this page</Label>
      </div>
    </div>
  );
};

export default PageEditor;
