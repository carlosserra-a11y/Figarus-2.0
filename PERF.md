# Desempenho e qualidade visual — antes e depois

## Rodada 3 — Figaro's 2.0 (correções)

- **Travamento na rolagem suave (já existia antes do 2.0):** quando o Lenis avisava "rolei" no meio de um quadro, o laço de `motion.js` era agendado duas vezes; a cada quadro o número de laços dobrava (1, 2, 4, 8…) até a página congelar — bastava clicar num link do menu ou rolar com a rodinha do mouse no computador. Agora existe um único próximo quadro, chamadas repetidas no mesmo quadro são ignoradas e a velocidade da rolagem nunca vira `NaN`. O laço reserva do 3D (`src/3d/core.js`) recebeu a mesma correção.
- Header: voltava a ficar preso visível depois de clicar num link do menu com o mouse; agora só fica visível com foco vindo do teclado.
- Luz que segue o mouse: em combos, cartão de contato e depoimentos a borda luminosa podia "vazar" para fora do cartão (faltava `position: relative`).
- Cursor: o rótulo ("Ver", "Pedir") agora se atualiza quando a página rola com o mouse parado; caneta (pen) também ganha o cursor.
- Busca: o termo destacado não quebra mais o nome do sabor em pedaços e não marca os selos ("destaque").
- Acessibilidade: status aberto/fechado continua para leitores de tela quando só o ponto aparece; botão de tema sem `aria-pressed` conflitante; setas do teclado funcionam nos destaques presos.
- Página de créditos segue o tema escolhido (links legíveis no escuro); `manifest` com as cores do tema escuro.


## Rodada 2 — cardápio mais curto e explicado

| Medida | Antes | Depois |
|---|---|---|
| Altura da página (computador, 1280 px) | 18.249 px | 8.115 px (**−56%**) |
| Altura só do cardápio | 12.460 px (106 cartões grandes empilhados) | 2.192 px (**−82%**), uma categoria por vez |
| Preço das pizzas | "a partir de R$ 61,90" repetido em cada cartão | escolhe o tamanho uma vez; a tabela de cada grupo mostra o preço exato |
| Ícones | emojis (mudam em cada aparelho; o de esfiha nem aparecia no Windows) | ícones desenhados em traço, iguais em qualquer aparelho |
| Fundo 3D | girava só com a velocidade da rolagem | gira conforme a página desce, fica para trás na rolagem rápida e volta com mola |

## Rodada 1 — 3D, rolagem e leveza

Medições feitas no mesmo computador (Chrome, placa de vídeo Radeon RX 570, 12 núcleos, tela de 75 Hz).
"Antes" = site publicado no GitHub Pages em 07/10/2026; "depois" = esta versão rodando localmente.

| Medida | Antes | Depois |
|---|---|---|
| Travamentos ao abrir a página (tarefas longas) | 5, somando **~6.000 ms** (a pior: 2.505 ms) | 3, somando **~306 ms** (a pior: 129 ms) |
| Rolagem até o fim da página — quadro mediano | 26,7 ms (**~37 fps**) | 13,3 ms (**75 fps**, o máximo da tela) |
| Rolagem — pior quadro | 387 ms | 67 ms |
| Contextos WebGL ao mesmo tempo | 4 (topo, caixa, fundo + 1 só para testar o aparelho) | 2 (palco topo/caixa + fundo) |
| Nitidez do 3D do topo | desenhado em 453×453 e esticado para 579×579 (borrado) | desenhado no tamanho exibido |
| Nitidez da caixa 3D | 481×437 esticado para 538×489 | desenhado no tamanho exibido |
| Logo da tampa da caixa | `logo.png`, 304 KB | `logo-lid.webp`, 35 KB |
| Erros no console (GitHub Pages) | 404 em `api/menu` em toda visita | nenhum |
| Fotos do cardápio | 640 px (~37 KB) para qualquer tela | 320 / 480 / 640 px conforme a tela (~17 KB num notebook comum) |

## O que causava os travamentos e como foi resolvido

- **Texturas geradas pixel a pixel na thread principal** (madeira 1024², borda da pizza testando 70 manchas por pixel ≈ 18 milhões de contas, papelão várias vezes). Agora os pixels são gerados num **Web Worker** (`src/3d/texgen.js`), a borda pinta só a vizinhança de cada mancha, e topo e caixa compartilham as mesmas texturas.
- **Três renderizadores 3D** compilando os mesmos shaders e subindo as mesmas texturas três vezes. Agora topo e caixa usam **um renderer só** (o canvas muda de seção, já que nunca aparecem juntos) e os shaders são compilados com `compileAsync` antes do primeiro quadro.
- **Fundo 3D desenhando a tela inteira em todo quadro**, mesmo com a página parada, atrás de modais e atrás da seção escura. Agora ele desenha a 60 fps só quando algo muda, cai para ~30 fps parado, para com modal aberto e quando a seção "Sobre" cobre a tela; a farinha é animada direto na GPU.
- **Leitura de layout em todo quadro** (`getBoundingClientRect` no topo, na caixa e no parallax; `scrollHeight` na barra de progresso). Agora as medidas ficam em cache e só mudam quando a página muda de tamanho.
- **Seis laços de animação separados.** Agora há um laço único (`js/site/motion.js`) que dorme quando nada se mexe.
- **Brasas com `shadowBlur`** (caríssimo no Canvas 2D) trocadas por um brilho pré-desenhado.
- **Blur do header** recalculado a cada quadro por cima do 3D: no celular o header ficou sólido.

## Bugs corrigidos

- 3D do topo e da caixa borrados (tamanho do canvas).
- Ingredientes do topo (versão 2D): o mouse apagava o parallax da rolagem, e uma transição CSS deixava o parallax "atrasado".
- Cartões que entravam animados ficavam com o tilt do mouse atrasado e sem a transição da sombra.
- `will-change` em todos os cartões (dezenas de camadas de composição, memória alta no celular).
- Canvas das brasas esticado (tamanho calculado antes do layout final) e canvas da farinha ocupando memória depois de desligado.
- No celular, a barra de endereço redimensionava o fundo 3D a cada rolagem (saltos).
- A pizza 3D inclinava com o dedo durante a rolagem no celular.
- O 3D não voltava depois de uma perda de contexto WebGL.
- `PCFSoftShadowMap` (removido do three.js) gerava aviso no console.
- Tampa da caixa podia ser desenhada antes da fonte Alfa Slab One carregar.
- 404 de `api/menu` em toda visita no GitHub Pages (atrasava o cardápio).
- `og:image`, imagem do JSON-LD e `hasMenu` com caminho relativo (a prévia do link no WhatsApp/Facebook falhava).
- Menu do topo continuava marcando a última seção ao voltar para o início.
- Animações CSS infinitas (selo girando, vapor, logo flutuando) rodando fora da tela.
- "Reduzir movimento" agora é acompanhado na hora (sem precisar recarregar).

## O que ficou de fora (e por quê)

- **Diminuir o three.js**: ele é ~93% do `3d.js` (622 KB, 166 KB compactado) e o renderer puxa quase todo o núcleo. Em vez de cortar, o arquivo é carregado depois que a página já apareceu e fica em cache no aparelho.
- **AVIF nas fotos**: o WebP já está em 3 tamanhos; AVIF exigiria duplicar todas as fotos de novo para um ganho pequeno.
- **Hospedar as fontes no próprio site**: a Nunito passou a vir como fonte variável (1 arquivo em vez de 5); hospedar localmente exigiria baixar e manter os arquivos das fontes.

## Como medir de novo

Abra o site com `?fps` para ver os quadros por segundo. No Chrome: DevTools → Lighthouse (modo celular) e DevTools → Performance gravando 10 s de rolagem.
