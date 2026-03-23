import fs from 'fs';

let content = fs.readFileSync('init.sql', 'utf8');

// Replace PKs
content = content.replace(/id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/g, "id SERIAL PRIMARY KEY,\n    uuid uuid DEFAULT gen_random_uuid() UNIQUE");

// Replace UUID FK fields mapping.
// Common UUID fields are like `persona_id uuid`, `deleted_by_usuario_id uuid`
// We will replace `uuid` with `integer` for known FKs.
content = content.replace(/([a-z_]+_id)\s+uuid/g, "$1 integer");

// Any other references of `uuid` except for the newly added `uuid uuid`
// wait, `especie_id uuid NOT NULL` -> `especie_id integer NOT NULL`
content = content.replace(/(\s+[a-z_]+)\s+uuid/g, (match, p1) => {
    if (p1.trim() === 'uuid') return match; // the one we added
    if (p1.trim() === 'id') return match; // just in case
    return `${p1} integer`;
});

// Since some types could simply be 'integer', let's just make sure.
content = content.replace(/integer\s+integer/g, "integer"); // if duplicate
fs.writeFileSync('init.sql', content, 'utf8');
console.log("Updated init.sql");
