# Deploy — Painel de Produção (Supabase + GitHub + Vercel)

## 1. Supabase

1. Crie um projeto em https://supabase.com (ou use um que já existir).
2. Vá em **SQL Editor → New query**, cole o conteúdo de `schema.sql` e rode.
   Isso cria a tabela `dashboard_kv`, que guarda todo o estado do dashboard.
3. Vá em **Project Settings → API** e copie:
   - `Project URL` → vai virar `VITE_SUPABASE_URL`
   - `anon public` key → vai virar `VITE_SUPABASE_ANON_KEY`

## 2. Rodando localmente

1. Coloque os arquivos deste pacote no seu projeto Vite existente:
   - `producao-linhas-dashboard.jsx` → onde já estava (ex.: `src/pages/` ou `src/`)
   - `lib/supabaseClient.js` e `lib/dashboardStorage.js` → em `src/lib/`
     (se usar outro caminho, ajuste o `import` no topo de `producao-linhas-dashboard.jsx`)
   - `logo.png` → em `public/logo.png` (já referenciado no código como `/logo.png`)
2. Instale a dependência do Supabase, se ainda não tiver:
   ```bash
   npm install @supabase/supabase-js
   ```
3. Copie `.env.example` para `.env` e preencha com os dados do passo 1.
4. Rode `npm run dev` e confirme que o dashboard carrega ("Carregando dados do
   Supabase…" e depois a tela normal). Se aparecer uma faixa vermelha no
   topo, revise as variáveis de ambiente e se o `schema.sql` foi executado.

## 3. GitHub

```bash
git add .
git commit -m "Integra dashboard de produção com Supabase"
git push origin main
```

(Se o projeto ainda não é um repositório: `git init`, crie o repositório no
GitHub, `git remote add origin <url>` e faça o primeiro push.)

## 4. Vercel

1. Em https://vercel.com, **Add New → Project** e importe o repositório do GitHub.
2. Em **Environment Variables**, adicione (mesmos valores do `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy. A Vercel detecta automaticamente projetos Vite (build `vite build`,
   output `dist`).

### Se for publicar num subcaminho do seu domínio (padrão que você já usa)

Como no seu projeto de `tkone.com.br/producao`, se quiser manter esse app
como um subcaminho do site principal (em vez de domínio/subdomínio próprio):

- No **projeto Vite deste dashboard**, mantenha `base: "/"` no `vite.config.js`
  (não use o path como base — quem cuida do prefixo é o rewrite).
- No **projeto principal** (`tkone.com.br`), adicione um rewrite no
  `vercel.json` apontando para o deployment deste dashboard, do mesmo jeito
  que você já fez para `/fideles` e `/producao`.

Se preferir domínio/subdomínio próprio (ex.: `dashboard.tkone.com.br` ou um
domínio `.vercel.app`), não precisa de rewrite nenhum — é só configurar o
domínio direto nas configurações do projeto na Vercel.

## Observações

- O app salva **tudo** no Supabase agora (não mais no localStorage do
  navegador) — então abrir em outro computador já mostra os mesmos dados.
- Se o Supabase ficar inacessível (sem internet, chave errada, etc.), o
  dashboard não trava: mostra um aviso vermelho no topo e segue funcionando
  com os dados que already estavam carregados em memória, mas as alterações
  não serão salvas até a conexão voltar.
- Não há autenticação de usuário nesta versão (uso interno, um
  supervisor/turno). Se no futuro você quiser múltiplos usuários com login,
  me avise — dá pra evoluir o schema e as policies de RLS.
