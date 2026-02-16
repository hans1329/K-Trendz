-- Remove invalid 'group' schema type records from schema_type_relationships
DELETE FROM schema_type_relationships WHERE parent_schema_type = 'group';