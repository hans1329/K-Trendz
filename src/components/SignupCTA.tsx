import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gift } from "lucide-react";

interface SignupCTAProps {
  className?: string;
}

const SignupCTA = ({ className }: SignupCTAProps) => {
  return (
    <Card className={`bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 ${className}`}>
      <CardContent className="flex flex-col items-center gap-4 py-5 px-4 sm:flex-row sm:justify-between sm:py-6 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base sm:text-lg">Join KTRENDZ Today</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Claim your daily rewards!
            </p>
          </div>
        </div>
        <Button asChild className="rounded-full px-6 w-full sm:w-auto">
          <Link to="/auth">Get Started</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default SignupCTA;
