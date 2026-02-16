import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Zap } from "lucide-react";

interface BoostPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (hours: number) => void;
  hourlyRate: number;
  isProcessing: boolean;
}

export const BoostPostDialog = ({ open, onOpenChange, onConfirm, hourlyRate, isProcessing }: BoostPostDialogProps) => {
  const [hours, setHours] = useState(24);

  const totalCost = Math.abs(hourlyRate) * hours;

  const presetOptions = [
    { label: "1 Hour", hours: 1 },
    { label: "6 Hours", hours: 6 },
    { label: "12 Hours", hours: 12 },
    { label: "1 Day", hours: 24 },
    { label: "2 Days", hours: 48 },
    { label: "3 Days", hours: 72 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Boost Your Post
          </DialogTitle>
          <DialogDescription>
            Select how long you want to boost your post. Boosted posts appear higher in feeds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preset Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {presetOptions.map((option) => (
              <Button
                key={option.hours}
                variant={hours === option.hours ? "default" : "outline"}
                size="sm"
                onClick={() => setHours(option.hours)}
                className="text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>

          {/* Custom Hours Input */}
          <div className="space-y-2">
            <Label htmlFor="hours">Custom Duration (hours)</Label>
            <Input
              id="hours"
              type="number"
              min={1}
              max={72}
              value={hours}
              onChange={(e) => setHours(Math.max(1, Math.min(72, parseInt(e.target.value) || 1)))}
            />
            <p className="text-xs text-muted-foreground">
              Max: 72 hours (3 days)
            </p>
          </div>

          {/* Slider */}
          <div className="space-y-2">
            <Label>Duration Slider</Label>
            <Slider
              value={[hours]}
              onValueChange={(value) => setHours(value[0])}
              min={1}
              max={72}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1h</span>
              <span>3 days</span>
            </div>
          </div>

          {/* Cost Display */}
          <div className="bg-primary/10 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Duration:</span>
              <span className="font-semibold">
                {hours} hour{hours !== 1 ? 's' : ''} ({(hours / 24).toFixed(1)} day{hours !== 24 ? 's' : ''})
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Rate:</span>
              <span className="font-semibold">{Math.abs(hourlyRate)} stars/hour</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-primary/20">
              <span className="font-semibold">Total Cost:</span>
              <span className="text-lg font-bold text-primary">{totalCost} stars</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(hours)} disabled={isProcessing}>
            {isProcessing ? "Processing..." : `Boost for ${totalCost} stars`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
