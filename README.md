<h1 align="center">Manga Translator Web</h1>

<p align="center">
  <strong>Plataforma local-first para tradução de mangás com Next.js + Python/FastAPI</strong>
</p>

> **Execução local:** este projeto foi desenhado para rodar tudo localmente, com exceção do uso de tradução via Google Tradutor quando esse provedor é selecionado.
>
> **Tip:** a arquitetura foi pensada para funcionar também em computadores mais fracos, priorizando instalação simples e operação local.

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js">
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-API-009688?logo=fastapi&logoColor=white">
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
</p>

---

Plataforma local-first para tradução de mangás com:
- painel web em **Next.js**
- backend de inferência em **Python/FastAPI**
- armazenamento local (**SQLite + arquivos em `storage/`**)

O objetivo é rodar tudo localmente, sem dependência de serviços externos obrigatórios.

## Features

- Upload de páginas e criação de seções
- OCR + tradução no servidor
- Leitor com overlay editável
- Boxes de texto personalizáveis na interface (posição, tamanho e ajustes visuais)
- Biblioteca de seções e leitura pública por link
- Gestão de usuários (admin)
- Fila global de processamento
- Configuração de modelo OpenRouter (admin)

## Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Python FastAPI (OCR/tradução)
- SQLite local (`storage/local.sqlite`)
- Docker Compose para execução unificada

## Quick Start (dev)

Pré-requisitos:
- Node.js 20+
- Python 3.11+

```bash
npm install
npm run dev
```

Serviços:
- Web: `http://localhost:3080`
- Python API: `http://localhost:8023` (local)

## Quick Start (Docker)

```bash
docker compose up -d --build
```

Serviços:
- Web exposta: `http://localhost:3080`
- Python API interna do compose (`python-api:8023`, não exposta publicamente)

Parar:

```bash
docker compose down
```

## Rotas principais

- `/login` autenticação
- `/setup` configuração inicial (criação do admin)
- `/inicio` painel principal
- `/inicio/secoes` biblioteca de seções
- `/inicio/fila-global` fila global (admin)
- `/inicio/usuarios` gestão de usuários (admin)
- `/inicio/preferencias` preferências e OpenRouter (admin)
- `/publico/secoes/[key]` leitor público

## Arquitetura

- `app/api/*` funciona como backend local do projeto (BFF + domínio)
- `python-api/` executa OCR e tradução
- `lib/model-gateway.ts` conecta Next -> Python API
- `storage/` guarda SQLite, sessões e assets processados

## Modelos utilizados

- **Localização de boxes (balões/texto):** modelo **YOLOv8** treinado pelo autor **Marco Antonio da Silva Mesquita**.
- **OCR:** o software utiliza **PaddleOCR** para extração de texto.
- **Edição de boxes na UI:** os boxes detectados podem ser ajustados manualmente na interface (customização de posicionamento e aparência).

## Segurança e privacidade

- Sessão local com cookie `httpOnly`
- Rotas mutáveis protegidas contra CSRF por validação de origem
- Chaves sensíveis (OpenRouter) criptografadas em repouso
- Setup inicial bloqueado para acesso não-local

Importante:
- não commitar `storage/`
- não commitar `.env*` com credenciais reais

## Estrutura de pastas

```text
app/             # páginas e route handlers (Next.js)
components/      # componentes de UI
lib/             # backend local, segurança e integrações
python-api/      # API FastAPI de OCR/tradução
storage/         # banco SQLite e dados locais
scripts/         # scripts de desenvolvimento
```

## Comandos úteis

```bash
npm run dev        # Next + Python local (script integrado)
npm run dev:web    # apenas Next
npm run build      # build de produção
npm run start      # start de produção
```

## Como contribuir

Contribuições são bem-vindas.

1. Faça um fork do repositório
2. Crie uma branch para sua feature/fix (`feat/minha-melhoria`)
3. Commit suas mudanças com mensagens claras
4. Abra um Pull Request descrevendo o que foi alterado

Se possível, inclua evidências de teste (build, logs ou prints) para facilitar a revisão.

## Apoie o projeto

Se este projeto te ajudou, considere deixar uma estrela no repositório.
Isso ajuda na visibilidade e acelera a evolução do projeto.
