# Contributing

Obrigado por contribuir com o **Manga Translator Local**.

Este documento define o fluxo recomendado para abrir contribuições de forma clara e revisável.

## Pré-requisitos
- Node.js 20+
- Python 3.11+
- Docker (opcional, recomendado para validação de ambiente)

## Setup local
```bash
npm install
npm run dev
```

Com Docker:
```bash
docker compose up -d --build
```

## Fluxo de contribuição
1. Faça um fork do repositório.
2. Crie uma branch:
   - `feat/nome-curto`
   - `fix/nome-curto`
   - `docs/nome-curto`
3. Faça commits pequenos e com mensagem clara.
4. Valide localmente.
5. Abra Pull Request com contexto suficiente para revisão.

## Padrões de commit (recomendado)
- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `docs: ...`
- `chore: ...`

Exemplo:
```text
fix: corrigir loop de polling em seção sem imagens selecionadas
```

## Antes de abrir PR
Execute pelo menos:
```bash
npm run build
```

Se a mudança impacta ambiente/container, valide também:
```bash
docker compose up -d --build
```

## Escopo esperado de PR
- Um problema por PR (evite misturar vários temas)
- Mudanças objetivas e focadas
- Sem alterações desnecessárias de estilo em arquivos não relacionados

## O que incluir na descrição do PR
- Problema observado
- Causa raiz (se identificada)
- Solução aplicada
- Arquivos principais alterados
- Evidência de validação (logs, prints, passos de reprodução)

## Áreas do projeto
- `app/api/*`: rotas e regras no backend local
- `components/*`: interface
- `lib/backend/*`: domínio e persistência
- `python-api/*`: OCR/tradução
- `storage/*`: dados locais (não versionar conteúdo gerado)

## Segurança e dados
- Não commitar `.env` com segredos
- Não commitar dados de execução em `storage/`
- Tratar chaves de API como confidenciais

## Diretrizes de código
- Prefira mudanças simples e legíveis
- Preserve compatibilidade com a proposta local-first
- Atualize README/LEARN quando o comportamento público mudar

## Report de bugs
Ao abrir issue, inclua:
- ambiente (OS, Node, Python, Docker)
- passos para reproduzir
- comportamento esperado vs atual
- logs relevantes

## Sugestões de melhoria
Issues com proposta de melhoria devem incluir:
- motivação
- impacto esperado
- alternativa considerada (se houver)

---
Contribuições pequenas e frequentes tendem a ser revisadas mais rápido.
