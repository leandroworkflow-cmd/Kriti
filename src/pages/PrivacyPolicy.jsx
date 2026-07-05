import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="font-display text-2xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: julho de 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-semibold text-base mb-2">1. Quem somos</h2>
            <p>
              A Kriti ("nós", "nossa plataforma") é uma rede social que reúne pessoas através de um
              teste de acesso cognitivo. Esta política explica quais dados coletamos, por que
              coletamos, e quais direitos você tem sobre eles, em conformidade com a Lei Geral de
              Proteção de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">2. Quais dados coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados de cadastro: e-mail, nome e, se você optar por login social, foto de perfil do Google.</li>
              <li>Conteúdo que você cria: publicações, comentários, tópicos de fórum, foto de perfil e de capa.</li>
              <li>Resultado do teste cognitivo: pontuação estimada de QI e histórico de tentativas.</li>
              <li>Dados de uso: curtidas, salvamentos, seguidores/seguindo, e contadores de visualização de posts.</li>
              <li>Dados técnicos mínimos necessários para autenticação e segurança da sua sessão.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">3. Para que usamos seus dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Viabilizar seu cadastro, login e uso das funcionalidades da plataforma.</li>
              <li>Aplicar o teste de acesso e calcular sua pontuação.</li>
              <li>Exibir seu conteúdo (posts, comentários) a outros usuários, conforme a própria natureza de uma rede social.</li>
              <li>Gerar as perguntas do teste cognitivo através de um serviço de inteligência artificial (Groq), ao qual enviamos apenas um comando genérico de geração — nenhum dado pessoal seu é enviado a esse serviço.</li>
              <li>Manter a segurança da plataforma e prevenir abusos (ex: limite de tentativas do teste).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">4. Onde seus dados ficam armazenados</h2>
            <p>
              Seus dados são armazenados em servidores da Supabase (infraestrutura em nuvem) e a aplicação
              é hospedada na Vercel. Ambos os provedores possuem práticas de segurança padrão de mercado
              (criptografia em trânsito e em repouso, controle de acesso).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">5. Compartilhamento com terceiros</h2>
            <p>
              Não vendemos seus dados pessoais. Compartilhamos dados apenas com os provedores de
              infraestrutura estritamente necessários para o funcionamento do serviço (Supabase, Vercel,
              e Groq para geração das perguntas do teste, sem envio de dados pessoais a esta última).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">6. Cookies e armazenamento local</h2>
            <p>
              Usamos apenas armazenamento técnico essencial no seu navegador (sessão de login e um
              controle simples para evitar contar múltiplas visualizações do mesmo post na mesma sessão).
              Não utilizamos cookies de rastreamento publicitário ou de terceiros.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">7. Seus direitos (Art. 18 da LGPD)</h2>
            <p>Você pode, a qualquer momento:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Confirmar a existência de tratamento dos seus dados;</li>
              <li>Acessar, corrigir ou atualizar seus dados diretamente na página de Perfil;</li>
              <li>Solicitar a portabilidade dos seus dados;</li>
              <li>Excluir definitivamente sua conta e todos os dados associados, na página de Perfil, em "Configurações da conta";</li>
              <li>Revogar o consentimento dado no cadastro, o que implica no encerramento da sua conta.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">8. Exclusão de dados</h2>
            <p>
              Ao excluir sua conta, seu usuário de autenticação e todos os dados vinculados (perfil,
              posts, comentários, curtidas, salvamentos, tópicos de fórum) são removidos
              permanentemente e não podem ser recuperados.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">9. Contato</h2>
            <p>
              Para dúvidas sobre esta política ou para exercer seus direitos de titular de dados,
              entre em contato através do e-mail informado no seu perfil de administrador da plataforma.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
