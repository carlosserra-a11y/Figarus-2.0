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

DIREÇÃO VISUAL — identidade de "Bleach: Thousand-Year Blood War" (detalhes em IDENTIDADE.md)
- Dois lados. Quincy (padrão): azul-noite #0b0e1c, branco frio #eef2fb, aço #a3b4d8, contorno magenta
  #ff3b5c. Shinigami (modo Bankai): preto #05060a e vermelho #e3132f. Proporção 70/20/10.
- Hero como pôster: cena em 6 camadas com paralaxe (céu com faixa vermelha no horizonte, lua com
  ensō e texto em órbita, cidade de torres do Wandenreich ao longe, cidade próxima, névoa, tinta preta),
  nome gigante em caixa alta com um corte vermelho e coluna de texto japonês vertical com selo vermelho:
  「千年の時を超え、コードで斬る。」
- Projetos em destaque como uma página de mangá em papel (#f2efe6) e tinta (#0b0b0d): quadros com bordas
  inclinadas, lidos da direita para a esquerda, retícula, linhas de velocidade e balão de fala.
- Tipografia: Big Shoulders Display 900 (títulos), Shippori Mincho B1 (subtítulos e japonês),
  Yuji Syuku (kanji em pincel), Zen Kaku Gothic New (texto), IBM Plex Mono (rótulos).
- Cada seção abre com um kanji de significado real: 斬 corte, 要 essencial, 記録 registro, 書庫 arquivo,
  道 caminho, 技 técnica, 型 forma, 学 estudo, 縁 laço.
- Nenhuma imagem, logo ou personagem oficial do anime: tudo desenhado em código. Rodapé com aviso de
  fan art sem vínculo.

ANIMAÇÕES E INTERAÇÕES (GSAP 3 + ScrollTrigger + Lenis)
- Abertura: a tela se parte num corte vermelho e o nome sobe linha por linha.
- Paralaxe do hero com a rolagem e com o mouse; o ensō e o texto em órbita giram com a rolagem.
- "Licht Regen": flechas de luz caindo na diagonal em canvas, que aceleram com a rolagem.
- Modo Bankai (botão e tecla B): clarão vermelho com 卍解, tremida, paleta vermelha e reiatsu subindo.
- Títulos que se decodificam em katakana; quadros do mangá "entintados" ao entrar; balão que salta.
- Cursor de reiatsu, botões magnéticos, cartões com inclinação 3D e brilho, linha do tempo com lâmina.
- Estudo de caso em diálogo (contexto, o que construí, decisões técnicas, stack, links).
- Tudo começa visível. Sem JavaScript, sem as bibliotecas ou com "prefers-reduced-motion", a página
  fica completa e parada.

SEÇÕES, NESTA ORDEM
1. Hero: selo "Disponível para estágio ou vaga júnior", nome grande, uma frase do que ele entrega,
   botões "Ver projetos", "Falar comigo" e "GitHub", e três números reais
   (19 repositórios, 47 dias do primeiro commit ao primeiro sistema com banco de dados,
   15 arquivos de testes automatizados).
2. Resumo de 30 segundos para recrutadores em forma de ficha de identificação (nome, idade, função,
   base, formação, status) + quem sou, o que entrego, stack principal, o que procuro.
3. Os 5 melhores repositórios como quadros de mangá, cada um com botão "Estudo de caso":
   Figaro's Pizzaria 2.0 (Node, Express, SQLite, painel admin, 3D), São Cristóvão 3.0 (React 19,
   TypeScript, atendente de IA, LGPD, 10 arquivos de teste), Smartech 3.0 (three.js, Raio-X,
   calculadora NBR 14518, Gemini), Ingrid Lima (olho realista feito só com shader WebGL) e
   CS Store (Tailwind, showroom 3D, calculadora de troca).
4. Barra com a linguagem principal por repositório e arquivo com TODOS os repositórios do GitHub github.com/carlosserra-a11y, com filtros
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
