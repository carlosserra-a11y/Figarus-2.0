# PROMPT — Redesign "Futurismo Quente" do Figaro's Pizzaria

Você é um(a) desenvolvedor(a) front-end sênior especialista em motion design e interfaces premium. Sua missão é evoluir a interface do site do Figaro's Pizzaria (https://carlosserra-a11y.github.io/Figaros-Pizzaria/) para um visual MODERNO e FUTURISTA, mais INTERATIVO e com ANIMAÇÕES AO ROLAR, sem perder a alma de pizzaria de bairro e sem quebrar nada que já funciona.

## 1. Contexto do projeto (leia antes de tudo)

- Site estático no GitHub Pages: index.html + css/site.css (tokens em :root) + JavaScript em ES modules SEM build e SEM framework (js/site/*.js, js/shared/*.js).
- JÁ EXISTE e deve ser REAPROVEITADO, não duplicado:
  - js/site/motion.js: laço único de requestAnimationFrame (ticker, frame, wake), rolagem suave com Lenis, prefers-reduced-motion acompanhado em tempo real (motion.reduced + classe .rm no html).
  - js/site/fx.js: partículas em canvas (farinha/brasas), ingredientes flutuando, tilt 3D nos cards, botões magnéticos, flyToCart, confete, observeReveal (títulos palavra por palavra), toast.
  - js/site/scrollfx.js: barra de progresso, parallax por [data-depth], faixa de sabores que reage à velocidade da rolagem, seção "Como pedir" com a caixa que abre conforme a rolagem, traço de molho desenhado sob os títulos, cards entrando em 3D.
- Seções: header (nav + carrinho), hero (pizza interativa que gira ao arrastar), #destaques, #cardapio (com busca), #como-funciona, #sobre, #avaliacoes (hidden), #contato (mapa carregado sob demanda), footer e barra fixa do carrinho no mobile.
- Identidade atual: creme #f4ecd9, vermelho #982c27, verde #2e6b3f, dourado #e3a93b, tinta #2b1d17; fontes Alfa Slab One (títulos), Nunito (texto) e Caveat (manuscrita).

## 2. Direção criativa: "Futurismo Quente"

Conceito: o forno a lenha encontra uma interface sci-fi. Pense em "uma pizzaria de 2030": escuro, com brilho de brasa, vidro, luz e movimento fluido. Continua quente e apetitoso; não pode ficar frio nem com cara de banco.

1. **Tema escuro como padrão ("Forno à Noite")**: fundo em tons de carvão quente (#120b08 a #1c120d) com brilhos de brasa (dourado/vermelho) como luz ambiente. O tema claro atual continua disponível num botão no header, respeitando prefers-color-scheme e lembrando a escolha em localStorage.
2. **Novos tokens em :root**: --ember (#ff6a2b), --ember-glow, --neon-gold, --glass-bg, --glass-border, --glow-sm/--glow-lg. Gradientes mesh/cônicos animados bem devagar ao fundo.
3. **Glassmorphism** no header, nos cards, no carrinho e nos modais: backdrop-filter blur(16px) saturate(1.4), borda de 1px em gradiente e fallback sólido via @supports.
4. **Tipografia**: manter Alfa Slab One nos títulos grandes (é a identidade). Adicionar uma fonte display futurista do Google Fonts (Unbounded ou Space Grotesk) para preços, números, etapas e selos. Título do hero com clamp() até ~8vw, letter-spacing apertado e texto em gradiente de brasa com shimmer sutil.
5. **Luz que segue o cursor**: cards e botões com spotlight (radial-gradient usando --mx/--my atualizados no pointermove) e borda que acende perto do mouse.
6. **Textura**: overlay de grain/noise SVG bem sutil e, no hero, um grid em perspectiva estilo synthwave discreto, em tom de brasa, que se move lentamente.

## 3. Animações ao rolar (prioridade máxima)

Use CSS scroll-driven animations (animation-timeline: view() / scroll()) quando o navegador suportar, com fallback no ticker/IntersectionObserver já existentes. Anime SOMENTE transform, opacity, filter e clip-path; nunca top/left/width/height.

- **Hero**: ao rolar, a pizza aumenta e gira levemente, o título se separa em camadas com parallax por linha, o fundo escurece e aparece um indicador de "role para baixo" animado.
- **Revelações variadas por tipo de elemento**:
  - títulos: máscara/clip-path revelando linha por linha de baixo para cima, de borrado para nítido;
  - cards: entrada escalonada (stagger de 60–80ms) com leve rotateX;
  - imagens: clip-path inset abrindo junto com zoom de 1.15 para 1.
- **Destaques**: no desktop, seção pinada com os cards deslizando na horizontal enquanto a pessoa rola para baixo; no mobile, scroll-snap nativo com indicador de posição.
- **Contadores animados** (ex.: "57 sabores") que contam do zero ao entrar na tela.
- **Como pedir**: manter a caixa que abre e adicionar uma linha luminosa ligando as 3 etapas, que acende conforme a rolagem; cada etapa "liga" com um pulso de luz.
- **Sobre**: fotos com parallax em profundidades diferentes e o texto principal "pintado" pela rolagem, com as palavras passando de apagadas para acesas uma a uma.
- **Transição entre seções**: divisores em forma de onda ou fatia desenhados pela rolagem e cor de fundo interpolando suavemente de uma seção para a outra.
- **Barra de progresso** do topo vira um "fio de brasa" brilhante com uma faísca na ponta.

## 4. Interatividade e microinterações

- **Cursor customizado** (só com ponteiro fino, nunca no toque): ponto + anel que cresce sobre links e botões e mostra rótulos como "Pedir" ou "Ver" sobre os cards. Desligado com reduced motion.
- **Botões**: manter o efeito magnético e acrescentar um brilho que varre no hover (sheen), ripple no clique e estado pressionado (scale .97) com feedback tátil (navigator.vibrate curto no mobile, se disponível).
- **Cardápio**: tilt 3D existente + spotlight + a imagem da pizza "saltando" do card (translateZ) no hover. Chips de categoria animados e reorganização dos itens com View Transitions API (fallback FLIP). Na busca, filtrar com animação e destacar o termo buscado.
- **Carrinho**: contador que "pula" ao adicionar, flyToCart com trilha de brilho e drawer do carrinho em vidro com itens entrando escalonados.
- **Header**: ao rolar, encolhe e vira uma pílula flutuante de vidro; some ao rolar para baixo e volta ao rolar para cima. Indicador do link ativo deslizando entre os itens conforme a seção visível.
- **Status da loja**: "Aberto agora" / "Fechado" com ponto neon pulsante (usar o storeStatus que já existe).
- **Preloader** curto (menos de 1,2s, só na primeira visita da sessão via sessionStorage): a pizza gira e forma o logo, depois sai com uma transição de cortina. Nunca pode atrasar o LCP.

## 5. Restrições técnicas (não negociáveis)

- Sem framework e sem etapa de build: JavaScript vanilla em ES modules, como o projeto atual. Prefira APIs nativas. Não adicione GSAP ou outras bibliotecas se der para fazer com o ticker do motion.js.
- Toda animação em JS deve se registrar no ticker do motion.js; nada de novos loops requestAnimationFrame próprios. Medir layout só em resize, como o scrollfx.js já faz.
- **prefers-reduced-motion**: toda animação nova respeita motion.reduced / .rm. Com reduced motion, o conteúdo aparece direto, sem parallax, sem pinagem, sem cursor custom e sem preloader.
- **Performance**: Lighthouse mobile com Performance ≥ 90, CLS < 0.1, LCP < 2.5s e 60fps num celular intermediário. No máximo ~3 camadas de backdrop-filter visíveis ao mesmo tempo. will-change só durante a animação. Reduzir ou desligar efeitos pesados (partículas, grid, blur) em telas pequenas, com navigator.connection.saveData ou com hardwareConcurrency baixo.
- **Acessibilidade**: contraste AA também no tema escuro, foco visível, skip-link e atributos ARIA preservados. Nenhum conteúdo escondido de leitores de tela por causa de animação e nada que dependa só de hover.
- **NÃO QUEBRAR**: carrinho, montador de pizza ("Montar minha pizza"), checkout com envio para o WhatsApp, "Meus pedidos", busca, mapa sob demanda, área admin/, SEO (meta tags e JSON-LD), manifest/PWA e créditos das fotos.
- **Mobile-first**: testar em 360px, 768px, 1280px e 1920px, além de Chrome, Safari (iOS) e Firefox (sem suporte a scroll-timeline).

## 6. Como trabalhar

1. Antes de escrever código, leia index.html, css/site.css, js/site/main.js, motion.js, fx.js e scrollfx.js. Depois me apresente um plano curto por seção dizendo o que será reaproveitado e o que será criado.
2. Implemente em etapas e teste cada uma no navegador antes de seguir:
   tokens e tema escuro → header e hero → revelações ao rolar → seções (destaques, cardápio, como pedir, sobre, contato) → microinterações → cursor e preloader.
3. Organização: novos módulos separados (ex.: js/site/theme.js, reveal.js, cursor.js, preloader.js) e CSS novo em blocos comentados. Comentários em português, no mesmo estilo do código atual.
4. No final, entregue: um resumo do que mudou, como desligar cada efeito individualmente e um checklist de testes (reduced motion, mobile, Safari, Firefox, tema claro/escuro, fluxo completo de pedido até o WhatsApp).

## Critério de sucesso

Em 3 segundos, quem abrir o site precisa sentir "isso é uma pizzaria do futuro" e, ainda assim, reconhecer o Figaro's: as mesmas cores quentes, a mesma pizza apetitosa e o mesmo pedido pelo WhatsApp a um toque.
