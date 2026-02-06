import { useState, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface PageEditorProps {
  pageId: string;
  textContent: string | null;
  illustrationPrompt: string | null;
  isApproved: boolean;
  onUpdateText: (text: string) => void;
  onToggleApprove: (approved: boolean) => void;
}

const PageEditor = ({ textContent, illustrationPrompt, isApproved, onUpdateText, onToggleApprove }: PageEditorProps) => {
  const [text, setText] = useState(textContent || "");

  useEffect(() => { setText(textContent || ""); }, [textContent]);

  const handleBlur = useCallback(() => {
    if (text !== (textContent || "")) onUpdateText(text);
  }, [text, textContent, onUpdateText]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="font-display text-sm">Page Text</Label>
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
          <Label className="font-display text-sm">Illustration Prompt</Label>
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
