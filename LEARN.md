# LEARN.md

Guia para estudantes e contribuidores que querem aprender com este projeto e abrir contribuições úteis.

## Objetivo do projeto
O **Manga Translator Local** é uma plataforma local-first para tradução de mangás usando:
- frontend em Next.js
- backend de OCR/tradução em Python/FastAPI
- persistência local com SQLite

Foco técnico do projeto:
- rodar localmente com instalação simples
- funcionar bem em hardwares mais fracos (CPU)
- manter arquitetura clara para facilitar evolução por contribuidores

## Para quem este guia é
- Estudantes iniciando em projetos full stack reais
- Pessoas querendo praticar IA aplicada (OCR + pipeline)
- Contribuidores open source que querem começar por issues menores

## Stack e pontos de estudo
- **Next.js 16 + React 19 + TypeScript**
  - rotas App Router
  - componentes de interface
  - integração com APIs internas
- **FastAPI (Python)**
  - endpoints de OCR/tradução
  - organização por serviços
- **SQLite**
  - modelagem simples
  - consultas e evolução de schema
- **Docker Compose**
  - ambiente reprodutível para desenvolvimento/teste

## Arquitetura resumida
- `app/api/*`: backend local (BFF + regras de domínio)
- `components/*`: UI e fluxo de usuário
- `lib/backend/*`: regras de negócio e repositórios
- `python-api/*`: pipeline de OCR/tradução
- `storage/*`: banco local e artefatos processados

## Trilha de aprendizado sugerida
1. Suba o projeto localmente (`npm run dev` ou `docker compose up -d --build`).
2. Navegue pelo fluxo completo: setup -> login -> criação de seção -> leitura.
3. Leia as rotas de seção em `app/api/sections/*`.
4. Entenda o repositório principal em `lib/backend/sections/sections.repository.ts`.
5. Explore o pipeline Python em `python-api/app/services/*`.
6. Faça uma melhoria pequena e abra PR com evidência de teste.

## Como contribuir (passo a passo)
1. Faça fork do repositório.
2. Crie branch: `feat/nome-curto` ou `fix/nome-curto`.
3. Implemente mudanças pequenas e focadas.
4. Rode validação local:
   - `npm run build`
   - subir com Docker quando aplicável
5. Abra PR com:
   - problema resolvido
   - abordagem adotada
   - arquivos alterados
   - evidência (log/print)

## Tipos de contribuição que ajudam muito
- Correções de bugs de fluxo (setup/login/leitor)
- Melhorias de UX e acessibilidade
- Robustez de tratamento de erro
- Melhorias de performance em CPU
- Documentação técnica e guias de uso
- Cobertura de testes

## Boas práticas para PR
- Não misture refactor grande com correção funcional.
- Mantenha nomes de função/variável claros.
- Preserve compatibilidade com ambiente local-first.
- Se alterar comportamento, atualize README quando necessário.

## Regras de segurança e dados
- Não commitar `storage/`
- Não commitar `.env` com credenciais reais
- Tratar API keys como segredo (ex.: OpenRouter)

## Ideias de issues para estudantes
- Adicionar mensagens de erro mais acionáveis em fluxos de API
- Criar testes para rotas críticas (`/api/setup`, `/api/auth/*`, `/api/sections/*`)
- Melhorar estados de loading no leitor
- Documentar troubleshooting de Docker e modelos OCR
- Criar checklist de validação pré-PR

## Como pedir ajuda
Se ficar bloqueado:
- descreva contexto, tentativa e erro encontrado
- inclua logs relevantes
- proponha hipótese do problema

Isso acelera revisão e aumenta a chance de merge rápido.

---
Se você está chegando pelo **GitHub Student**, este projeto é um bom laboratório para praticar arquitetura real, colaboração e entrega incremental em open source.
