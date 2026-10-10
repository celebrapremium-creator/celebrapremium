# Item 10 — Livro de Recordações e Fotos

## Fluxo
1. Um administrador autorizado abre **Livro de recordações**, escolhe um evento e cria um livro.
2. A tela apresenta a URL pública e um QR Code para impressão nas mesas.
3. O convidado informa nome, sobrenome e celular, escreve a mensagem e pode anexar até cinco fotos.
4. Mensagens ficam com status inicial `pending`; fotos ficam em bucket privado do Supabase Storage.
5. A galeria administrativa organiza as mensagens e as fotos por convidado.

## Configuração necessária antes de testar
- Aplicar `supabase/migrations/20261010000000_stage_10_livro_recordacoes.sql` no projeto Supabase correto.
- Configurar `SUPABASE_SERVICE_ROLE_KEY` **somente no ambiente servidor** da Vercel. Nunca usar prefixo `NEXT_PUBLIC_` nessa chave.
- Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` já usados pelo projeto.
- Fazer deploy de preview e testar com evento e usuário de teste.

## Regras implementadas
- Limite de mensagem configurável entre 50 e 2.000 caracteres (padrão 500).
- Filtro de palavras ofensivas no servidor, além da validação do navegador.
- Restrição de uma mensagem por número normalizado por livro/evento, garantida por índice único no banco.
- Até cinco fotos JPG, PNG ou WebP, no máximo 10 MB por arquivo.
- Bucket privado; a galeria gera links assinados com duração de 10 minutos.
- A galeria administrativa verifica sessão e associação à empresa ou papel de desenvolvedor.

## Limitações e cuidados antes de produção
- O filtro de palavrões é uma lista inicial e não detecta todas as variações. Deve ser revisado pelo responsável do evento.
- A unicidade por celular não comprova que o convidado controla esse número. Para prova de posse, integrar OTP por SMS antes da liberação.
- Não há limite de taxa/CAPTCHA nesta versão; antes de uma campanha pública, adicionar proteção contra abuso.
- O QR Code desta tela é renderizado por um serviço externo e contém somente a URL pública do livro.
- A galeria fornece links individuais de fotos; exportação ZIP, moderação (aprovar/rejeitar) e montagem automática de álbum virtual ainda precisam ser concluídas.
- A migration cria as tabelas do livro e o bucket. Não altera nem migra dados do sistema legado.
