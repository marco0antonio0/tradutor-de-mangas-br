export const LEGAL_LAST_UPDATED = '18 de maio de 2026'

export type LegalListSection = {
  title: string
  items: string[]
  intro?: string
}

export type LegalTextSection = {
  title: string
  paragraphs: string[]
  lists?: LegalListSection[]
}

export const LEGAL_TERMS_METADATA = {
  title: 'Termos de Uso e Política de Privacidade',
  description:
    'Termos de uso e política de privacidade do MangaIOTranslate — projeto open source, gratuito e de execução local.',
} as const

export const LEGAL_MODAL_CONTENT = {
  title: 'Bem-vindo ao MangaIOTranslate!',
  subtitle:
    'Projeto open source e gratuito para traduzir mangás, manhwas, manhuas e HQs com apoio de IA, de forma local.',
  cards: [
    {
      key: 'purpose',
      text: 'Ferramenta de tradução automática para leitura assistida, preservando a estrutura visual original das páginas processadas.',
    },
    {
      key: 'storage',
      text: 'Dados e traduções ficam armazenados localmente na sua instância. O projeto não opera armazenamento central e não distribui conteúdo de terceiros.',
    },
    {
      key: 'pricing',
      text: 'O MangaIOTranslate é gratuito e sem planos pagos. Não há cobrança, créditos, mensalidades ou política de reembolso.',
    },
    {
      key: 'liability',
      text: 'O usuário é integralmente responsável pelo conteúdo enviado. O processamento ocorre de forma automatizada, sem curadoria editorial humana. O projeto não se responsabiliza por uso de material protegido sem autorização e observa a LGPD no contexto de execução local.',
    },
  ],
  acceptancePrefix:
    'Estou ciente que o uso desta plataforma é de minha responsabilidade e aceito os',
  acceptanceLinkLabel: 'Termos de Uso',
  acceptanceError: 'Aceite os termos para entrar na plataforma.',
} as const

export const LEGAL_TERMS_SECTIONS: LegalTextSection[] = [
  {
    title: '1. Sobre o Projeto',
    paragraphs: [
      'O MangaIOTranslate é um projeto open source, gratuito e sem fins lucrativos que oferece uma ferramenta de tradução automática para auxiliar na leitura de mangás, manhwas, manhuas, HQs e demais quadrinhos em diferentes idiomas.',
      'Trata-se de um software disponibilizado para que cada pessoa execute em seu próprio ambiente (uso pessoal e local). Não há serviço remoto centralizado mantido por uma empresa, não há cobrança e não há planos pagos. Os mantenedores disponibilizam o código "como está" (as is), sem garantias de qualquer espécie.',
    ],
  },
  {
    title: '2. Aceitação dos Termos',
    paragraphs: ['Ao instalar, executar ou utilizar o MangaIOTranslate, o usuário declara que:'],
    lists: [
      {
        title: '',
        items: [
          'Leu e concorda com estes Termos;',
          'É maior de 18 anos ou possui consentimento do responsável legal;',
          'Utilizará o software em conformidade com a legislação aplicável;',
          'Compreende que o software não tem cunho comercial e é fornecido sem garantias.',
        ],
      },
    ],
  },
  {
    title: '3. Modelo Gratuito e Open Source',
    paragraphs: [
      'O MangaIOTranslate é distribuído de forma aberta e gratuita. Não existem:',
      'O código pode ser livremente inspecionado, modificado e auto-hospedado. Cada instância roda no ambiente do próprio usuário.',
    ],
    lists: [
      {
        title: '',
        items: [
          'Planos pagos, mensalidades, créditos ou cobranças de qualquer natureza;',
          'Servidor central administrado pelos mantenedores que armazene contas, conteúdos ou histórico;',
          'Política de reembolso, pois nenhum pagamento é processado pelo projeto.',
        ],
      },
    ],
  },
  {
    title: '4. Conteúdo Enviado pelo Usuário e Direitos Autorais',
    paragraphs: [
      'O MangaIOTranslate apenas processa, na máquina do usuário, os arquivos que o próprio usuário fornece. Não há curadoria, hospedagem pública ou redistribuição de obras por parte do projeto. A responsabilidade pela origem, legalidade e utilização do material é integral e exclusivamente do usuário.',
      'Ao processar qualquer arquivo, o usuário declara que:',
      'Os mantenedores do projeto não se responsabilizam por violações à Lei nº 9.610/1998 (Lei de Direitos Autorais) ou normas equivalentes praticadas pelos usuários do software.',
    ],
    lists: [
      {
        title: '',
        items: [
          'Possui os direitos necessários sobre o material, ou autorização do detentor dos direitos;',
          'Não utilizará o resultado para fins de distribuição pública, republicação ou comercialização de obras protegidas;',
          'Assume total responsabilidade civil e penal pelo uso indevido de conteúdo protegido.',
        ],
      },
    ],
  },
  {
    title: '5. Uso Permitido',
    paragraphs: ['O usuário poderá utilizar o MangaIOTranslate para:'],
    lists: [
      {
        title: '',
        items: [
          'Tradução de obras sobre as quais possui direitos ou autorização;',
          'Visualização privada das traduções geradas em sua própria instância;',
          'Fins de estudo linguístico, acessibilidade e uso pessoal não comercial;',
          'Tradução de conteúdos de domínio público ou licenciados de forma compatível.',
        ],
      },
    ],
  },
  {
    title: '6. Uso Proibido',
    paragraphs: ['É expressamente vedado utilizar este software para:'],
    lists: [
      {
        title: '',
        items: [
          'Distribuir publicamente, comercializar ou republicar traduções de obras protegidas sem autorização;',
          'Operar serviços de scanlation ou repositórios não autorizados;',
          'Processar conteúdos cujos direitos não pertencem ao usuário e para os quais não há autorização;',
          'Praticar qualquer ato que configure pirataria ou violação de direitos autorais;',
          'Qualquer uso que viole a legislação aplicável.',
        ],
      },
    ],
  },
  {
    title: '7. Armazenamento Local e Perda de Dados',
    paragraphs: [
      'Todos os dados gerados ou enviados (imagens, OCR, traduções, configurações, usuários da instância) ficam armazenados exclusivamente no ambiente local do usuário que executa o software. O projeto não opera infraestrutura de armazenamento remoto.',
    ],
    lists: [
      {
        title: '',
        items: [
          'É responsabilidade exclusiva do usuário realizar backup do que considera relevante;',
          'Atualizações, migrações ou alterações de configuração podem implicar perda parcial ou total de dados locais;',
          'Não há SLA, suporte garantido ou compromisso de continuidade.',
        ],
      },
    ],
  },
  {
    title: '8. Isenção de Responsabilidade',
    paragraphs: [
      'O software é fornecido na modalidade "as is", sem garantias expressas ou implícitas de qualquer natureza, incluindo, sem limitação, garantias de comercialização, adequação a uma finalidade específica ou não violação de direitos. Os mantenedores não se responsabilizam por:',
    ],
    lists: [
      {
        title: '',
        items: [
          'Conteúdo processado pelos usuários, independentemente de sua licitude;',
          'Violações de direitos autorais ou propriedade intelectual praticadas pelos usuários;',
          'Uso indevido ou ilegal das traduções geradas;',
          'Danos diretos, indiretos, incidentais ou consequenciais decorrentes do uso ou impossibilidade de uso do software;',
          'Falhas técnicas, perda de dados locais, indisponibilidade de serviços externos ou casos fortuitos e de força maior;',
          'Qualidade, precisão ou adequação das traduções geradas automaticamente.',
        ],
      },
    ],
  },
  {
    title: '9. Política de Privacidade',
    paragraphs: [
      'Por se tratar de software de execução local, o MangaIOTranslate não possui um controlador centralizado de dados pessoais. Os mantenedores não coletam, recebem ou armazenam dados dos usuários da aplicação.',
    ],
    lists: [
      {
        title: '9.1 Dados tratados na sua máquina',
        intro: 'Durante o uso, a instância local pode armazenar, no seu próprio disco:',
        items: [
          'Credenciais de acesso da instância (nome, e-mail e senha do administrador local);',
          'Imagens enviadas, resultados de OCR, traduções e metadados das seções;',
          'Configurações de uso e preferências da aplicação.',
        ],
      },
      {
        title: '9.2 Serviço externo: Google Tradutor',
        intro:
          'A única comunicação externa realizada pela aplicação é a chamada ao Google Tradutor durante a etapa de tradução de texto. Nessa etapa, apenas os trechos de texto extraídos da imagem são enviados ao serviço para tradução. Nenhuma informação de conta ou identificação pessoal é incluída nesse envio.',
        items: [
          'O uso do Google Tradutor está sujeito aos termos e à política de privacidade da própria Google, fora do controle deste projeto.',
        ],
      },
      {
        title: '9.3 LGPD e direitos do titular',
        intro:
          'Como o tratamento de dados pessoais ocorre na própria máquina do usuário, o usuário atua simultaneamente como titular e operador desses dados. Para exercer direitos previstos na Lei nº 13.709/2018 (LGPD) em relação a dados armazenados na sua instância (acesso, correção, eliminação, portabilidade), basta gerenciar os arquivos locais correspondentes.',
        items: [],
      },
      {
        title: '9.4 Segurança',
        intro:
          'A segurança dos dados depende das medidas de proteção adotadas no ambiente onde o software está instalado (sistema operacional, rede e acesso físico). Nenhum sistema é absolutamente inviolável, e o usuário reconhece o risco inerente.',
        items: [],
      },
    ],
  },
  {
    title: '10. Alterações nos Termos',
    paragraphs: [
      'Estes Termos podem ser atualizados periodicamente para refletir mudanças no projeto. O uso continuado após a atualização constitui aceitação dos novos termos.',
    ],
  },
  {
    title: '11. Lei Aplicável',
    paragraphs: [
      'Estes Termos são regidos pelas leis da República Federativa do Brasil, observado o caráter aberto e não comercial do projeto.',
    ],
  },
]

export const LEGAL_AWARENESS_DECLARATION =
  'Ao utilizar o MangaIOTranslate, o usuário reconhece que se trata de um projeto open source, gratuito e sem fins lucrativos; que a aplicação roda na sua própria máquina; que a única comunicação externa é com o Google Tradutor para a etapa de tradução de texto; e que o uso indevido ou ilegal do software é de inteira e exclusiva responsabilidade do usuário.'
