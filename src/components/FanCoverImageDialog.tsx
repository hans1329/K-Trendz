import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Upload, Loader2, AlertTriangle, Image as ImageIcon } from "lucide-react";

interface FanCoverImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wikiEntryId: string;
  entryTitle: string;
  userId: string;
  userTokenBalance: number;
  onSuccess: () => void;
}

const REQUIRED_TOKENS = 3;

const FanCoverImageDialog = ({
  open,
  onOpenChange,
  wikiEntryId,
  entryTitle,
  userId,
  userTokenBalance,
  onSuccess
}: FanCoverImageDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = userTokenBalance >= REQUIRED_TOKENS;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 이미지 파일 검증
      if (!file.type.startsWith('image/')) {
        toast.error("Please select an image file");
        return;
      }
      // 최대 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !canUpload) return;

    setIsProcessing(true);
    try {
      // 1. 이미지 업로드
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${wikiEntryId}-cover-${Date.now()}.${fileExt}`;
      const filePath = `wiki-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('wiki-images')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload image');
      }

      // 2. Public URL 가져오기
      const { data: publicUrlData } = supabase.storage
        .from('wiki-images')
        .getPublicUrl(filePath);

      // 3. 토큰 소각 (burn-fanz-token 엣지 함수 호출)
      const { data: burnData, error: burnError } = await supabase.functions.invoke('burn-fanz-token', {
        body: { 
          wikiEntryId, 
          amount: REQUIRED_TOKENS,
          reason: 'cover_image_change'
        }
      });

      if (burnError) {
        // 업로드된 이미지 삭제
        await supabase.storage.from('wiki-images').remove([filePath]);
        throw burnError;
      }

      // 4. Wiki entry 이미지 업데이트
      const { error: updateError } = await supabase
        .from('wiki_entries')
        .update({ image_url: publicUrlData.publicUrl })
        .eq('id', wikiEntryId);

      if (updateError) {
        throw updateError;
      }

      toast.success("Cover image updated!", {
        description: `${REQUIRED_TOKENS} Lightsticks have been burned`
      });

      onSuccess();
      onOpenChange(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error: any) {
      console.error('Error updating cover image:', error);
      
      const errorMessage = error.message || '';
      
      if (errorMessage.includes('INSUFFICIENT_BALANCE')) {
        toast.error("Insufficient Lightsticks", {
          description: `You need ${REQUIRED_TOKENS} lightsticks to change the cover image`
        });
      } else if (errorMessage.includes('TOKEN_NOT_FOUND')) {
        toast.error("Token Not Found", {
          description: "No lightstick token has been issued for this page yet"
        });
      } else {
        toast.error("Failed to update cover image", {
          description: error.message || "Please try again later"
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setSelectedFile(null);
      setPreviewUrl(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            Change Cover Image
          </DialogTitle>
          <DialogDescription>
            Upload a new cover image for {entryTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 토큰 차감 안내 */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wand2 className="w-4 h-4 text-primary" />
              Lightstick Cost
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Required:</span>
              <span className="font-semibold">{REQUIRED_TOKENS} Lightsticks</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Your Balance:</span>
              <span className={`font-semibold ${userTokenBalance >= REQUIRED_TOKENS ? 'text-green-500' : 'text-red-500'}`}>
                {userTokenBalance} Lightsticks
              </span>
            </div>
          </div>

          {!canUpload && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <span className="text-destructive">
                You need {REQUIRED_TOKENS} lightsticks to change the cover image. 
                Please purchase more lightsticks.
              </span>
            </div>
          )}

          {/* 이미지 선택 */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {previewUrl ? (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 right-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  Change
                </Button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
                disabled={isProcessing}
              >
                <Upload className="w-8 h-8" />
                <span className="text-sm">Click to select image</span>
              </button>
            )}
          </div>

          {/* 소각 안내 */}
          <p className="text-xs text-muted-foreground text-center">
            * Lightsticks will be permanently burned upon upload
          </p>

          {/* 버튼들 */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !canUpload || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading & Burning...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Burn {REQUIRED_TOKENS} Lightsticks
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FanCoverImageDialog;
