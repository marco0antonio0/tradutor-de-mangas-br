import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Termos de Uso e Política de Privacidade',
  description:
    'Termos de uso e política de privacidade do MangaIOTranslate — projeto open source, gratuito e de execução local.',
}

export default function TermosPage() {
  const lastUpdated = '18 de maio de 2026'

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">

        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-primary p-2">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Termos de Uso e Política de Privacidade</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            MangaIOTranslate · Última atualização: {lastUpdated}
          </p>
        </div>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Sobre o Projeto</h2>
            <p>
              O <strong className="text-foreground">MangaIOTranslate</strong> é um projeto{' '}
              <strong className="text-foreground">open source, gratuito e sem fins lucrativos</strong>{' '}
              que oferece uma ferramenta de tradução automática para auxiliar na leitura de mangás,
              manhwas, manhuas, HQs e demais quadrinhos em diferentes idiomas.
            </p>
            <p className="mt-2">
              Trata-se de um software disponibilizado para que cada pessoa execute em seu próprio
              ambiente (uso pessoal e local). Não há serviço remoto centralizado mantido por uma
              empresa, não há cobrança e não há planos pagos. Os mantenedores disponibilizam o
              código <strong className="text-foreground">"como está" (as is)</strong>, sem garantias
              de qualquer espécie.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. Aceitação dos Termos</h2>
            <p>
              Ao instalar, executar ou utilizar o MangaIOTranslate, o usuário declara que:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Leu e concorda com estes Termos;</li>
              <li>É maior de 18 anos ou possui consentimento do responsável legal;</li>
              <li>Utilizará o software em conformidade com a legislação aplicável;</li>
              <li>Compreende que o software não tem cunho comercial e é fornecido sem garantias.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. Modelo Gratuito e Open Source</h2>
            <p>
              O MangaIOTranslate é distribuído de forma aberta e gratuita. Não existem:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Planos pagos, mensalidades, créditos ou cobranças de qualquer natureza;</li>
              <li>Servidor central administrado pelos mantenedores que armazene contas, conteúdos ou histórico;</li>
              <li>Política de reembolso, pois nenhum pagamento é processado pelo projeto.</li>
            </ul>
            <p className="mt-2">
              O código pode ser livremente inspecionado, modificado e auto-hospedado. Cada
              instância roda no ambiente do próprio usuário.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Conteúdo Enviado pelo Usuário e Direitos Autorais</h2>
            <p>
              O MangaIOTranslate apenas processa, na máquina do usuário, os arquivos que o
              próprio usuário fornece. Não há curadoria, hospedagem pública ou redistribuição
              de obras por parte do projeto.{' '}
              <strong className="text-foreground">A responsabilidade pela origem, legalidade e
              utilização do material é integral e exclusivamente do usuário.</strong>
            </p>
            <p className="mt-2">
              Ao processar qualquer arquivo, o usuário declara que:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Possui os direitos necessários sobre o material, ou autorização do detentor dos direitos;</li>
              <li>Não utilizará o resultado para fins de distribuição pública, republicação ou comercialização de obras protegidas;</li>
              <li>Assume total responsabilidade civil e penal pelo uso indevido de conteúdo protegido.</li>
            </ul>
            <p className="mt-2">
              Os mantenedores do projeto <strong className="text-foreground">não se responsabilizam</strong>{' '}
              por violações à Lei nº 9.610/1998 (Lei de Direitos Autorais) ou normas equivalentes
              praticadas pelos usuários do software.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Uso Permitido</h2>
            <p>O usuário poderá utilizar o MangaIOTranslate para:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Tradução de obras sobre as quais possui direitos ou autorização;</li>
              <li>Visualização privada das traduções geradas em sua própria instância;</li>
              <li>Fins de estudo linguístico, acessibilidade e uso pessoal não comercial;</li>
              <li>Tradução de conteúdos de domínio público ou licenciados de forma compatível.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Uso Proibido</h2>
            <p>É expressamente vedado utilizar este software para:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Distribuir publicamente, comercializar ou republicar traduções de obras protegidas sem autorização;</li>
              <li>Operar serviços de scanlation ou repositórios não autorizados;</li>
              <li>Processar conteúdos cujos direitos não pertencem ao usuário e para os quais não há autorização;</li>
              <li>Praticar qualquer ato que configure pirataria ou violação de direitos autorais;</li>
              <li>Qualquer uso que viole a legislação aplicável.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Armazenamento Local e Perda de Dados</h2>
            <p>
              Todos os dados gerados ou enviados (imagens, OCR, traduções, configurações,
              usuários da instância) ficam{' '}
              <strong className="text-foreground">armazenados exclusivamente no ambiente local
              do usuário</strong> que executa o software. O projeto não opera infraestrutura de
              armazenamento remoto.
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>É responsabilidade exclusiva do usuário realizar backup do que considera relevante;</li>
              <li>Atualizações, migrações ou alterações de configuração podem implicar perda parcial ou total de dados locais;</li>
              <li>Não há SLA, suporte garantido ou compromisso de continuidade.</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">8. Isenção de Responsabilidade</h2>
            <p>
              O software é fornecido na modalidade <em>"as is"</em>, sem garantias expressas ou
              implícitas de qualquer natureza, incluindo, sem limitação, garantias de
              comercialização, adequação a uma finalidade específica ou não violação de direitos.
              Os mantenedores não se responsabilizam por:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Conteúdo processado pelos usuários, independentemente de sua licitude;</li>
              <li>Violações de direitos autorais ou propriedade intelectual praticadas pelos usuários;</li>
              <li>Uso indevido ou ilegal das traduções geradas;</li>
              <li>Danos diretos, indiretos, incidentais ou consequenciais decorrentes do uso ou impossibilidade de uso do software;</li>
              <li>Falhas técnicas, perda de dados locais, indisponibilidade de serviços externos ou casos fortuitos e de força maior;</li>
              <li>Qualidade, precisão ou adequação das traduções geradas automaticamente.</li>
            </ul>
          </section>

          {/* 9 — Privacidade */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">9. Política de Privacidade</h2>
            <p>
              Por se tratar de software de execução local, o MangaIOTranslate não possui um
              controlador centralizado de dados pessoais. Os mantenedores não coletam, recebem
              ou armazenam dados dos usuários da aplicação.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-1">9.1 Dados tratados na sua máquina</h3>
            <p>
              Durante o uso, a instância local pode armazenar, no seu próprio disco:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Credenciais de acesso da instância (nome, e-mail e senha do administrador local);</li>
              <li>Imagens enviadas, resultados de OCR, traduções e metadados das seções;</li>
              <li>Configurações de uso e preferências da aplicação.</li>
            </ul>
            <p className="mt-2">
              Esses dados não são transmitidos para servidores dos mantenedores. Para apagá-los,
              basta remover os diretórios da instância no seu sistema.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-1">9.2 Serviço externo: Google Tradutor</h3>
            <p>
              A única comunicação externa realizada pela aplicação é a chamada ao{' '}
              <strong className="text-foreground">Google Tradutor</strong> durante a etapa de
              tradução de texto. Nessa etapa, apenas os trechos de texto extraídos da imagem
              são enviados ao serviço para tradução. Nenhuma informação de conta ou
              identificação pessoal é incluída nesse envio.
            </p>
            <p className="mt-2">
              O uso do Google Tradutor está sujeito aos termos e à política de privacidade da
              própria Google, fora do controle deste projeto.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-1">9.3 LGPD e direitos do titular</h3>
            <p>
              Como o tratamento de dados pessoais ocorre na própria máquina do usuário, o usuário
              atua simultaneamente como titular e operador desses dados. Para exercer direitos
              previstos na <strong className="text-foreground">Lei nº 13.709/2018 (LGPD)</strong>{' '}
              em relação a dados armazenados na sua instância (acesso, correção, eliminação,
              portabilidade), basta gerenciar os arquivos locais correspondentes.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-1">9.4 Segurança</h3>
            <p>
              A segurança dos dados depende das medidas de proteção adotadas no ambiente onde
              o software está instalado (sistema operacional, rede e acesso físico). Nenhum
              sistema é absolutamente inviolável, e o usuário reconhece o risco inerente.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">10. Alterações nos Termos</h2>
            <p>
              Estes Termos podem ser atualizados periodicamente para refletir mudanças no
              projeto. O uso continuado após a atualização constitui aceitação dos novos termos.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">11. Lei Aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil, observado
              o caráter aberto e não comercial do projeto.
            </p>
          </section>

          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Declaração de ciência:</strong> Ao utilizar o
              MangaIOTranslate, o usuário reconhece que se trata de um projeto open source,
              gratuito e sem fins lucrativos; que a aplicação roda na sua própria máquina; que
              a única comunicação externa é com o Google Tradutor para a etapa de tradução de
              texto; e que o uso indevido ou ilegal do software é de inteira e exclusiva
              responsabilidade do usuário.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Software fornecido <em>"as is"</em>, sem garantias.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
