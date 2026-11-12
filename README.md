# ❤ Nosso Tempo Juntos

Site de casal com contador do tempo juntos, fotos, músicas e surpresas. Funciona direto no GitHub Pages, sem servidor.

## Funções

- **Contador completo:** anos, meses, dias, horas, minutos e segundos, contados pelo calendário. Mostra também o total de dias e de horas.
- **Próximo marco:** "Faltam 9 dias para completarmos 5 meses", contando os mêsversários, os aniversários e cada centena de dias. No dia, aparece uma comemoração com corações.
- **Data no futuro:** vira uma contagem regressiva.
- **Fotos:**
  - Podem ser arquivos da pasta, links de redes sociais ou fotos adicionadas pelo celular.
  - Trocam sozinhas, dá para arrastar no celular e tocar para ver em tela cheia.
- **Várias músicas:** botões para escolher entre Spotify, YouTube, Deezer, Apple Music e SoundCloud.
- **Cartinha:** abre num envelope e o texto aparece como se estivesse sendo escrito.
- **"Por que eu te amo?":** sorteia uma frase a cada toque.
- **Compartilhar:** envia o link do site pelo celular.
- **Botão ⚙ Personalizar:** muda tudo pela própria página, sem mexer no código.

## Como personalizar

### Opção 1: pelo site (mais fácil)

1. Abra o site e toque em **⚙**.
2. Preencha os nomes, a data, as fotos, as músicas e a cartinha.
3. Escolha como guardar:
   - **Salvar:** fica só no seu navegador.
   - **Copiar link para enviar:** gera um link com tudo dentro. Quem abrir esse link vê a sua versão.
   - **Copiar para o config.js:** cole no arquivo `config.js` do GitHub. Assim a mudança vale para todo mundo, até para quem abrir o link normal.

### Opção 2: editando o `config.js`

Todas as opções estão explicadas dentro do próprio arquivo.

## Fotos

| De onde | Como pegar o link |
|---|---|
| Pasta do site | Envie `Foto1.jpg`, `Foto2.jpg`... para o repositório e escreva o nome do arquivo |
| Instagram | Na publicação: ⋯ → **Copiar link** (perfil público) |
| Google Drive | Compartilhe como **Qualquer pessoa com o link** e copie o link do arquivo |
| Pinterest, TikTok, Facebook, X | Link da publicação pública |
| Google Fotos e outros sites | Abra a foto → botão direito → **Copiar endereço da imagem** |
| Celular ou computador | Botão **📷 Adicionar fotos deste aparelho** (ficam só naquele navegador) |

> O Instagram e as outras redes não deixam outros sites puxarem as fotos de um perfil. Por isso, cada publicação aparece no formato de incorporação da própria rede, com uma publicação por slide.

## Músicas

Uma por linha, no formato `Nome | link`:

```
Nossa música | https://open.spotify.com/track/...
Primeira viagem | https://youtu.be/...
```

Links encurtados (como `spotify.link/...`) não funcionam. Abra o link no navegador e copie o endereço completo.

## Arquivos

```
index.html   estrutura da página
style.css    visual e animações
script.js    funcionamento
config.js    suas informações (edite este)
```
