import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface WikiBreadcrumbProps {
  schemaType?: string;
  title: string;
  slug: string;
}

const SCHEMA_TYPE_LABELS: { [key: string]: string } = {
  actor: "Actors",
  member: "Members",
  group: "Groups",
  artist: "Artists",
  song: "Songs",
  album: "Albums",
  brand: "Brands",
  product: "Products",
  company: "Companies",
  expert: "Experts",
  cafe: "Cafes",
  other: "Other",
};

export const WikiBreadcrumb = ({ schemaType, title, slug }: WikiBreadcrumbProps) => {
  const categoryLabel = schemaType ? SCHEMA_TYPE_LABELS[schemaType] || "Entries" : "Entries";
  const categoryPath = schemaType 
    ? `/${categoryLabel.toLowerCase().replace(/\s+/g, '-')}-top-100`
    : '/rankings';

  return (
    <nav 
      aria-label="Breadcrumb" 
      className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 flex-wrap"
    >
      <Link 
        to="/" 
        className="hover:text-foreground transition-colors"
        aria-label="KTrendz"
      >
        KTrendz
      </Link>
      
      <ChevronRight className="h-3 w-3 flex-shrink-0" />
      
      <Link 
        to="/rankings" 
        className="hover:text-foreground transition-colors"
      >
        Fanz
      </Link>
      
      {schemaType && (
        <>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          <Link 
            to={categoryPath}
            className="hover:text-foreground transition-colors"
          >
            {categoryLabel}
          </Link>
        </>
      )}
      
      <ChevronRight className="h-3 w-3 flex-shrink-0" />
      
      <span className="text-foreground font-normal truncate" aria-current="page">
        {title}
      </span>
    </nav>
  );
};