# 斬 Portfólio · Carlos Serra

Landing page de portfólio do Carlos Serra, desenvolvedor full stack júnior em Palhoça/SC.
Tema inspirado em *Bleach: Thousand-Year Blood War* (fan art, sem vínculo com os detentores dos direitos).

Tudo está em **um único arquivo**: [`index.html`](index.html). Não precisa instalar nada.

| Arquivo | O que é |
| --- | --- |
| `index.html` | A landing page completa (HTML, CSS e JavaScript juntos) |
| `PROMPT.md` | O prompt profissional usado para criar a página, para reusar em qualquer IA |
| `README.md` | Este guia |

## O que tem na página

- **Hero** com selo de disponibilidade, números reais e o ensō que **gira com a rolagem**.
- **Resumo de 30 segundos** para recrutadores (quem sou, o que entrego, stack, o que procuro).
- **4 estudos de caso** (Figaro's 2.0, Smartech 3.0, São Cristóvão 3.0, Ingrid Lima) com rolagem horizontal.
- **Arquivo com os 19 repositórios**, filtros, busca e links "Ao vivo" (GitHub Pages) e "Código".
  Quando o site estiver no ar, ele busca sozinho repositórios novos na API do GitHub e marca como **NOVO**.
- **Trajetória** de agosto a outubro de 2026, **habilidades com prova** (cada uma aponta para um projeto),
  **método de trabalho**, **formação** (ADS · FMP · 2ª fase) e **contato**.
- **Modo Bankai**: clique no botão "Bankai" ou aperte a tecla **B**.
- Acessível (teclado, "reduzir movimento", leitor de tela), responsivo e com SEO (Open Graph + JSON-LD).

## 1. Abrir no seu computador (área de trabalho)

1. Baixe a pasta `portfolio-carlos` (no GitHub: botão **Code → Download ZIP**, ou `git clone`).
2. Coloque a pasta na sua **Área de Trabalho**.
3. Dê dois cliques no `index.html`. Pronto.

## 2. Preencher seus contatos (importante!)

Abra o `index.html` em qualquer editor (VS Code, Bloco de Notas) e procure por `const CONFIG`:

```js
const CONFIG = {
  github: "carlosserra-a11y",
  email: "",        // ex.: "seuemail@gmail.com"  → aparece o botão "Copiar e-mail"
  linkedin: "",     // ex.: "https://www.linkedin.com/in/seu-perfil"
  whatsapp: "",     // só números com DDI e DDD, ex.: "5548999999999"
  curriculo: "",    // link do PDF do currículo (Google Drive, GitHub…)
  buscarRepos: true
};
```

Campo vazio = some da página. Campo preenchido = aparece um botão no contato.

## 3. Publicar de graça no GitHub Pages

O melhor endereço é **https://carlosserra-a11y.github.io/** (sem nada depois da barra):

1. No GitHub, crie um repositório novo chamado exatamente **`carlosserra-a11y.github.io`**.
2. Envie o `index.html` para a raiz dele (**Add file → Upload files**).
3. Vá em **Settings → Pages**, escolha **Deploy from a branch → main → / (root)** e salve.
4. Em 1 ou 2 minutos o site estará no ar. Coloque esse link no LinkedIn, no currículo e na bio do GitHub.

## 4. Editar projetos

- **Estudos de caso:** procure `const CASES` no `index.html`.
- **Lista completa:** procure `const REPOS`. Cada linha é um repositório
  (`c` é a categoria: `sistema`, `negocio`, `fmp` ou `inicio`).

## Checklist antes de mandar para empresas

- [ ] Preencher `email` e `linkedin` no `CONFIG`
- [ ] Conferir se o nome "Carlos Serra" está certo (e o sobrenome completo, se quiser)
- [ ] Publicar no GitHub Pages e testar no celular
- [ ] Colocar uma descrição em cada repositório do GitHub (os que estão sem descrição perdem pontos)
- [ ] Fixar os 4 projetos em destaque no seu perfil do GitHub (**Customize your pins**)
- [ ] Criar o README de perfil (repositório `carlosserra-a11y/carlosserra-a11y`) com o link do portfólio
