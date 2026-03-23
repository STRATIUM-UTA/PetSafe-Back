import fs from 'fs';
import path from 'path';

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // We want to replace type: 'uuid' with type: 'int' in @Column
    // And PrimaryGeneratedColumn('uuid') with PrimaryGeneratedColumn('increment')
    // And PrimaryColumn('uuid') with PrimaryColumn('int')
    
    // Using a more robust replace for type: 'uuid'
    content = content.replace(/type\s*:\s*(['"])uuid\w*(['"])/g, "type: $1int$2");
    
    // Also, anything named `Id!: string` or `Id!: string | null` should be `number`
    // e.g. `pacienteId!: string;` -> `pacienteId!: number;`
    content = content.replace(/(\w+Id!?):\s*string\s*(\|\s*null)?;/g, "$1: number $2;");
    // Also handle just `id` correctly if not handled by BaseAuditEntity, wait, BaseAuditEntity has 'id!: string;'
    content = content.replace(/\bid!?:\s*string\s*(\|\s*null)?;/g, "id!: number $2;");
    
    content = content.replace(/@PrimaryColumn\(\s*(['"])uuid\w*(['"])\s*\)/g, "@PrimaryColumn($1int$2)");
    content = content.replace(/@PrimaryGeneratedColumn\(\s*(['"])uuid\w*(['"])\s*\)/g, "@PrimaryGeneratedColumn($1increment$2)");
    
    // Note: ensure we don't break string for arrays of IDs if there are any, but usually it's just UUID.
    
    // And for any entity that might be explicitly setting type: 'uuid' for another field that is NOT an ID? 
    // The user said they only want UUID exposed as `uuid`. The relations are the `_id` fields.

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated ' + filePath);
    }
}

function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

console.log('Starting refactor...');
processDirectory('./src/entities');
processDirectory('./src/common/entities');
console.log('Done.');
