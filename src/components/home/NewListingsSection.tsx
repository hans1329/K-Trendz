import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatPrice } from "./LivePriceTicker";
interface Token {
  id: string;
  total_supply?: number;
  current_price?: number;
  wiki_entry?: {
    id?: string;
    title?: string;
    slug?: string;
    image_url?: string | null;
    metadata?: any;
  };
}
interface NewListingsSectionProps {
  tokens: Token[];
}
const NewListingsSection = ({
  tokens
}: NewListingsSectionProps) => {
  if (!tokens || tokens.length === 0) return null;
  return <section className="px-4 py-4 pb-6">
      <div className="flex items-center gap-2 mb-3">
        
        <h2 className="text-lg font-bold text-foreground">New Listings</h2>
      </div>
      
      <div className="space-y-2.5">
        {tokens.slice(0, 4).map(token => <Link key={token.id} to={`/k/${token.wiki_entry?.slug || token.id}`} className="block active:scale-[0.99] transition-transform duration-150">
            <Card className="p-3.5 flex items-center gap-3.5 bg-card border-0 shadow-card rounded-xl">
              <Avatar className="w-14 h-14 shrink-0">
                <AvatarImage src={token.wiki_entry?.image_url || token.wiki_entry?.metadata?.profile_image} />
                <AvatarFallback className="bg-muted text-sm font-medium">
                  {token.wiki_entry?.title?.[0]}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {token.wiki_entry?.title}
                  </p>
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0 h-4 shrink-0">
                    NEW
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {token.total_supply || 0} tokens
                </p>
              </div>
              
              <div className="text-right shrink-0">
                <p className="font-bold text-foreground text-base">
                  {formatPrice(token.current_price || 0)}
                </p>
              </div>
            </Card>
          </Link>)}
      </div>
    </section>;
};
export default NewListingsSection;