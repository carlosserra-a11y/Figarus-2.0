# Prompt profissional: landing page de portfólio do Carlos Serra

Use este prompt em qualquer IA de código (Claude, Lovable, v0, Cursor…) para recriar, evoluir ou gerar uma nova versão desta landing page. Copie tudo o que está dentro do bloco abaixo.

---

```text
PAPEL
Você é um designer de produto sênior e desenvolvedor front-end especialista em portfólios de
desenvolvedores que convertem em entrevistas de emprego. Escreva todo o texto em português do Brasil.

OBJETIVO
Criar a landing page de portfólio de Carlos Serra, desenvolvedor full stack júnior de Palhoça/SC,
24 anos, estudante de Análise e Desenvolvimento de Sistemas na FMP (2ª fase). A página tem um único
trabalho: fazer um recrutador ou tech lead entender em 30 segundos quem ele é, ver provas concretas do
que ele sabe fazer e entrar em contato.

PÚBLICO
1. Recrutadores de RH (leem rápido, procuram palavras-chave, disponibilidade e contato).
2. Tech leads (abrem o código, olham testes, arquitetura e qualidade).
3. Pequenos negócios da Grande Florianópolis (querem ver sites que funcionam).

DIREÇÃO VISUAL — inspirada em "Bleach: Thousand-Year Blood War" (temporada atual)
- Visual escuro de propósito: tinta sumi (#0a0a0c), papel de arroz (#ece9e2), vermelho do Bankai
  (#e3132f) e azul-branco das partículas Quincy (#b5d0ff) usado com moderação.
- Cartões de título como os da abertura do anime: kanji grande em pincel na vertical, à esquerda de
  cada seção, com um corte vermelho atravessando o título.
- Tipografia: Shippori Mincho B1 (títulos), Yuji Syuku (kanji em pincel), Zen Kaku Gothic New (texto),
  IBM Plex Mono (rótulos e números).
- Cada kanji tem significado real ligado à seção: 斬 (corte, hero), 要 (essencial, resumo),
  記録 (registro, destaques), 書庫 (arquivo, todos os projetos), 道 (caminho, trajetória),
  技 (técnica, habilidades), 型 (forma, método), 学 (estudo, formação), 縁 (laço, contato).
- Não usar logos, personagens nem imagens oficiais do anime. Rodapé com aviso de fan art sem vínculo.

ANIMAÇÕES (GSAP 3 + ScrollTrigger)
- Abertura: um corte vermelho atravessa a tela e o nome sobe linha por linha.
- "O giro": um ensō (círculo de tinta) com texto em órbita gira conforme a rolagem da página inteira.
- Partículas de reishi em canvas que sobem, aceleram com a rolagem e fogem do cursor.
- Projetos em destaque com rolagem horizontal presa na tela no computador; empilhados no celular.
- Linha do tempo com uma lâmina vermelha que desce junto com a rolagem.
- Easter egg "Modo Bankai" (botão e tecla B): a página fica vermelha e as partículas aceleram.
- Tudo começa visível: as animações só refinam. Sem JavaScript, sem GSAP ou com
  "prefers-reduced-motion", a página fica completa e parada.

SEÇÕES, NESTA ORDEM
1. Hero: selo "Disponível para estágio ou vaga júnior", nome grande, uma frase do que ele entrega,
   botões "Ver projetos", "Falar comigo" e "GitHub", e três números reais
   (19 repositórios, 47 dias do primeiro commit ao primeiro sistema com banco de dados,
   15 arquivos de testes automatizados).
2. Resumo de 30 segundos para recrutadores: quem sou, o que entrego, stack principal, o que procuro.
3. Quatro estudos de caso no formato Problema → O que construí → Stack → links "Ver ao vivo" e "Código":
   Figaro's Pizzaria 2.0 (Node, Express, SQLite, painel admin, 3D), Smartech 3.0 (three.js, Raio-X,
   calculadora NBR 14518, Gemini), São Cristóvão 3.0 (React 19, TypeScript, atendente de IA, LGPD,
   10 arquivos de teste) e Ingrid Lima (olho realista feito só com shader WebGL).
4. Arquivo com TODOS os repositórios do GitHub github.com/carlosserra-a11y, com filtros
   (Sistemas completos, Sites para negócios, Faculdade, Primeiros passos), busca e links para o
   GitHub Pages. Quando publicado, buscar repositórios novos pela API do GitHub e marcar como "NOVO".
5. Trajetória de agosto a outubro de 2026, do repositório "meu-primeiro-site" (descrição
   "boa sorte carlos") até shaders WebGL. A mensagem é: aprende muito rápido.
6. Habilidades com prova: cada habilidade aponta para o projeto onde aparece. Nada de barras de
   porcentagem.
7. Como eu trabalho (4 passos) e Formação (ADS na FMP, 2ª fase, o que está estudando agora).
8. Contato: GitHub, e-mail com botão de copiar, LinkedIn, WhatsApp e currículo em PDF, todos
   vindos de um objeto CONFIG no topo do script. Campos vazios somem da página.

QUALIDADE OBRIGATÓRIA
- Um único index.html, sem build, pronto para GitHub Pages.
- HTML semântico, navegação por teclado, foco visível, link "Pular para o conteúdo", contraste AA.
- Responsivo de 360 px a 1920 px, sem rolagem horizontal.
- SEO: title, description, Open Graph, JSON-LD do tipo Person.
- Desempenho: canvas pausa com a aba escondida, no máximo 90 partículas, DPR limitado a 2,
  bibliotecas de CDN com versão fixa.
- Texto direto, em voz ativa, sem clichês ("apaixonado por tecnologia") e sem números inventados.

ENTREGA
O arquivo index.html completo e um README explicando como publicar e como editar o CONFIG.
```

---

## Próximas melhorias sugeridas (peça à IA uma de cada vez)

1. **Versão em inglês** (botão PT/EN). Abre a porta para vagas remotas internacionais.
2. **Foto profissional** no hero ou no contato. Recrutadores confiam mais em perfis com rosto.
3. **Capturas de tela reais** de cada estudo de caso no lugar dos kanji (imagens WebP leves).
4. **Domínio próprio** (ex.: carlosserra.dev) apontando para o GitHub Pages.
5. **Currículo em PDF** gerado a partir da mesma informação da página.
6. **Depoimento** de um cliente (Figaro's, Smartech, São Cristóvão) ou de um professor da FMP.
7. **Analytics sem cookies** (ex.: GoatCounter) para saber quantos recrutadores visitaram.
