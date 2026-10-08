# 🍕 Figaro's Pizzaria — site, cardápio digital e pedidos

Site oficial da **Figaro's Pizzaria** (Av. Elza Lucchi, 1277 – Ponte do Imaruim, Palhoça/SC) com:

- **Cardápio completo e real**: os 57 sabores salgados, 14 pizzas doces, 7 calzones doces, lasanhas, esfihas, combos e bebidas, com os mesmos preços e regras do cardápio da CityFoods (outubro/2026).
- **Fotos reais** de pizza em todos os itens (Flickr / Wikimedia Commons, licenças livres — veja `creditos.html`).
- **Montador de pizza**: tamanho → até 3 sabores (com a pizza desenhada em fatias) → borda → observações. Preço de pizza com vários sabores = média dos sabores (regra configurável).
- **Cardápio explicado e curto**: uma categoria por vez (abas). Nas pizzas, a pessoa escolhe o tamanho uma vez (pizzas desenhadas em escala, de 25 a 40 cm) e um quadro mostra o que vem incluso, a regra do meio a meio e o preço das outras bordas; cada grupo (tradicionais / especiais) tem a tabela de preços uma vez só, em vez de repetir em cada sabor. Lista compacta com os mais pedidos primeiro, filtros, "ver mais", e o "+" já adiciona no tamanho escolhido. No computador, a foto do sabor aparece ao passar o mouse.
- **Combos** com escolha de sabores, acréscimo automático para sabor especial e troca de refrigerante.
- **Carrinho** salvo no aparelho, sugestão de bebida, pedido mínimo, editar item.
- **Checkout** com busca de endereço pelo CEP, taxa por bairro, troco, e envio do resumo para o WhatsApp da loja.
- **Banco de dados** (SQLite) com o histórico de **todos os pedidos**, status e **todas as alterações** do cardápio.
- **Acompanhamento do pedido** pelo cliente ("Meus pedidos") e "Pedir de novo".
- **Painel do desenvolvedor** (`/admin/`) com usuário e senha para cadastrar novos sabores, pizzas, produtos e bebidas, mudar preços, horários, taxa de entrega e ver os pedidos chegando (com aviso sonoro).
- **Modelos 3D** (three.js, feitos em código, sem downloads extras):
  - **pizza fatiada no topo** com a foto real por cima, tábua de madeira e vapor — as fatias caem no lugar ao abrir a página; arrastar gira a pizza, clicar puxa uma fatia com fios de queijo; ao rolar, as fatias se abrem em leque;
  - **ingredientes flutuando no fundo** em várias profundidades (parallax de câmera) que **giram conforme a página rola**, ficam um pouco para trás na rolagem rápida e voltam com mola; o cursor afasta os ingredientes (que voltam com mola) e um clique numa área vazia solta uma nuvem de farinha;
  - **caixa de pizza da Figaro's** com a logo impressa, contada pela rolagem em "Como pedir": no computador a seção fica presa na tela enquanto a tampa abre, a pizza sobe e os passos 1-2-3 acendem.
- Rolagem suave (Lenis) com mouse/trackpad, títulos que entram palavra por palavra, listas em cascata, abas do cardápio com indicador deslizante, cartões que entram em 3D, "voar para o carrinho" com rastro, brasas, confete.
- Sem WebGL, com "reduzir movimento" ou em caso de erro, o site cai sozinho para a versão 2D. Tudo roda num único laço de animação que dorme quando nada se mexe, as cenas pausam fora da tela e com modal aberto, e a qualidade se ajusta sozinha medindo os quadros. Detalhes e medições em [`PERF.md`](PERF.md).

---

## ▶️ Como rodar no seu computador

Precisa do **Node.js 22.13 ou mais novo** (recomendado: Node 24). Baixe em https://nodejs.org.

```bash
npm install
npm start
```

Abra **http://localhost:3000** (site) e **http://localhost:3000/admin/** (painel).

### Primeiro acesso ao painel (criar sua conta de desenvolvedor)

Na primeira vez que o servidor liga, ele mostra no terminal um **código de configuração**, assim:

```
  ┌────────────────────────────────────────────────────────────┐
  │  PRIMEIRO ACESSO — crie sua conta de desenvolvedor         │
  │  Abra http://localhost:3000/admin/                         │
  │  e use o código de configuração:  ABCD-1234                │
  └────────────────────────────────────────────────────────────┘
```

Entre em `/admin/`, digite o código, escolha **usuário e senha** — pronto. O código serve só para a primeira conta (assim ninguém cria uma conta antes de você quando o site estiver na internet). Depois você pode criar outras contas em **Conta → Contas de desenvolvedor**.

> A senha precisa ter 8+ caracteres, com letras e números. Ela é guardada com criptografia (scrypt) — nem quem tem o banco consegue lê-la.

---

## 🧑‍🍳 Como usar o painel

| Quero… | Onde |
|---|---|
| Adicionar um **novo sabor** de pizza (ou doce, calzone, lasanha, esfiha) | Cardápio → **Sabores** → "+ Novo sabor" |
| Adicionar uma **bebida** ou outro **produto** | Cardápio → **Produtos e bebidas** → "+ Novo produto" (tipo "Simples") |
| Criar um **novo tipo de pizza** (ex.: "Pizza Vegana") com tamanhos próprios | Produtos → "+ Novo produto" (tipo "Pizza") e depois cadastre os sabores dele |
| Criar um **combo** | Produtos → tipo "Combo" (preço fixo + partes + bebidas) |
| Esconder algo sem apagar | Botão **Ativo** (verde/cinza) |
| Colocar em **Destaques** | ⭐ na linha do item |
| Mudar **preços**, foto, descrição | ✏️ na linha do item |
| Mudar a ordem no site | ↑ ↓ |
| Mudar **horários**, **taxa de entrega**, **taxa por bairro**, **pedido mínimo**, WhatsApp | **Loja** |
| **Fechar a loja** num feriado | Loja → Status → "Forçar FECHADO" |
| Ver e atualizar **pedidos** (Confirmado → No forno → Saiu → Entregue) | **Pedidos** (o cliente vê a mudança na hora) |
| Ver **quem mudou o quê** | **Histórico** |
| Faturamento e sabores mais vendidos | **Painel** |
| Backup do banco / exportar cardápio | **Conta** |

Fotos: no formulário, toque em **📷 Enviar foto** (a imagem é reduzida automaticamente) ou cole um link `https://`.

---

## 🌐 Publicar na internet

O site tem **duas partes**:

1. **Arquivos do site** (`index.html`, `css/`, `js/`, `assets/`, `data/`) — funcionam até no **GitHub Pages**.
2. **Servidor** (`server/`) — banco de dados, painel e pedidos salvos. Precisa de um lugar que rode Node.js.

### Só GitHub Pages (sem servidor)
Já funciona: o cardápio vem de `data/menu.json` e o pedido é enviado **pelo WhatsApp** da loja. O painel e o histórico de pedidos **não** funcionam sem o servidor.
Quando você editar o cardápio no painel, use **Conta → Baixar menu.json** e substitua o arquivo `data/menu.json` no repositório para atualizar essa versão.

### Site completo (recomendado): Railway, Render, Fly.io ou uma VPS
1. Crie o serviço apontando para este repositório, com o comando `npm start`.
2. Configure as variáveis de ambiente:

| Variável | Para quê | Exemplo |
|---|---|---|
| `PORT` | porta (a plataforma geralmente define sozinha) | `3000` |
| `DATA_DIR` | pasta **persistente** do banco e das fotos enviadas | `/data` |
| `TRUST_PROXY` | sempre `1` quando estiver atrás de HTTPS da plataforma | `1` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | (opcional) cria sua conta automaticamente no 1º start | — |
| `CORS_ORIGINS` | (opcional) libera o site do GitHub Pages a usar este servidor | `https://carlosserra-a11y.github.io` |

3. **Importante:** monte um **volume/disco persistente** em `DATA_DIR`. Sem isso o banco é apagado a cada novo deploy.
4. Se quiser manter o endereço do GitHub Pages usando o servidor, descomente a linha `<meta name="figaros-api" ...>` no `index.html` com o endereço do servidor.

---

## 🗂️ Estrutura

```
index.html              site (cardápio, montador, carrinho, checkout, "meus pedidos")
admin/index.html        painel do desenvolvedor
creditos.html           créditos/licenças das fotos
css/site.css            identidade visual (cores da logo) e layout
css/admin.css           layout do painel
js/shared/pricing.js    REGRAS DE PREÇO (usadas pelo site E pelo servidor)
js/site/*.js            site: api, cardápio, montador, carrinho, checkout, pedidos, animações
js/site/3d.js           modelos 3D (gerado a partir de src/3d com npm run build:3d)
src/3d/                 código-fonte dos modelos 3D
js/admin/*.js           painel: login, pedidos, cardápio, loja, histórico, conta
data/menu.json          cardápio inicial (semente do banco) e versão do GitHub Pages
data/image-credits.json autor e licença de cada foto
assets/img/             logo, ícones e fotos (assets/img/menu/*.webp)
server/index.js         inicia o servidor
server/app.js           rotas da API (pública e do painel)
server/db.js            banco SQLite (node:sqlite, sem dependências nativas)
server/security.js      senhas, sessões, limites de tentativas, cabeçalhos de segurança
server/validate.js      validação de tudo que chega na API
tests/                  testes automáticos (npm test)
js/site/motion.js       laço único de animação, rolagem suave (Lenis), "reduzir movimento"
js/site/icons.js        ícones desenhados em traço (no lugar dos emojis)
js/site/3d-worker.js    worker das texturas 3D (gerado a partir de src/3d com npm run build:3d)
js/vendor/lenis.mjs     Lenis (rolagem suave, MIT) — gerado com npm run build:vendor
sw.js                   service worker: imagens em cache e site abrindo sem internet
```

## 🔥 Figaro's 2.0 — "Futurismo Quente"

Visual novo por cima do site: **tema escuro "Forno à Noite"** como padrão (o claro continua no botão ☀/☾ do topo, e a escolha fica salva no aparelho), vidro, brilho de brasa e animações ligadas à rolagem.

| O quê | Onde |
|---|---|
| Cores, vidro, brilhos, tema escuro e todas as animações em CSS | `css/futuro.css` (apague o `<link>` dele no `index.html` para voltar ao visual anterior) |
| Tema antes da página pintar + decisão da abertura | `js/site/theme-boot.js` (arquivo separado porque o servidor bloqueia script inline) |
| Botão de tema (círculo que se abre a partir do botão) | `js/site/theme.js` |
| Topo em camadas, header que vira pílula e some ao descer, destaques presos com rolagem horizontal, contadores, texto pintado no "Sobre", nós da linha do "Como pedir", tom do fundo por seção, divisores | `js/site/reveal.js` |
| Cursor próprio, luz que segue o mouse nos cartões, ondinha no clique, vibração ao adicionar | `js/site/cursor.js` |
| Abertura (só na 1ª visita da sessão, ~1,1 s) | `js/site/preloader.js` |

Tudo roda no laço único de `motion.js`, respeita "reduzir movimento" (nada se mexe, tudo aparece) e diminui o brilho/blur em aparelhos modestos ou com economia de dados (`html.lite`). O fundo 3D acompanha o tema (névoa da cor da página).

Endereços de teste novos (somam com os de baixo): `?nointro` (sem abertura), `?nocursor` (cursor normal), `?nopin` (destaques sem a seção presa).

## 🧊 Modelos 3D

O código 3D fica em `src/3d/` e é empacotado (com só o necessário do three.js) em `js/site/3d.js` e `js/site/3d-worker.js`:

```bash
npm install
npm run build
```

Rode o build sempre que mudar algo em `src/3d/` e faça commit dos arquivos gerados (o GitHub Pages usa esses arquivos). `npm run build:3d` refaz só o 3D; `npm run build:vendor` refaz só o Lenis.

| Arquivo | O que faz |
|---|---|
| `src/3d/pizza.js` | pizza fatiada (foto real no topo, corte com massa/molho/queijo, borda, fios de queijo) |
| `src/3d/ingredients.js` | manjericão, tomate, azeitona, cogumelo, pepperoni, queijo, pimenta, cebola |
| `src/3d/hero.js` | cena do topo |
| `src/3d/background.js` | fundo com ingredientes em profundidade |
| `src/3d/box.js` | caixa da Figaro's que abre com a rolagem |
| `src/3d/textures.js` | monta as texturas (madeira, borda, papelão com a logo…) e guarda em cache |
| `src/3d/texgen.js` | os pixels das texturas — roda dentro de um Web Worker, sem travar a página |
| `src/3d/texpool.js` | fila de texturas (worker; se ele falhar, gera aos pouquinhos na página) |
| `src/3d/core.js` | "palco" (um renderer para topo + caixa), laço compartilhado, qualidade adaptativa, perda de contexto |

### Endereços de teste

| Adicione no endereço | Para quê |
|---|---|
| `?fps` | medidor de quadros por segundo no canto da tela |
| `?no3d` | abre o site sem nenhum 3D (versão 2D) |
| `?quality=low` ou `?quality=high` | força a qualidade do 3D (aparelho fraco / forte) |
| `?nosmooth` | desliga a rolagem suave |
| `?nosw` | não registra o service worker |
| `?debug3d` | expõe as cenas em `window.__fig3d` para inspeção |

Dá para combinar: `?fps&quality=low`.

## 🔒 Segurança

- O **servidor recalcula todos os preços** — ninguém consegue alterar o valor do pedido pelo navegador.
- Senhas com **scrypt** + sal; sessão em cookie `HttpOnly` + `SameSite=Strict`; proteção contra CSRF; limite de tentativas de login.
- Todo texto do cliente é **escapado** antes de aparecer na tela (sem XSS) e validado no servidor.
- Cabeçalhos de segurança (CSP, nosniff, frame-ancestors) e lista branca de arquivos servidos.
- O acompanhamento de pedido usa um código aleatório e **não mostra endereço nem telefone**.

## 🧪 Testes

```bash
npm test
```

Cobrem: preços (meio a meio, 3 sabores, bordas, combos com sabor especial, esfihas), pedido mínimo, taxa por bairro, horário (inclusive depois da meia-noite), criação de pedido, login, primeiro acesso, CSRF, criação/edição/exclusão pelo painel com histórico e arquivos internos protegidos.

## ⚠️ Confira antes de publicar

- **Telefone/WhatsApp**: o site antigo usava `(48) 93341-0102`; a caixa de pizza nas fotos da CityFoods mostra `3341-0102`. Confirme o número certo em **Loja**.
- **Taxa de entrega**: está R$ 8,90 (valor do site antigo). A CityFoods calcula por bairro — cadastre os bairros em **Loja → Taxa por bairro**.
- **Bordas**: os preços vieram da pizza Gigante; confirme se valem para todos os tamanhos.
- **Fotos**: são fotos reais de pizzas parecidas, publicadas com licença livre. Para mostrar as pizzas da própria Figaro's, envie fotos pelo painel.
- **Avaliação 4,5 / +3.000**: veio do site antigo. Ajuste ou apague em **Loja** se não for o número atual.
