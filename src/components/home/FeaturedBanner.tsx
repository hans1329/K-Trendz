import { Link } from "react-router-dom";
import { Star, Music } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FeaturedBanner = () => {
  return (
    <section className="px-4 py-3">
      <Card className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground p-6 rounded-2xl shadow-card">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 fill-current" />
            <span className="text-sm font-semibold opacity-90">Featured</span>
          </div>
          <h3 className="text-xl font-bold mb-1.5">Discover Rising Stars</h3>
          <p className="text-sm opacity-85 mb-4 leading-relaxed">
            Support your favorite K-Pop artists
          </p>
          <Link to="/discover">
            <Button 
              variant="secondary" 
              size="default" 
              className="rounded-full h-10 px-5 text-sm font-semibold active:scale-95 transition-transform"
            >
              <Music className="w-4 h-4 mr-2" />
              Explore
            </Button>
          </Link>
        </div>
        
        {/* 장식 요소 */}
        <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 right-6 w-20 h-20 bg-white/10 rounded-full translate-y-1/2" />
      </Card>
    </section>
  );
};

export default FeaturedBanner;
