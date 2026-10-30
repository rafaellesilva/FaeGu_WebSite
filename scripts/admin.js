// Gerencia administradores direto no banco.
//   node scripts/admin.js listar
//   node scripts/admin.js criar <email> [nome]
//   node scripts/admin.js promover <email>
//   node scripts/admin.js remover-admin <email>
//   node scripts/admin.js senha <email>
// No servidor da AWS (Elastic Beanstalk), rode com sudo dentro de /var/app/current:
//   sudo node scripts/admin.js listar
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";

const ebConfig = "/opt/elasticbeanstalk/bin/get-config";
if (existsSync(ebConfig) && process.getuid?.() === 0) {
  // Carrega as variáveis do ambiente do Beanstalk e passa a rodar como o mesmo usuário do site,
  // para os arquivos do banco continuarem pertencendo a ele.
  Object.assign(process.env, JSON.parse(execFileSync(ebConfig, ["environment"], { encoding: "utf8" })));
  process.setgid("webapp");
  process.setuid("webapp");
} else {
  await import("dotenv/config");
}

const { default: bcrypt } = await import("bcryptjs");
const { db, queries } = await import("../db.js");
const { backupToS3, backupsEnabled } = await import("../backup.js");

const [command, rawEmail, ...nameParts] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

async function askPassword() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const password = await prompt.question("Nova senha (mínimo 12 caracteres): ");
  prompt.close();
  if (password.length < 12 || password.length > 128) throw new Error("A senha precisa ter entre 12 e 128 caracteres.");
  return bcrypt.hash(password, 12);
}

function findUser() {
  if (!email) throw new Error("Informe o e-mail.");
  const user = queries.userByEmail.get(email);
  if (!user) throw new Error(`Nenhum usuário com o e-mail ${email}.`);
  return user;
}

try {
  switch (command) {
    case "listar":
      console.table(queries.allUsers.all().map(({ name, email, role, createdAt }) => ({ name, email, role, createdAt })));
      break;
    case "criar": {
      if (!email || queries.userByEmail.get(email)) throw new Error("Informe um e-mail ainda não cadastrado.");
      queries.insertUser.run({
        id: randomUUID(),
        name: nameParts.join(" ").trim() || "Administrador",
        email,
        passwordHash: await askPassword(),
        role: "admin",
        createdAt: new Date().toISOString(),
      });
      console.log(`Administrador ${email} criado.`);
      break;
    }
    case "promover":
      queries.updateUserRole.run("admin", findUser().id);
      console.log(`${email} agora é administrador.`);
      break;
    case "remover-admin":
      queries.updateUserRole.run("client", findUser().id);
      console.log(`${email} voltou a ser cliente.`);
      break;
    case "senha":
      queries.updateUserPassword.run(await askPassword(), findUser().id);
      console.log(`Senha de ${email} atualizada.`);
      break;
    default:
      console.log("Comandos: listar | criar <email> [nome] | promover <email> | remover-admin <email> | senha <email>");
      process.exit(command ? 1 : 0);
  }
  if (backupsEnabled && command !== "listar") {
    await backupToS3(db, { force: true });
    console.log("Backup enviado ao S3.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
