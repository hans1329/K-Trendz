-- Add food-related types to wiki_schema_type enum
ALTER TYPE wiki_schema_type ADD VALUE IF NOT EXISTS 'restaurant';
ALTER TYPE wiki_schema_type ADD VALUE IF NOT EXISTS 'food';
ALTER TYPE wiki_schema_type ADD VALUE IF NOT EXISTS 'food_brand';
ALTER TYPE wiki_schema_type ADD VALUE IF NOT EXISTS 'food_product';