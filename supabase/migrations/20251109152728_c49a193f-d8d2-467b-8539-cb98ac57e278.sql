-- Update existing food entries to k_food
UPDATE wiki_entries 
SET schema_type = 'k_food' 
WHERE schema_type = 'food';

-- Update schema type relationships
UPDATE schema_type_relationships 
SET parent_schema_type = 'k_food' 
WHERE parent_schema_type = 'food';

UPDATE schema_type_relationships 
SET child_schema_type = 'k_food' 
WHERE child_schema_type = 'food';