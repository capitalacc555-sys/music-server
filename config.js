// ======================================================================
//  CONFIGURAÇÃO DO SUBMUSIC
//  Edite os valores abaixo à vontade — é só texto, não precisa saber programar.
//  Depois de editar e salvar, feche o servidor (a janela preta) e abra o
//  arquivo .bat de novo para as mudanças aparecerem.
// ======================================================================

module.exports = {

  // Nome do aplicativo. Aparece na barra lateral, na aba do navegador e
  // no título da janela quando abrir no modo App.
  appName: 'NightWave',

  // Frase pequena/opcional (não é usada em todo lugar ainda, mas fica
  // disponível para você usar como quiser). Pode deixar '' (vazio).
  tagline: 'Sua música, sem limites.',

  // Caminho da sua logo/imagem, dentro da pasta public/.
  // 1) Coloque sua imagem (png, jpg ou svg) dentro da pasta public/img/
  // 2) Escreva o caminho dela aqui, por exemplo: 'img/minha-logo.png'
  // Se deixar em branco (''), usa o quadradinho colorido verde/roxo padrão.
  logo: 'img/expirada-logo.png',

  // Cores da interface (formato hexadecimal #RRGGBB).
  cores: {
    fundo: '#020b14',          // fundo principal da tela
    fundoCard: '#111f2d',      // fundo dos cartões de álbum e das linhas
    barraLateral: '#040d18',   // fundo da barra lateral (esquerda)
    verde: '#29d9ff',          // cor de destaque azul neon
    roxo: '#ff3ec9',           // cor de destaque magenta
    texto: '#edf6ff'           // cor do texto principal
  },

  // Host em que o servidor fica escutando.
  // Use '0.0.0.0' para aceitar conexões locais, da rede e de servidores
  // externos apontando para esta máquina/instância.
  host: '0.0.0.0',

  // Porta em que o servidor roda. Só troque se souber o que está fazendo —
  // se trocar aqui, troque também o número "8000" dentro dos 3 arquivos
  // .bat (iniciar-web.bat, iniciar-app.bat, iniciar-tudo.bat).
  porta: 8000

};
