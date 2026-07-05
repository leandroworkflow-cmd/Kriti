import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="font-display text-2xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: julho de 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-semibold text-base mb-2">1. Aceitação dos termos</h2>
            <p>
              Ao criar uma conta na Kriti, você concorda com estes Termos de Uso e com a nossa
              <Link to="/privacidade" className="text-primary hover:underline"> Política de Privacidade</Link>.
              Se você não concorda com algum ponto, não utilize a plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">2. O que é a Kriti</h2>
            <p>
              A Kriti é uma rede social de acesso condicionado a um teste cognitivo. A aprovação no
              teste não constitui, e não deve ser interpretada como, uma medição científica ou
              clinicamente válida de inteligência — é uma dinâmica de acesso à comunidade.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">3. Elegibilidade</h2>
            <p>
              Você precisa ter pelo menos 18 anos, ou a maioridade civil da sua jurisdição, para criar
              uma conta. Ao se cadastrar, você declara que as informações fornecidas são verdadeiras.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">4. Conduta na plataforma</h2>
            <p>É proibido usar a Kriti para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Publicar conteúdo ilegal, discriminatório, difamatório ou que incite violência;</li>
              <li>Assediar, ameaçar ou constranger outros usuários;</li>
              <li>Criar múltiplas contas para burlar o limite de tentativas do teste;</li>
              <li>Tentar acessar contas de terceiros ou áreas administrativas sem autorização;</li>
              <li>Automatizar cadastros ou publicações (bots).</li>
            </ul>
            <p className="mt-2">
              Contas que violem estas regras podem ser suspensas ou banidas pela administração, sem aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">5. Conteúdo publicado por você</h2>
            <p>
              Você mantém a titularidade do conteúdo que publica, mas concede à Kriti uma licença para
              exibi-lo dentro da plataforma para os demais usuários, como parte do funcionamento normal
              de uma rede social. Você é o único responsável pelo que publica.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">6. Encerramento de conta</h2>
            <p>
              Você pode excluir sua conta a qualquer momento pela página de Perfil. A administração
              também pode suspender ou encerrar contas que violem estes termos.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">7. Isenção de responsabilidade</h2>
            <p>
              A Kriti é fornecida "como está". Não garantimos disponibilidade ininterrupta da
              plataforma e não nos responsabilizamos por opiniões ou conteúdos publicados por usuários.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">8. Alterações destes termos</h2>
            <p>
              Podemos atualizar estes termos periodicamente. Mudanças relevantes serão comunicadas na
              própria plataforma.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
