# CELEBRA PREMIUM

Plataforma SaaS de gestão de eventos construída do zero.

## Fundação técnica

- Next.js 16 + React 19 + TypeScript
- Supabase PostgreSQL e Auth
- RLS para isolamento por empresa e evento
- Arquitetura multiempresa e multi-evento
- Canais de comunicação versionados
- Vercel para aplicação e previews
- GitHub como controle de versão

## Diretriz do legado

O sistema PHP/MySQL anterior é somente referência funcional e conceitual. Não há migração de código nem reutilização do banco legado.

## Variáveis de ambiente

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Nunca coloque chaves privilegiadas, senhas de banco ou `service_role` no cliente.

## Desenvolvimento

Use Node.js LTS 24.21.0 conforme `.nvmrc`.

```bash
npm install
npm run dev
```

Validações:

```bash
npm run lint
npm run build
```

A implementação funcional será entregue por etapas, com validação ao final de cada etapa.
