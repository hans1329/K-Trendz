-- Add k_beauty to wiki_schema_type enum
ALTER TYPE wiki_schema_type ADD VALUE IF NOT EXISTS 'k_beauty';

-- Add schema type relationship to allow k_beauty as parent of beauty_brand
INSERT INTO schema_type_relationships (parent_schema_type, child_schema_type)
VALUES ('k_beauty', 'beauty_brand')
ON CONFLICT DO NOTHING;