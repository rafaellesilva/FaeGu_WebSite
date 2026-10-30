# Publicando o site na AWS (Elastic Beanstalk)

Como funciona: o site e a API rodam juntos em **um** servidor do Elastic Beanstalk. O banco é um arquivo SQLite nesse
servidor (`/var/app/data/site.db`), copiado para um bucket do S3 a cada 15 minutos e sempre que o servidor reinicia.
Se a AWS trocar o servidor, o novo baixa o último backup sozinho.

> **Importante:** por causa do SQLite, o ambiente deve ter **sempre uma instância só**. Isso já está configurado em
> `.ebextensions/01-app.config`. Não aumente o número de instâncias no console.

Custo aproximado (us-east-1, sem free tier): load balancer ~US$ 18/mês + instância t3.small ~US$ 15/mês + S3 centavos.

---

## 1. Criar o bucket de backup (S3)

1. Console AWS → **S3** → **Create bucket**.
2. Nome: algo como `fa-gu-backups-<seu-nome>` (precisa ser único no mundo). Região: a mesma que você vai usar no Beanstalk
   (ex.: `sa-east-1` São Paulo).
3. Deixe **Block all public access** marcado. Ative **Bucket Versioning** (permite recuperar versões antigas).
4. Depois de criado: aba **Management** → **Create lifecycle rule** → prefixo `backups/daily/` → expirar objetos após 60 dias.

## 2. Dar permissão ao servidor

O Beanstalk usa o perfil `aws-elasticbeanstalk-ec2-role` nos servidores (ele é criado na primeira vez que você cria um
ambiente; se ainda não existir, faça o passo 4 e volte aqui antes de testar).

1. Console → **IAM** → **Roles** → `aws-elasticbeanstalk-ec2-role`.
2. **Add permissions → Attach policies** → `AmazonSSMManagedInstanceCore` (permite abrir um terminal no servidor pelo navegador).
3. **Add permissions → Create inline policy** → aba JSON, cole (trocando o nome do bucket):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::NOME-DO-SEU-BUCKET/backups/*"
    }
  ]
}
```

## 3. Gerar o pacote do site

No terminal do VS Code, na pasta do projeto:

```
npm.cmd install
npm.cmd run bundle
```

Isso cria `deploy/fa-gu-<data>.zip`. É esse arquivo que vai para a AWS.

## 4. Criar o ambiente no Elastic Beanstalk

1. Console → **Elastic Beanstalk** → **Create application**.
2. **Environment tier**: Web server. **Application name**: `fa-gu`.
3. **Platform**: Node.js, ramo **Node.js 22 (ou mais novo) running on 64bit Amazon Linux 2023**.
4. **Application code**: *Upload your code* → escolha o `.zip` do passo 3.
5. **Presets**: *Custom configuration* → **Next**.
6. **Service access**: crie/use o service role padrão e escolha `aws-elasticbeanstalk-ec2-role` como *EC2 instance profile*.
7. **Instance traffic and scaling**:
   - Environment type: **Load balanced**, Min **1**, Max **1**.
   - Instance types: **t3.small** (t3.micro também funciona, mas fica no limite).
   - Load balancer: **Application load balancer**.
8. **Updates, monitoring, and logging** → **Environment properties**, adicione:

| Nome | Valor |
| --- | --- |
| `JWT_SECRET` | um segredo longo. Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `ADMIN_EMAIL` | o e-mail que vai entrar no painel |
| `ADMIN_PASSWORD` | senha forte, 12+ caracteres (não reaproveite senhas de teste) |
| `ADMIN_NAME` | ex.: `Fa & Gu` |
| `BACKUP_BUCKET` | nome do bucket do passo 1 |
| `AWS_REGION` | região do bucket, ex.: `sa-east-1` |
| `COOKIE_SECURE` | `false` **só até configurar o HTTPS** (passo 6); depois apague |

9. **Submit**. A criação leva uns 10 minutos. O status deve terminar em **Ok** (verde).

## 5. Testar

1. Abra o endereço do ambiente (algo como `fa-gu-env.eba-xxxx.sa-east-1.elasticbeanstalk.com`).
2. Abra `/api/health`: deve mostrar `{"status":"ok"}`.
3. Envie uma simulação em **Serviços → Monte seu evento**.
4. Entre em **/pages/acesso.html** com o `ADMIN_EMAIL`: você cai no painel e vê o pedido.
5. No S3, em `backups/`, deve aparecer `site-latest.db` em até 15 minutos.
6. Funcionou? Apague `ADMIN_PASSWORD` das Environment properties (o admin já está no banco).

Se algo der errado: Elastic Beanstalk → seu ambiente → **Logs → Request logs → Last 100 lines**, e procure por
`web.stdout.log`. As mensagens do site estão em português.

## 6. Domínio próprio e HTTPS (recomendado antes de divulgar)

1. **Certificate Manager** (na mesma região do ambiente) → *Request certificate* → seu domínio (ex.: `faegu.com.br` e
   `www.faegu.com.br`) → validação por DNS (crie os registros CNAME que ele mostrar no seu provedor de domínio).
2. Elastic Beanstalk → **Configuration → Instance traffic and scaling → Edit** → Listeners → **Add listener**:
   porta 443, HTTPS, escolha o certificado.
3. No provedor de domínio, crie um CNAME de `www` para o endereço do ambiente do Beanstalk.
4. Apague `COOKIE_SECURE` das Environment properties.

## Atualizando o site

```
npm.cmd run bundle
```

Elastic Beanstalk → seu ambiente → **Upload and deploy** → escolha o novo `.zip`. O banco não é afetado.

## Acessando os dados

- **Dia a dia:** painel admin → *Exportar orçamentos (CSV)* / *Exportar clientes (CSV)* (abre no Excel).
- **Banco completo:** painel → *Baixar banco completo*, ou baixe `backups/site-latest.db` do S3. Abra com o programa
  gratuito **DB Browser for SQLite**. Esse arquivo tem hashes de senha: não compartilhe.
- **Histórico:** `backups/daily/site-AAAA-MM-DD.db` guarda o último estado de cada dia.

## Gerenciando administradores

1. Console → **EC2** → Instances → selecione a instância do ambiente → **Connect → Session Manager → Connect**.
2. No terminal que abrir:

```
cd /var/app/current
sudo node scripts/admin.js listar
sudo node scripts/admin.js criar novo@email.com Nome
sudo node scripts/admin.js promover cliente@email.com
sudo node scripts/admin.js remover-admin alguem@email.com
sudo node scripts/admin.js senha admin@email.com
```

O script pede a senha na hora e já envia um backup para o S3.

## Restaurando um backup antigo

1. No S3, copie o arquivo desejado de `backups/daily/` por cima de `backups/site-latest.db`.
2. Elastic Beanstalk → **Actions → Rebuild environment**. O servidor novo sobe com esse backup.

Atenção: o que entrou depois daquele backup será perdido.

## Atualizações da plataforma

As atualizações automáticas estão desligadas, porque criariam um segundo servidor em paralelo. Uma vez por mês,
num horário calmo: Elastic Beanstalk → ambiente → **Platform → Change version** para a mais recente. O servidor é
trocado e restaura o banco do S3 sozinho (os pedidos feitos durante a troca, de poucos minutos, podem se perder).
