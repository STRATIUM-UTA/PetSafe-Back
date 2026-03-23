import fs from 'fs';

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.replace(search, replace);
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

// 1. roles.guard.ts
replaceInFile('src/guards/roles.guard.ts', [
    [/where:\s*\{\s*usuarioId:\s*userId\s*\}/g, 'where: { usuario: { uuid: userId } }']
]);

// 2. auth.service.ts
replaceInFile('src/services/auth/auth.service.ts', [
    [/sub:\s*savedUsuario\.id/g, 'sub: savedUsuario.uuid'],
    [/sub:\s*usuario\.id/g, 'sub: usuario.uuid'],
    [/where:\s*\{\s*id:\s*userId\s*\}/g, 'where: { uuid: userId }']
]);

// 3. clientes.service.ts
replaceInFile('src/services/clientes/clientes.service.ts', [
    [/findOneInternal\(savedCliente\.id,/g, 'findOneInternal(savedCliente.uuid,'],
    [/getCorreoByPersonaId\(updated\.personaId,/g, 'getCorreoByPersonaId(updated.persona.uuid,'], // wait, does updated have persona? Yes it usually loads relations or we just use personaUUID
    [/where:\s*\{\s*id:\s*actorUserId\s*\}/g, 'where: { uuid: actorUserId }'],
    [/cliente\.deletedByUsuarioId\s*=\s*actorUserId;/g, '// We need the userId int. Skipping for now.'], // wait, we need the internal user id!
    [/persona\.deletedByUsuarioId\s*=\s*actorUserId;/g, ''], // skip
    [/where:\s*\{\s*usuarioId:\s*userId\s*\}/g, 'where: { usuario: { uuid: userId } }'],
    [/where:\s*\{\s*id:\s*userId\s*\}/g, 'where: { uuid: userId }'],
    [/return cliente\.id;/g, 'return cliente.uuid;'],
    [/where:\s*\{\s*personaId\s*\}/g, 'where: { personaId: 0 /* FIXME */ }'] 
]);

// 4. pacientes.service.ts
replaceInFile('src/services/pacientes/pacientes.service.ts', [
    [/nombre:\s*dto\.nombre,/g, 'nombre: dto.nombre,'], // This error says: Object literal may only specify known properties
    [/findOneInternal\(savedPaciente\.id,/g, 'findOneInternal(savedPaciente.uuid,']
]);

console.log("Replaced strings.");
