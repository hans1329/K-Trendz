-- Add beauty_brand and beauty_product to wiki_schema_type enum
ALTER TYPE wiki_schema_type ADD VALUE IF NOT EXISTS 'beauty_brand';
ALTER TYPE wiki_schema_type ADD VALUE IF NOT EXISTS 'beauty_product';