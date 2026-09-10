# submusic — Servidor de Música com Painel Web (Online + Offline)

Servidor de música que roda no seu computador. Ele lê os arquivos de uma ou mais
pastas do seu PC, organiza tudo (artista, álbum, capa) e te dá um player estilo
Spotify — escuro, com verde e roxo — acessível via navegador (Web) ou em uma
janela própria (modo App). Também tem uma aba **Online**, pra buscar e ouvir
músicas direto da internet (streaming, sem baixar nada).

## Como rodar (Windows — jeito fácil)

Requisito: [Node.js](https://nodejs.org) versão 18 ou mais recente instalado no PC
(baixe a versão LTS e instale normalmente, próximo/próximo/concluir).

Extraia esta pasta em qualquer lugar do seu computador e dê duplo clique em um
destes três arquivos, dependendo do que você quer:

| Arquivo | O que faz |
|---|---|
| `iniciar-web.bat` | Abre só no navegador, numa aba normal (com barra de endereço). |
| `iniciar-app.bat` | Abre só em janela separada, sem barra de navegador — visual de app. |
| `iniciar-tudo.bat` | Abre os dois ao mesmo tempo: a aba Web e a janela App. |

Na primeira vez, o `.bat` instala tudo sozinho (pode levar ~1 minuto). Nas
próximas vezes é praticamente instantâneo. O servidor roda numa janela preta
(minimizada no modo App/Tudo) — é ela que serve os arquivos, então não feche
enquanto quiser ouvir música. Pra parar, feche essa janela ou aperte Ctrl+C.

Se o Windows avisar "o Windows protegeu seu computador" (SmartScreen), clique em
**Mais informações** → **Executar assim mesmo** — é só porque o arquivo não tem
uma assinatura digital paga, não porque tem algo de errado.

> O modo App tenta abrir o Chrome ou o Edge instalados no computador em modo
> `--app` (janela própria, sem barra de endereço). Se nenhum dos dois for
> encontrado nos locais padrão, ele abre no navegador normal mesmo.

## Como rodar (Mac/Linux, ou manualmente no Windows)

1. Abra um terminal dentro da pasta `music-server`.
2. Instale as dependências (só precisa fazer isso uma vez): `npm install`
3. Inicie o servidor: `npm start`
4. Abra o navegador em `http://localhost:3000`

## Personalizar nome, logo e cores — arquivo `config.js`

Abra o arquivo **`config.js`** (na raiz do projeto) em qualquer editor de texto.
Nele dá pra mudar, com comentários explicando cada campo:

- **`appName`** — o nome do app (aparece na barra lateral, na aba do navegador
  e no título da janela do modo App).
- **`logo`** — coloque sua imagem dentro de `public/img/` e escreva o caminho
  aqui (ex: `'img/minha-logo.png'`). Deixe `''` pra usar o quadrado verde/roxo padrão.
- **`cores`** — cores em hexadecimal: fundo, fundo dos cards, barra lateral,
  verde, roxo e texto.
- **`host`** — endereço de escuta do servidor. Deixe `0.0.0.0` para aceitar
  conexões locais, da rede e de servidores externos. Isso permite acessar pelo
  `http://localhost:PORT` e também pelo IP da máquina, por exemplo `http://192.168.1.10:8000`.
- **`porta`** — porta do servidor (padrão 8000). Se mudar aqui, mude também o
  número `8000` dentro dos três arquivos `.bat`.
- **`youtubeApiKey`** — necessária pra aba **Online** funcionar (veja abaixo).

Depois de editar, salve o arquivo, feche o servidor e abra o `.bat` de novo.

## Aba Online — buscar músicas na internet (YouTube)

A aba **Online** busca vídeos no YouTube e toca direto pelo player oficial
embutido do próprio YouTube (streaming) — nada é baixado pro computador. Já a
**Sua Biblioteca** continua sendo só o modo offline: toca apenas os arquivos
que já estão salvos nas pastas configuradas no PC/celular.

Pra ativar a busca Online, você precisa de uma chave gratuita da API do YouTube:

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/)
2. Crie um projeto novo (qualquer nome)
3. Vá em **APIs e serviços → Biblioteca**, procure **YouTube Data API v3** e clique em **Ativar**
4. Vá em **APIs e serviços → Credenciais → Criar credenciais → Chave de API**
5. Copie a chave e cole no campo `youtubeApiKey` do `config.js`

Sem essa chave, a aba Online mostra um aviso explicando isso — o resto do app
continua funcionando normalmente.

## Primeiros passos com a biblioteca offline

1. Clique em **"Servidor & Pastas"** na barra lateral.
2. Cole o caminho completo de uma pasta com músicas no seu PC, por exemplo:
   - Windows: `C:\Users\SeuNome\Music`
   - Mac/Linux: `/home/seunome/Musica`
3. Clique em **Adicionar pasta**, feche o modal e clique em **"Escanear biblioteca"**
   no topo da tela.
4. As faixas, álbuns, artistas e capas (extraídas do próprio arquivo, quando existem)
   aparecem automaticamente.

## O que já está funcionando nesta versão

- Servidor local em `http://localhost:3000`, com API REST.
- Três formas de abrir: Web (aba), App (janela própria) e os dois juntos.
- Aba **Online**: busca e streaming via YouTube, sem download.
- Escaneamento de pastas (recursivo) e reconhecimento automático de novos arquivos.
- Suporte a MP3, WAV, FLAC, AAC, OGG, OPUS, WMA, AIFF, ALAC, M4A, MIDI, e vídeos
  MP4/MKV/AVI/WEBM/MOV/M4V como faixas reproduzíveis (modo offline).
- Extração automática de metadados (título, artista, álbum, ano, gênero, capa) via ID3/tags.
- Player completo: play/pause, próxima/anterior, shuffle, repeat (tudo/uma faixa),
  barra de progresso arrastável, controle de volume.
- Favoritos, histórico de reprodução ("tocadas recentemente").
- Playlists: criar, adicionar/remover faixas, exportar para `.m3u`, importar `.m3u`.
- Upload de arquivos por API (`/api/upload`) — grava direto na pasta configurada e
  re-escaneia automaticamente.
- Renomear e excluir arquivos direto pela API.
- Streaming com suporte a `Range` (permite arrastar a barra de progresso sem
  esperar o arquivo inteiro carregar).
- Progresso do escaneamento em tempo real via WebSocket (Socket.io).
- Nome, logo e cores editáveis via `config.js`, sem precisar mexer no código.

## Deploy em nuvem / domínio público

Para atender ao requisito de funcionar em qualquer lugar do mundo, o app deve
ser hospedado em um servidor cloud (VPS, AWS EC2, Azure, DigitalOcean, Hetzner,
Render, Railway etc.) e acessado por um domínio público com HTTPS.

### Requisitos da infraestrutura

- Não usar `localhost` em produção.
- Usar `0.0.0.0` no bind do servidor.
- Expor a porta 80/443 no firewall.
- Configurar domínio com A record ou CNAME para o IP do servidor.
- Usar TLS/HTTPS (Let's Encrypt ou cert-manager).
- Rodar atrás de Nginx/Traefik/Caddy para proxy reverso.
- O APK deve apontar para `https://seu-dominio.com` e não para `localhost`.

### Docker (opção recomendada)

Crie um `Dockerfile` e um `docker-compose.yml` para subir o projeto em qualquer
servidor Linux. Exemplo de variáveis:

- `HOST=0.0.0.0`
- `PORT=3000`
- `PUBLIC_URL=https://seu-dominio.com`

Depois, rode o container num VPS e conecte o domínio ao IP do servidor.

### Exemplo de deploy

1. Contrate uma VPS Linux (Ubuntu 22.04+)
2. Instale Docker e Docker Compose
3. Copie o projeto para o servidor
4. Configure `.env` com o domínio público
5. Rode `docker compose up -d --build`
6. Configure o Nginx/Traefik e Let's Encrypt
7. Acesse `https://seu-dominio.com`
8. No APK, use `https://seu-dominio.com` no campo de servidor

### Observação importante

Este projeto continua sendo um app web servido por um backend Node.js. Para que
o app funcione na internet, você precisa de um domínio público e um servidor
cloud, não apenas do PC local.

## Estrutura do projeto

```
music-server/
  config.js            nome, logo, cores, porta e chave do YouTube (editável)
  iniciar-web.bat       duplo clique = abre só no navegador (aba normal)
  iniciar-app.bat       duplo clique = abre só em janela separada (modo app)
  iniciar-tudo.bat      duplo clique = abre os dois juntos
  server/
    index.js            servidor Express + Socket.io
    db.js                "banco de dados" em JSON (arquivo local, sem instalação)
    scan.js              escaneamento de pastas + extração de metadados
    routes/
      tracks.js           faixas, streaming, capas, favoritos, histórico
      playlists.js         playlists + import/export M3U
      library.js           config de pastas, escaneamento, upload, renomear/excluir
      youtube.js            busca online (YouTube Data API v3)
      appconfig.js           expõe nome/logo/cores do config.js pro frontend
  public/
    index.html            painel web
    style.css              tema visual
    app.js                 lógica do player, das telas e da busca online
    img/                    coloque aqui sua logo, se quiser trocar a padrão
  data/                    criado automaticamente: banco (db.json) e capas extraídas
```

## Observação sobre formatos de vídeo/áudio no navegador

O servidor entrega qualquer um dos formatos listados, mas o **navegador** é quem
decodifica o áudio/vídeo. Chrome e Edge tocam bem MP3, WAV, FLAC, AAC, OGG, OPUS
e M4A. Formatos como WMA, ALAC ou MIDI podem não tocar diretamente em todos os
navegadores — isso é uma limitação do navegador, não do servidor.
